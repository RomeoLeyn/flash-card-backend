import { EntityManager, Repository } from 'typeorm';
import { Card } from 'src/card/entities/card.entity';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';
import { ReviewLog } from './entities/review.entity';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  describe('getDueCards', () => {
    it('applies the requested category and card limit in the query', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      const cardRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const service = new ReviewService(
        {} as Repository<ReviewLog>,
        cardRepo as unknown as Repository<Card>,
      );

      await expect(
        service.getDueCards('user-id', {
          categoryId: 'category-id',
          limit: 16,
        }),
      ).resolves.toEqual([]);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'card.categoryId = :categoryId',
        { categoryId: 'category-id' },
      );
      expect(queryBuilder.take).toHaveBeenCalledWith(16);
    });
  });

  describe('getStats', () => {
    it('gets all card counts in one aggregate query and runs it with review counts', async () => {
      const cardQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          dueCount: '3',
          leechCount: '2',
          totalCards: '9',
        }),
      };
      const reviewQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(4),
      };
      const cardRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(cardQueryBuilder),
      };
      const reviewLogRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(reviewQueryBuilder),
      };
      const service = new ReviewService(
        reviewLogRepo as unknown as Repository<ReviewLog>,
        cardRepo as unknown as Repository<Card>,
      );

      await expect(service.getStats('user-id')).resolves.toEqual({
        dueCount: 3,
        leechCount: 2,
        totalCards: 9,
        reviewedToday: 4,
      });

      expect(cardRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(cardQueryBuilder.addSelect).toHaveBeenCalledTimes(2);
      expect(reviewLogRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    });
  });

  describe('reviewCard', () => {
    it('saves the review log and card update in one transaction', async () => {
      const card = {
        id: 'card-id',
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        isLeech: false,
      } as Card;
      const cardQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(card),
      };
      const cardRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(cardQueryBuilder),
        save: jest.fn().mockImplementation((value: Card) => value),
      };
      const reviewLogRepository = {
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((value: Partial<ReviewLog>) => value),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const manager = {
        getRepository: jest.fn((entity: typeof Card | typeof ReviewLog) =>
          entity === Card ? cardRepository : reviewLogRepository,
        ),
      };
      const transaction = jest.fn(
        (callback: (manager: EntityManager) => Promise<Card>) =>
          callback(manager as unknown as EntityManager),
      );
      const cardRepo = {
        manager: { transaction },
      };
      const service = new ReviewService(
        {} as Repository<ReviewLog>,
        cardRepo as unknown as Repository<Card>,
      );

      await expect(
        service.reviewCard(card.id, 'user-id', ReviewQuality.GOOD),
      ).resolves.toBe(card);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(cardQueryBuilder.where).toHaveBeenCalledWith(
        'card.id = :cardId AND card.userId = :userId',
        { cardId: card.id, userId: 'user-id' },
      );
      expect(cardQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['card'],
      );
      expect(reviewLogRepository.save).toHaveBeenCalledTimes(1);
      expect(cardRepository.save).toHaveBeenCalledWith(card);
    });
  });
});
