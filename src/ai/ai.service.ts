import Groq from 'groq-sdk';
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardService } from 'src/card/card.service';
import type { Card } from 'src/card/entities/card.entity';
import { CategoryService } from 'src/category/category.service';
import { AiErrorStatus } from 'src/common/constants/http-status.constants';
import {
  AiErrorMessages,
  CategoryErrorMessages,
} from 'src/common/constants/messages.constants';
import { buildSystemInstruction } from 'src/common/constants/promts';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiFlashCardDto } from './dto/ai-flash-card.dto';

type AiError = {
  status?: unknown;
  statusCode?: unknown;
};

function getAiErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const aiError = error as AiError;
  const status = aiError.status ?? aiError.statusCode;

  return typeof status === 'number' ? status : undefined;
}

@Injectable()
export class AiService {
  private groq!: Groq;

  constructor(
    private readonly configService: ConfigService,
    private readonly cardService: CardService,
    private readonly categoryService: CategoryService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.groq = new Groq({ apiKey });
  }

  async generateResponse(
    userPrompt: string,
    categoryId: string,
    userId: string,
  ): Promise<{
    created: number;
    createdCards: Card[];
    skippedWords: string[];
  }> {
    try {
      const category = await this.categoryService.findByCategoryIdAndUserId(
        categoryId,
        userId,
      );

      if (!category) {
        throw new NotFoundException(CategoryErrorMessages.CATEGORY_NOT_FOUND);
      }

      const systemInstruction = buildSystemInstruction({
        sourceLanguage: category.sourceLanguage,
        targetLanguage: category.targetLanguage,
      });

      const completion = await this.groq.chat.completions.create({
        model: 'qwen/qwen3.8-27b',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${systemInstruction}

Respond ONLY with valid JSON in this exact shape:
{ "cards": [ { "word": "...", "sourceLanguage": "...", "targetLanguage": "...", "translation": "...", "transcription": "...", "explanation": "...", "example": "..." } ] }`,
          },
          { role: 'user', content: userPrompt },
        ],
      });

      const rawText = completion.choices[0]?.message?.content;

      if (!rawText) {
        throw new Error(AiErrorMessages.EMPTY_RESPONSE);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new HttpException(
          AiErrorMessages.INVALID_JSON,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const cards = await this.validateAiCards(this.extractCardsArray(parsed));
      const result = await this.cardService.bulkCreateFromAi(
        cards,
        userId,
        categoryId,
      );
      return {
        created: result.created,
        createdCards: result.createdCards,
        skippedWords: result.skippedWords,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const aiStatus = getAiErrorStatus(error);
      const status =
        aiStatus && aiStatus >= 400 && aiStatus <= 599
          ? aiStatus
          : HttpStatus.BAD_GATEWAY;
      const message =
        status === AiErrorStatus.AI_SERVICE_UNAVAILABLE_STATUS
          ? AiErrorMessages.AI_SERVICE_UNAVAILABLE_MESSAGE
          : AiErrorMessages.AI_SERVICE_ERROR_MESSAGE;

      throw new HttpException(message, status);
    }
  }

  private extractCardsArray(parsed: unknown): unknown {
    if (Array.isArray(parsed)) return parsed;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'cards' in parsed &&
      Array.isArray(parsed.cards)
    ) {
      return (parsed as { cards: unknown[] }).cards;
    }
    return parsed;
  }

  private async validateAiCards(rawCards: unknown): Promise<AiFlashCardDto[]> {
    if (!Array.isArray(rawCards)) {
      throw new HttpException(
        AiErrorMessages.INVALID_FORMAT,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const validCards: AiFlashCardDto[] = [];

    for (const rawCard of rawCards) {
      const dto = plainToInstance(AiFlashCardDto, rawCard);
      const errors = await validate(dto);

      if (errors.length === 0) {
        validCards.push(dto);
      } else {
        console.warn(
          `Data invalid: ${JSON.stringify(rawCard)}`,
          errors.map((e) => Object.values(e.constraints ?? {})).flat(),
        );
      }
    }

    if (validCards.length === 0) {
      throw new HttpException(
        AiErrorMessages.NO_VALID_CARDS,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return validCards;
  }
}
