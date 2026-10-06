import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CardService } from 'src/card/card.service';
import { CategoryService } from 'src/category/category.service';
import { AiGenerationMode } from './ai-generation-mode.enum';
import { AiFlashCardDto } from './dto/ai-flash-card.dto';
import { AiRequestDto } from './dto/ai-request.dto';
import { AiService } from './ai.service';

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
    const { service, create } = makeService([
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
      },
      'user-id',
    );

    expect(result.requestedCount).toBe(3);
    expect(result.generatedCount).toBe(3);
    expect(result.retryAttempts).toBe(2);
    expect(create).toHaveBeenCalledTimes(3);
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
    });
    const overLimit = plainToInstance(AiRequestDto, {
      mode: AiGenerationMode.GENERATE,
      categoryId,
      count: 51,
      prompt: 'food',
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
    expect(await validate(listRequest)).toHaveLength(0);
  });
});
