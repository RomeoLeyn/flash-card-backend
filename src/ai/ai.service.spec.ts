import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CardService } from 'src/card/card.service';
import { CategoryService } from 'src/category/category.service';
import { AiGenerationMode } from './ai-generation-mode.enum';
import { AiGenerationLevel } from './ai-generation-level.enum';
import { AiFlashCardDto } from './dto/ai-flash-card.dto';
import { AiRequestDto } from './dto/ai-request.dto';
import { ExplainWordRequestDto } from './dto/explain-word-request.dto';
import { AiService } from './ai.service';
import { HttpException } from '@nestjs/common';

type CompletionResponse = {
  choices: { message: { content: string } }[];
};

type ChatRequest = {
  messages: { role: string; content: string }[];
};

function makeCard(word: string): AiFlashCardDto {
  return {
    word,
    sourceLanguage: 'en',
    targetLanguage: 'uk',
    translation: `переклад ${word}`,
    transcription: '',
    explanation: `Пояснення для ${word}`,
    example: `I use ${word} every day.`,
  };
}

function makeService(responses: CompletionResponse[]) {
  const create = jest
    .fn<Promise<CompletionResponse>, [ChatRequest]>()
    .mockImplementation(() => {
      const response = responses.shift();
      if (!response) throw new Error('No mocked AI response remains');
      return Promise.resolve(response);
    });
  const cardService = {
    bulkCreateFromAi: jest.fn().mockResolvedValue({
      created: 0,
      createdCards: [],
      skippedWords: [],
    }),
  };
  const categoryService = {
    findByCategoryIdAndUserId: jest.fn().mockResolvedValue({
      sourceLanguage: 'en',
      targetLanguage: 'uk',
    }),
  };
  const service = new AiService(
    {} as ConfigService,
    cardService as unknown as CardService,
    categoryService as unknown as CategoryService,
  );

  Object.defineProperty(service, 'groq', {
    value: { chat: { completions: { create } } },
  });

  return { service, create, cardService };
}

function aiResponse(cards: AiFlashCardDto[]): CompletionResponse {
  return {
    choices: [{ message: { content: JSON.stringify({ cards }) } }],
  };
}

const categoryId = '0c6c5e5b-3d98-4bf2-9696-42b85a7ac07b';

