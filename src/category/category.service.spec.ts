import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  describe('create', () => {
    it('creates a category without pre-reading the user or checking duplicates', async () => {
      const category = { id: 'category-id' };
      const repository = {
        create: jest.fn().mockReturnValue(category),
        save: jest.fn().mockResolvedValue(category),
        findOne: jest.fn(),
      };
      const service = new CategoryService(
        repository as unknown as Repository<Category>,
      );

      await expect(
        service.create(
          {
            name: 'English - German',
            sourceLanguage: 'en',
            targetLanguage: 'de',
          },
          'user-id',
        ),
      ).resolves.toBe(category);

      expect(repository.create).toHaveBeenCalledWith({
        name: 'English - German',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        user: { id: 'user-id' },
      });
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(category);
    });

    it('converts a unique-constraint violation into a conflict response', async () => {
      const repository = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockRejectedValue({
          driverError: { code: '23505' },
        }),
      };
      const service = new CategoryService(
        repository as unknown as Repository<Category>,
      );

      await expect(
        service.create(
          { name: 'English', sourceLanguage: 'en', targetLanguage: 'de' },
          'user-id',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reports a missing user when the foreign-key constraint fails', async () => {
      const repository = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockRejectedValue({
          driverError: { code: '23503' },
        }),
      };
      const service = new CategoryService(
        repository as unknown as Repository<Category>,
      );

      await expect(
        service.create(
          { name: 'English', sourceLanguage: 'en', targetLanguage: 'de' },
          'missing-user',
        ),
      ).rejects.toThrow('User does not exist');
    });
  });

  describe('update', () => {
    it('saves the already loaded owned category without a second read', async () => {
      const category = {
        id: 'category-id',
        user: { id: 'user-id' },
        name: 'English',
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue(category),
        save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
      };
      const service = new CategoryService(
        repository as unknown as Repository<Category>,
      );

      await expect(
        service.update('category-id', 'user-id', {
          name: 'English - German',
          sourceLanguage: 'en',
          targetLanguage: 'de',
        }),
      ).resolves.toBe(category);

      expect(repository.findOne).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'English - German' }),
      );
    });
  });

  describe('remove', () => {
    it('deletes by category and owner in one query', async () => {
      const queryBuilder = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const repository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const service = new CategoryService(
        repository as unknown as Repository<Category>,
      );

      await expect(service.remove('category-id', 'user-id')).resolves.toEqual({
        affected: 1,
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: 'category-id',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('"userId" = :userId', {
        userId: 'user-id',
      });
      expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
    });

    it('returns not found when the category is missing or belongs to another user', async () => {
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
      const service = new CategoryService(
        repository as unknown as Repository<Category>,
      );

      await expect(
        service.remove('category-id', 'user-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
