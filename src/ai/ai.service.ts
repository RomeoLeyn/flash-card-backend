import { GoogleGenAI, Type } from '@google/genai';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardService } from 'src/card/card.service';
import type { Card } from 'src/card/entities/card.entity';
import { CategoryService } from 'src/category/category.service';
import { buildSystemInstruction } from 'src/common/constants/promts';
import { FlashcardData } from 'src/common/interfaces/flash-card-data.interface';

@Injectable()
export class AiService {
  private ai!: GoogleGenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly cardService: CardService,
    private readonly categoryService: CategoryService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });
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
        throw new NotFoundException(
          'Категорія не знайдена або не належить користувачу.',
        );
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-3.5-flash',

        config: {
          systemInstruction: buildSystemInstruction({
            sourceLanguage: category.sourceLanguage,
            targetLanguage: category.targetLanguage,
          }),
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                sourceLanguage: { type: Type.STRING },
                targetLanguage: { type: Type.STRING },
                translation: { type: Type.STRING },
                transcription: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: [
                'word',
                'sourceLanguage',
                'targetLanguage',
                'translation',
                'explanation',
              ],
              propertyOrdering: [
                'word',
                'sourceLanguage',
                'targetLanguage',
                'translation',
                'explanation',
              ],
            },
          },
        },

        contents: userPrompt,
      });

      const rawText = response.text;

      if (!rawText) {
        throw new Error('Отримано порожню відповідь від ШІ.');
      }

      const cards: FlashcardData[] = JSON.parse(rawText) as FlashcardData[];
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
      console.error('Помилка Gemini API:', error);
      throw new Error('Не вдалося згенерувати відповідь від ШІ.');
    }
  }
}
