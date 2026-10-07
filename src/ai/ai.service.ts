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
import {
  buildListSystemInstruction,
  buildSystemInstruction,
} from 'src/common/constants/promts';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiGenerationMode } from './ai-generation-mode.enum';
import { AiGenerationLevel } from './ai-generation-level.enum';
import { AiFlashCardDto } from './dto/ai-flash-card.dto';
import { AiRequestDto } from './dto/ai-request.dto';

type AiError = {
  status?: unknown;
  statusCode?: unknown;
};

type ValidatedCards = {
  valid: AiFlashCardDto[];
  invalid: { raw: unknown; errors: string[] }[];
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

  private extractWordSafely(raw: unknown): string | null {
    if (typeof raw === 'object' && raw !== null && 'word' in raw) {
      const word = raw.word;
      return typeof word === 'string' ? word : null;
    }
    return null;
  }

  async generateResponse(
    request: AiRequestDto,
    userId: string,
  ): Promise<{
    level: AiGenerationLevel | null;
    requestedCount: number;
    generatedCount: number;
    retryAttempts: number;
    unfulfilledCount: number;
    created: number;
    createdCards: Card[];
    skippedWords: string[];
  }> {
    try {
      const category = await this.categoryService.findByCategoryIdAndUserId(
        request.categoryId,
        userId,
      );

      if (!category) {
        throw new NotFoundException(CategoryErrorMessages.CATEGORY_NOT_FOUND);
      }

      const languages = {
        sourceLanguage: category.sourceLanguage,
        targetLanguage: category.targetLanguage,
      };
      const requestedWords =
        request.mode === AiGenerationMode.FROM_LIST
          ? [
              ...new Map(
                (request.words ?? [])
                  .map((word) => word.trim())
                  .filter(Boolean)
                  .map((word) => [word.toLocaleLowerCase(), word] as const),
              ).values(),
            ]
          : undefined;
      const requestedCount =
        request.mode === AiGenerationMode.GENERATE
          ? request.count!
          : requestedWords!.length;
      const systemInstruction = requestedWords
        ? buildListSystemInstruction(languages)
        : buildSystemInstruction(languages, request.level);
      const userPrompt =
        request.mode === AiGenerationMode.GENERATE
          ? `${request.prompt}\n\nСтвори рівно ${requestedCount} унікальних карток.`
          : `${request.prompt ? `${request.prompt.trim()}\n\n` : ''}Створи рівно одну картку для кожного слова зі списку. У полі word збережи кожне слово без змін. Не додавай інших слів.\n${JSON.stringify(requestedWords)}`;

      const completion = await this.groq.chat.completions.create({
        model: 'qwen/qwen3.8-27b',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${systemInstruction}

Respond ONLY with valid JSON in this exact shape:
{ "cards": [ { "word": "...", "sourceLanguage": "...", "targetLanguage": "...", "translation": "...", "transcription": "...", "explanation": "...", "example": "..." } ] }

Поверни рівно ${requestedCount} карток у масиві cards. Не додавай лічильники до JSON-відповіді.`,
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

      const { valid, invalid } = await this.validateAiCards(
        this.extractCardsArray(parsed),
        category.sourceLanguage,
        category.targetLanguage,
      );

      let finalCards = this.mergeUniqueCards([], valid);
      let aiSkippedWords = invalid
        .map((item) => this.extractWordSafely(item.raw))
        .filter((word): word is string => !!word);

      if (invalid.length > 0) {
        const repaired = await this.repairInvalidCards(
          invalid,
          category.sourceLanguage,
          category.targetLanguage,
          systemInstruction,
        );
        finalCards = this.mergeUniqueCards(finalCards, repaired);
        const repairedWords = new Set(
          repaired.map((card) => card.word.trim().toLocaleLowerCase()),
        );
        aiSkippedWords = aiSkippedWords.filter(
          (word) => !repairedWords.has(word.trim().toLocaleLowerCase()),
        );
      }

      if (requestedWords) {
        finalCards = this.onlyRequestedWords(finalCards, requestedWords);
      }

      let retryAttempts = 0;
      if (finalCards.length < requestedCount) {
        const additional = await this.generateAdditionalCards(
          requestedCount - finalCards.length,
          finalCards,
          userPrompt,
          category.sourceLanguage,
          category.targetLanguage,
          requestedWords,
          request.level,
        );

        retryAttempts = additional.retryAttempts;
        finalCards = this.mergeUniqueCards(finalCards, additional.valid);
        aiSkippedWords.push(...additional.skippedWords);
      }
      finalCards = finalCards.slice(0, requestedCount);

      if (finalCards.length === 0) {
        throw new HttpException(
          AiErrorMessages.NO_VALID_CARDS,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const result = await this.cardService.bulkCreateFromAi(
        finalCards.map((card) => ({
          ...card,
          level:
            request.mode === AiGenerationMode.GENERATE
              ? (request.level ?? null)
              : null,
        })),
        userId,
        request.categoryId,
      );
      return {
        level:
          request.mode === AiGenerationMode.GENERATE
            ? (request.level ?? null)
            : null,
        requestedCount,
        generatedCount: finalCards.length,
        retryAttempts,
        unfulfilledCount: Math.max(requestedCount - finalCards.length, 0),
        created: result.created,
        createdCards: result.createdCards,
        skippedWords: [...aiSkippedWords, ...result.skippedWords],
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

  private mergeUniqueCards(
    current: AiFlashCardDto[],
    additions: AiFlashCardDto[],
  ): AiFlashCardDto[] {
    const words = new Set(
      current.map((card) => card.word.trim().toLocaleLowerCase()),
    );
    const result = [...current];

    for (const card of additions) {
      const word = card.word.trim().toLocaleLowerCase();
      if (!words.has(word)) {
        words.add(word);
        result.push(card);
      }
    }

    return result;
  }

  private onlyRequestedWords(
    cards: AiFlashCardDto[],
    requestedWords: string[],
  ): AiFlashCardDto[] {
    const requested = new Set(
      requestedWords.map((word) => word.trim().toLocaleLowerCase()),
    );
    return cards.filter((card) =>
      requested.has(card.word.trim().toLocaleLowerCase()),
    );
  }

  private async generateAdditionalCards(
    missingCount: number,
    existingCards: AiFlashCardDto[],
    originalPrompt: string,
    sourceLanguage: string,
    targetLanguage: string,
    requestedWords?: string[],
    level?: AiRequestDto['level'],
  ): Promise<{
    valid: AiFlashCardDto[];
    skippedWords: string[];
    retryAttempts: number;
  }> {
    const generated: AiFlashCardDto[] = [];
    const skippedWords: string[] = [];
    let retryAttempts = 0;

    for (
      let attempt = 0;
      attempt < 2 && generated.length < missingCount;
      attempt++
    ) {
      retryAttempts++;
      const excludedWords = [...existingCards, ...generated]
        .map((card) => card.word)
        .join(', ');
      const coveredWords = new Set(
        [...existingCards, ...generated].map((card) =>
          card.word.trim().toLocaleLowerCase(),
        ),
      );
      const remainingWords = requestedWords?.filter(
        (word) => !coveredWords.has(word.trim().toLocaleLowerCase()),
      );
      const remainingCount = requestedWords
        ? remainingWords!.length
        : missingCount - generated.length;
      if (remainingCount === 0) break;
      const prompt = requestedWords
        ? `${originalPrompt}\n\nПопередня відповідь була неповною. Створи картки лише для цих слів: ${JSON.stringify(remainingWords)}. Не додавай інших слів.`
        : `${originalPrompt}\n\nЗгенеруй ще ${remainingCount} нових слів. Не повторюй слова з цього списку: ${excludedWords || '(список порожній)'}`;

      try {
        const systemInstruction = requestedWords
          ? buildListSystemInstruction({ sourceLanguage, targetLanguage })
          : buildSystemInstruction({ sourceLanguage, targetLanguage }, level);
        const completion = await this.groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${systemInstruction}

    Respond ONLY with valid JSON in this exact shape:
    { "cards": [ { "word": "...", "sourceLanguage": "...", "targetLanguage": "...", "translation": "...", "transcription": "...", "explanation": "...", "example": "..." } ] }

    Поверни рівно ${remainingCount} карток. Не додавай лічильники до JSON-відповіді.`,
            },
            { role: 'user', content: prompt },
          ],
        });

        const rawText = completion.choices[0]?.message?.content;
        if (!rawText) continue;

        const parsed: unknown = JSON.parse(rawText);
        const { cards, skippedWords: rejectedWords } =
          await this.validateAndRepairCards(
            this.extractCardsArray(parsed),
            sourceLanguage,
            targetLanguage,
            systemInstruction,
          );
        const additions = requestedWords
          ? this.onlyRequestedWords(cards, remainingWords!)
          : cards;
        generated.splice(
          0,
          generated.length,
          ...this.mergeUniqueCards(generated, additions),
        );
        skippedWords.push(...rejectedWords);
      } catch {
        continue;
      }
    }

    return { valid: generated, skippedWords, retryAttempts };
  }

  private async validateAiCards(
    rawCards: unknown,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<ValidatedCards> {
    if (!Array.isArray(rawCards)) {
      throw new HttpException(
        AiErrorMessages.INVALID_FORMAT,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const valid: AiFlashCardDto[] = [];
    const invalid: { raw: unknown; errors: string[] }[] = [];

    for (const rawCard of rawCards) {
      const dto = plainToInstance(AiFlashCardDto, rawCard);
      const errors = await validate(dto);
      const languageErrors: string[] = [];
      if (dto.sourceLanguage !== sourceLanguage) {
        languageErrors.push('sourceLanguage does not match the category');
      }
      if (dto.targetLanguage !== targetLanguage) {
        languageErrors.push('targetLanguage does not match the category');
      }

      if (errors.length === 0 && languageErrors.length === 0) {
        valid.push(dto);
      } else {
        invalid.push({
          raw: rawCard,
          errors: [
            ...errors.map((e) => Object.values(e.constraints ?? {})).flat(),
            ...languageErrors,
          ],
        });
      }
    }

    return { valid, invalid };
  }

  private async repairInvalidCards(
    invalidRawCards: { raw: unknown; errors: string[] }[],
    sourceLanguage: string,
    targetLanguage: string,
    systemInstruction: string,
  ): Promise<AiFlashCardDto[]> {
    if (invalidRawCards.length === 0) return [];

    const repairPrompt = `
Наступні картки мають проблеми з полями. Виправ і поверни ПОВНІ, коректні версії
в тому самому JSON-форматі { "cards": [...] }.

${invalidRawCards
  .map(
    (item, i) =>
      `${i + 1}. Дані: ${JSON.stringify(item.raw)}\nПроблеми: ${item.errors.join(', ')}`,
  )
  .join('\n\n')}
`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'qwen/qwen3.8-27b',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemInstruction,
          },
          { role: 'user', content: repairPrompt },
        ],
      });

      const rawText = completion.choices[0]?.message?.content;
      if (!rawText) return [];

      const parsed: unknown = JSON.parse(rawText);
      const { valid } = await this.validateAiCards(
        this.extractCardsArray(parsed),
        sourceLanguage,
        targetLanguage,
      );
      return valid;
    } catch {
      return [];
    }
  }

  private async validateAndRepairCards(
    rawCards: unknown,
    sourceLanguage: string,
    targetLanguage: string,
    systemInstruction: string,
  ): Promise<{ cards: AiFlashCardDto[]; skippedWords: string[] }> {
    const { valid, invalid } = await this.validateAiCards(
      rawCards,
      sourceLanguage,
      targetLanguage,
    );
    let finalCards = [...valid];
    let aiSkippedWords = invalid
      .map((item) => this.extractWordSafely(item.raw))
      .filter((word): word is string => !!word);

    if (invalid.length > 0) {
      const repaired = await this.repairInvalidCards(
        invalid,
        sourceLanguage,
        targetLanguage,
        systemInstruction,
      );
      finalCards = this.mergeUniqueCards(finalCards, repaired);
      const repairedWords = new Set(
        repaired.map((card) => card.word.trim().toLocaleLowerCase()),
      );
      aiSkippedWords = aiSkippedWords.filter(
        (word) => !repairedWords.has(word.trim().toLocaleLowerCase()),
      );
    }
    return { cards: finalCards, skippedWords: aiSkippedWords };
  }
}
