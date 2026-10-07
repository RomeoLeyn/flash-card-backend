import { DeepPartial, Repository } from 'typeorm';
import { AiGenerationLevel } from 'src/ai/ai-generation-level.enum';
import { Card } from './entities/card.entity';
import { CardService } from './card.service';
import { CategoryService } from '../category/category.service';

describe('CardService', () => {
  it('persists the CEFR level on AI-generated cards', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((card: DeepPartial<Card>) => card),
      save: jest.fn((cards) => Promise.resolve(cards)),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      {} as CategoryService,
    );

    await service.bulkCreateFromAi(
      [
        {
          word: 'apple',
          sourceLanguage: 'en',
          targetLanguage: 'uk',
          translation: 'яблуко',
          explanation: '',
          example: 'I ate an apple.',
          level: AiGenerationLevel.B1,
        },
      ],
      'user-id',
      'category-id',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: AiGenerationLevel.B1 }),
    );
  });

  it('deletes the requested cards only for the current user', async () => {
    const queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      {} as CategoryService,
    );
    const ids = [
      '0c6c5e5b-3d98-4bf2-9696-42b85a7ac07b',
      'c0f5e0d7-ae2b-46c9-a0ba-62726cb96e35',
    ];

    await expect(service.bulkRemove(ids, 'user-id')).resolves.toEqual({
      deleted: 2,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('id IN (:...ids)', {
      ids,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('"userId" = :userId', {
      userId: 'user-id',
    });
  });

  it('propagates database errors', async () => {
    const databaseError = new Error('Database unavailable');
    const queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockRejectedValue(databaseError),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      {} as CategoryService,
    );

    await expect(
      service.bulkRemove(['0c6c5e5b-3d98-4bf2-9696-42b85a7ac07b'], 'user-id'),
    ).rejects.toBe(databaseError);
  });
});
