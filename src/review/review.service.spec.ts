import { EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Card } from 'src/card/entities/card.entity';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';
import { ReviewCardDto } from 'src/card/dto/review-card.dto';
import { createEmptyCard, fsrs, Grade, Rating } from 'ts-fsrs';
import { ReviewLog } from './entities/review.entity';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  describe('review rating validation', () => {
    it.each(Object.values(ReviewQuality))(
      'accepts the %s rating',
      async (quality) => {
        const dto = plainToInstance(ReviewCardDto, { quality });

        await expect(validate(dto)).resolves.toHaveLength(0);
      },
    );
  });

  describe('calculateSrsUpdate', () => {
    const ratings: [ReviewQuality, Grade][] = [
      [ReviewQuality.AGAIN, Rating.Again],
      [ReviewQuality.HARD, Rating.Hard],
      [ReviewQuality.GOOD, Rating.Good],
      [ReviewQuality.EASY, Rating.Easy],
      [ReviewQuality.BAD, Rating.Again],
      [ReviewQuality.PERFECT, Rating.Easy],
    ];

    it.each(ratings)('uses the FSRS grade for %s', (quality, rating) => {
      const service = new ReviewService(
        {} as Repository<ReviewLog>,
        {} as Repository<Card>,
      );
      const now = new Date('2026-10-29T12:00:00.000Z');
      const card = {
        interval: 0,
        repetitions: 0,
        nextReviewDate: null,
        fsrsStability: null,
        fsrsDifficulty: null,
        fsrsStatus: null,
        fsrsElapsedDays: null,
        fsrsLearningSteps: null,
        fsrsLapses: null,
      };
      const result = service.calculateSrsUpdate(card, quality, 0, null, now);
      const expected = fsrs({ enable_fuzz: false }).next(
        createEmptyCard(now),
        now,
        rating,
      ).card;

      expect(result.fsrsCard).toEqual(expected);
      expect(result.nextReviewDate).toEqual(expected.due);
      expect(result.interval).toBe(expected.scheduled_days);
      expect(result.repetitions).toBe(expected.reps);
    });

    it('starts fresh instead of importing the legacy schedule', () => {
      const service = new ReviewService(
        {} as Repository<ReviewLog>,
        {} as Repository<Card>,
      );
      const now = new Date('2026-10-29T12:00:00.000Z');
      const card = {
        interval: 42,
        repetitions: 12,
        nextReviewDate: new Date('2026-11-01T12:00:00.000Z'),
        fsrsStability: null,
        fsrsDifficulty: null,
        fsrsStatus: null,
        fsrsElapsedDays: null,
        fsrsLearningSteps: null,
        fsrsLapses: null,
      };

      const result = service.calculateSrsUpdate(
        card,
        ReviewQuality.GOOD,
        0,
        null,
        now,
      );
      const expected = fsrs({ enable_fuzz: false }).next(
        createEmptyCard(now),
        now,
        Rating.Good,
      ).card;

      expect(result.fsrsCard).toEqual(expected);
    });

    it('reconstructs the FSRS card from normalized columns', () => {
      const service = new ReviewService(
        {} as Repository<ReviewLog>,
        {} as Repository<Card>,
      );
      const reviewedAt = new Date('2026-10-28T12:00:00.000Z');
      const due = new Date('2026-10-29T12:00:00.000Z');
      const now = new Date('2026-10-29T13:00:00.000Z');
      const previousState = fsrs({ enable_fuzz: false }).next(
        createEmptyCard(reviewedAt),
        reviewedAt,
        Rating.Good,
      ).card;
      const card = {
        interval: previousState.scheduled_days,
        repetitions: previousState.reps,
        nextReviewDate: due,
        fsrsStability: previousState.stability,
        fsrsDifficulty: previousState.difficulty,
        fsrsStatus: previousState.state,
        fsrsElapsedDays: previousState.elapsed_days,
        fsrsLearningSteps: previousState.learning_steps,
        fsrsLapses: previousState.lapses,
      };

      const result = service.calculateSrsUpdate(
        card,
        ReviewQuality.HARD,
        0,
        previousState.last_review ?? reviewedAt,
        now,
      );
      const expected = fsrs({ enable_fuzz: false }).next(
        {
          ...previousState,
          due,
        },
        now,
        Rating.Hard,
      ).card;

      expect(result.fsrsCard).toEqual(expected);
    });
  });

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
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(card.fsrsStability IS NULL OR card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())',
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
        isLeech: false,
        nextReviewDate: null,
        fsrsStability: null,
        fsrsDifficulty: null,
        fsrsStatus: null,
        fsrsElapsedDays: null,
        fsrsLearningSteps: null,
        fsrsLapses: null,
      } as Card;
      const cardQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
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
