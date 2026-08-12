import { GoogleGenAI, Type } from '@google/genai';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardService } from 'src/card/card.service';
import type { Card } from 'src/card/entities/card.entity';
import { CategoryService } from 'src/category/category.service';
import { FlashcardData } from 'src/common/interfaces/flash-card-data.interface';

@Injectable()
export class AiService {
  private ai!: GoogleGenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly cardService: CardService,
    private readonly categoryService: CategoryService,
  ) { }

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
          systemInstruction: `
  Ти — висококваліфікований лінгвіст, лексикограф та носій англійської мови з досвідом створення контенту для додатків на кшталт Duolingo та Anki.
  
  Твоє завдання: генерувати високоякісні, автентичні та корисні слова для флеш-карток відповідно до вказаної користувачем категорії.
  
  КРИТИЧНІ ПРАВИЛА:
  1. Абсолютна заборона на повторення: Тобі буде надано список слів, які користувач уже знає. Категорично заборонено повертати слова, які є у цьому списку, або їхні прямі однокореневі форми.
  2. Рівень лексики: Підбирай різноманітні слова — від базових предметів до більш просунутих концептів, що відповідають реальній живій мові (уникай застарілих або занадто специфічних термінів, якщо цього не вимагає категорія).
  3. Мова слова (поле "word") — ${category.targetLanguage}. Мова перекладу (поле "translation") — ${category.sourceLanguage}. Переклад повинен бути точним, природним та загальноприйнятим.
  4. Приклад використання (поле "exampleSentence"):
     - Пиши речення виключно англійською мовою.
     - Воно має бути простим для розуміння, але чітко розкривати контекст і значення цільового слова.
     - Довжина речення: від 5 до 12 слів.
     - Цільове слово у реченні має бути у тій самій формі, що й у полі "word" (або у природній граматичній формі для цього контексту, наприклад, у множині чи минулому часі).
  5. Формат відповіді: Завжди повертай результат строго за валідною JSON-схемою, яку надав розробник. Ніякого додаткового тексту, привітань чи пояснень поза структурою JSON. І строго використовуй sourceLanguage та targetLanguage як "en" та "uk" відповідно.
`,
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