describe('AiService generation counts and retries', () => {
  it('uses the requested count and keeps retrying after partial responses', async () => {
    const { service, create, cardService } = makeService([
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                requestedCount: 1,
                generatedCount: 50,
                cards: [makeCard('apple')],
              }),
            },
          },
        ],
      },
      aiResponse([makeCard('bread')]),
      aiResponse([makeCard('carrot')]),
    ]);

    const result = await service.generateResponse(
      {
        mode: AiGenerationMode.GENERATE,
        categoryId,
        count: 3,
        prompt: 'food',
        level: AiGenerationLevel.B2,
      },
      'user-id',
    );

    expect(result.requestedCount).toBe(3);
    expect(result.generatedCount).toBe(3);
    expect(result.retryAttempts).toBe(2);
    expect(result.level).toBe(AiGenerationLevel.B2);
    expect(create).toHaveBeenCalledTimes(3);
    expect(cardService.bulkCreateFromAi).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ level: AiGenerationLevel.B2 }),
      ]),
      'user-id',
      categoryId,
    );
    for (const [request] of create.mock.calls) {
      expect(request.messages[0].content).toContain('РІВЕНЬ CEFR: B2');
    }
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      'Мова слова, транскрипції та прикладу (`word`, `transcription`, `example`): цільова мова, яку користувач вивчає — `uk`',
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      'Мова перекладу та пояснення (`translation`, `explanation`): рідна мова користувача — `en`',
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      '"word": "<word in targetLanguage>"',
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      '"translation": "<translation in sourceLanguage>"',
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      '"explanation": "<short explanation in sourceLanguage>"',
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      '"example": "<natural example sentence in targetLanguage using word>"',
    );
  });

  it('creates cards for supplied words and retries only missing words', async () => {
    const { service } = makeService([
      aiResponse([makeCard('apple')]),
      aiResponse([makeCard('bread')]),
    ]);

    const result = await service.generateResponse(
      {
        mode: AiGenerationMode.FROM_LIST,
        categoryId,
        words: ['apple', 'bread'],
      },
      'user-id',
    );

    expect(result.requestedCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.retryAttempts).toBe(1);
    expect(result.level).toBeNull();
  });

  it('uses the dedicated translation prompt for supplied words', async () => {
    const { service, create } = makeService([aiResponse([makeCard('apple')])]);

    await service.generateResponse(
      {
        mode: AiGenerationMode.FROM_LIST,
        categoryId,
        words: ['apple'],
      },
      'user-id',
    );

    const messages = create.mock.calls[0][0].messages;
    expect(messages[0].content).toContain(
      'Preserve the original word or phrase',
    );
    expect(messages[0].content).toContain(
      'word, transcription, and example: target language (uk)',
    );
    expect(messages[0].content).toContain(
      'translation and explanation: source language (en)',
    );
    expect(messages[0].content).toContain(
      'Never default to English. Follow these language codes even when the supplied words are English',
    );
    expect(messages[0].content).toContain(
      'translation: a short, natural translation in en',
    );
    expect(messages[0].content).toContain(
      'explanation: a brief explanation in en',
    );
    expect(messages[0].content).toContain(
      'example: one natural sentence in uk',
    );
    expect(messages[0].content).not.toContain('Відповідність категорії');
  });

  it('does not return more cards than requested', async () => {
    const { service } = makeService([
      aiResponse([makeCard('apple'), makeCard('bread'), makeCard('carrot')]),
    ]);

    const result = await service.generateResponse(
      {
        mode: AiGenerationMode.GENERATE,
        categoryId,
        count: 2,
        prompt: 'food',
      },
      'user-id',
    );

    expect(result.requestedCount).toBe(2);
    expect(result.generatedCount).toBe(2);
  });

  it('retries when the initial response contains duplicate words', async () => {
    const { service, create } = makeService([
      aiResponse([makeCard('apple'), makeCard('apple')]),
      aiResponse([makeCard('bread')]),
    ]);

    const result = await service.generateResponse(
      {
        mode: AiGenerationMode.GENERATE,
        categoryId,
        count: 2,
        prompt: 'food',
      },
      'user-id',
    );

    expect(result.generatedCount).toBe(2);
    expect(result.retryAttempts).toBe(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('validates the 50-card maximum and allows list mode without count', async () => {
    const atLimit = plainToInstance(AiRequestDto, {
      mode: AiGenerationMode.GENERATE,
      categoryId,
      count: 50,
      prompt: 'food',
      level: AiGenerationLevel.C1,
    });
    const overLimit = plainToInstance(AiRequestDto, {
      mode: AiGenerationMode.GENERATE,
      categoryId,
      count: 51,
      prompt: 'food',
      level: AiGenerationLevel.C1,
    });
    const invalidLevel = plainToInstance(AiRequestDto, {
      mode: AiGenerationMode.GENERATE,
      categoryId,
      count: 5,
      prompt: 'food',
      level: 'C3',
    });
    const listRequest = plainToInstance(AiRequestDto, {
      mode: AiGenerationMode.FROM_LIST,
      categoryId,
      words: ['apple'],
    });

    expect(await validate(atLimit)).toHaveLength(0);
    expect(
      (await validate(overLimit)).some((error) => error.property === 'count'),
    ).toBe(true);
    expect(
      (await validate(invalidLevel)).some(
        (error) => error.property === 'level',
      ),
    ).toBe(true);
    expect(await validate(listRequest)).toHaveLength(0);
  });
});

describe('AiService word explanations', () => {
  const request: ExplainWordRequestDto = {
    word: 'deleted',
    sentence: 'I accidentally deleted the important file.',
    sourceLanguage: 'uk',
    targetLanguage: 'en',
  };
  const explanation = {
    word: 'delete',
    sourceLanguage: 'uk',
    targetLanguage: 'en',
    translation: 'видаляти',
    transcription: '/dɪˈliːt/',
    explanation: 'Видаляти або стирати дані, файли чи інформацію.',
    example: 'I deleted the old files yesterday.',
    detailedExplanation:
      'Deleted — форма минулого часу дієслова delete; дія відбулася в минулому.',
  };

  it('returns a flashcard and contextual explanation without creating a card', async () => {
    const { service, create, cardService } = makeService([
      {
        choices: [{ message: { content: JSON.stringify(explanation) } }],
      },
    ]);

    const result = await service.explainWord(request);

    expect(result).toEqual({ ...explanation, originalForm: 'deleted' });
    expect(cardService.bulkCreateFromAi).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      'detailedExplanation',
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      "learner's primary language (uk)",
    );
    expect(create.mock.calls[0][0].messages[0].content).toContain(
      'language being learned',
    );
    expect(create.mock.calls[0][0].messages[1].content).toBe(
      JSON.stringify({ word: 'deleted', sentence: request.sentence }),
    );
  });

  it('rejects incomplete structured model responses', async () => {
    const { service } = makeService([
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...explanation,
                detailedExplanation: '',
              }),
            },
          },
        ],
      },
    ]);

    await expect(service.explainWord(request)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('validates word and sentence lengths', async () => {
    const valid = plainToInstance(ExplainWordRequestDto, request);
    const invalid = plainToInstance(ExplainWordRequestDto, {
      ...request,
      word: 'x'.repeat(101),
      sentence: ' ',
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'word' }),
        expect.objectContaining({ property: 'sentence' }),
      ]),
    );
  });
});
