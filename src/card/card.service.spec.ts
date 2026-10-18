import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { AiGenerationLevel } from 'src/ai/ai-generation-level.enum';
import { Card } from './entities/card.entity';
import { CardService } from './card.service';
import { CategoryService } from '../category/category.service';

describe('CardService', () => {
  it('rejects a duplicate word ignoring case and surrounding whitespace', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'existing-card' }),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    };
    const categoryService = {
      findByCategoryIdAndUserId: jest
        .fn()
        .mockResolvedValue({ id: 'category-id' }),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      categoryService as unknown as CategoryService,
    );

    await expect(
      service.create(
        {
          word: '  DELETE ',
          sourceLanguage: 'uk',
          targetLanguage: 'en',
          translation: 'видаляти',
          categoryId: 'category-id',
        },
        'user-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(TRIM(card.word)) = LOWER(TRIM(:word))',
      { word: '  DELETE ' },
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('creates a card when no duplicate exists', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const card = { id: 'new-card' };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn().mockReturnValue(card),
      save: jest.fn().mockResolvedValue(card),
    };
    const categoryService = {
      findByCategoryIdAndUserId: jest
        .fn()
        .mockResolvedValue({ id: 'category-id' }),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      categoryService as unknown as CategoryService,
    );

    await expect(
      service.create(
        {
          word: 'delete',
          sourceLanguage: 'uk',
          targetLanguage: 'en',
          translation: 'видаляти',
          categoryId: 'category-id',
        },
        'user-id',
      ),
    ).resolves.toBe(card);
    expect(repository.save).toHaveBeenCalledWith(card);
  });

  it('converts a database unique-constraint race into a conflict response', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn((value: DeepPartial<Card>) => value),
      save: jest.fn().mockRejectedValue({
        driverError: { code: '23505' },
      }),
    };
    const categoryService = {
      findByCategoryIdAndUserId: jest
        .fn()
        .mockResolvedValue({ id: 'category-id' }),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      categoryService as unknown as CategoryService,
    );

    await expect(
      service.create(
        {
          word: 'delete',
          sourceLanguage: 'uk',
          targetLanguage: 'en',
          translation: 'видаляти',
          categoryId: 'category-id',
        },
        'user-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

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

  it('deletes a card for the current user without loading it first', async () => {
    const queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      {} as CategoryService,
    );

    await expect(service.remove('card-id', 'user-id')).resolves.toBeUndefined();
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :id', {
      id: 'card-id',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('"userId" = :userId', {
      userId: 'user-id',
    });
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('returns not found when the card is missing or belongs to another user', async () => {
    const queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new CardService(
      repository as unknown as Repository<Card>,
      {} as CategoryService,
    );

    await expect(service.remove('card-id', 'user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
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
