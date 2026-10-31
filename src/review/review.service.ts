import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewLog } from './entities/review.entity';
import { Card } from 'src/card/entities/card.entity';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';
import { CardSortBy, SortOrder } from 'src/common/enums/sort-order.enum';
import {
  Card as FsrsCard,
  createEmptyCard,
  fsrs,
  Grade,
  Rating,
  State,
  TypeConvert,
} from 'ts-fsrs';

export interface SrsUpdateResult {
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
  isLeech: boolean;
  fsrsCard: FsrsCard;
  stability: number;
  difficulty: number;
  status: State;
  elapsedDays: number;
  learningSteps: number;
  lapses: number;
}

const LEECH_THRESHOLD = 5;
const scheduler = fsrs({ enable_fuzz: false });

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(ReviewLog)
    private readonly reviewLogRepo: Repository<ReviewLog>,
    @InjectRepository(Card)
    private readonly cardRepo: Repository<Card>,
  ) {}

  calculateSrsUpdate(
    card: Pick<
      Card,
      | 'interval'
      | 'repetitions'
      | 'nextReviewDate'
      | 'fsrsStability'
      | 'fsrsDifficulty'
      | 'fsrsStatus'
      | 'fsrsElapsedDays'
      | 'fsrsLearningSteps'
      | 'fsrsLapses'
    >,
    quality: ReviewQuality,
    consecutiveAgainCount: number,
    lastReviewedAt: Date | null,
    now = new Date(),
  ): SrsUpdateResult {
    const fsrsCard = this.getFsrsCard(card, lastReviewedAt, now);
    const result = scheduler.next(fsrsCard, now, this.toFsrsGrade(quality));
    const interval = result.card.scheduled_days;
    const repetitions = result.card.reps;

    const isLeech =
      this.isAgainQuality(quality) &&
      consecutiveAgainCount + 1 >= LEECH_THRESHOLD;

    return {
      interval,
      repetitions,
      nextReviewDate: result.card.due,
      isLeech,
      fsrsCard: result.card,
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      status: result.card.state,
      elapsedDays: result.card.elapsed_days,
      learningSteps: result.card.learning_steps,
      lapses: result.card.lapses,
    };
  }

  private toFsrsGrade(quality: ReviewQuality): Grade {
    switch (quality) {
      case ReviewQuality.AGAIN:
      case ReviewQuality.BAD:
        return Rating.Again;
      case ReviewQuality.HARD:
        return Rating.Hard;
      case ReviewQuality.GOOD:
        return Rating.Good;
      case ReviewQuality.EASY:
      case ReviewQuality.PERFECT:
        return Rating.Easy;
    }
  }

  private isAgainQuality(quality: ReviewQuality): boolean {
    return quality === ReviewQuality.AGAIN || quality === ReviewQuality.BAD;
  }

  private getFsrsCard(
    card: Pick<
      Card,
      | 'interval'
      | 'repetitions'
      | 'nextReviewDate'
      | 'fsrsStability'
      | 'fsrsDifficulty'
      | 'fsrsStatus'
      | 'fsrsElapsedDays'
      | 'fsrsLearningSteps'
      | 'fsrsLapses'
    >,
    lastReviewedAt: Date | null,
    now: Date,
  ): FsrsCard {
    if (card.fsrsStability === null || card.fsrsStability === undefined) {
      return createEmptyCard(now);
    }

    return TypeConvert.card({
      due: card.nextReviewDate ?? now,
      stability: card.fsrsStability,
      difficulty: card.fsrsDifficulty ?? 5,
      elapsed_days: card.fsrsElapsedDays ?? 0,
      scheduled_days: card.interval,
      learning_steps: card.fsrsLearningSteps ?? 0,
      reps: card.repetitions,
      lapses: card.fsrsLapses ?? 0,
      state: card.fsrsStatus ?? State.New,
      last_review: lastReviewedAt,
    });
  }

  private async getRecentReviewState(
    cardId: string,
    reviewLogRepo: Repository<ReviewLog> = this.reviewLogRepo,
  ): Promise<{ consecutiveAgainCount: number; lastReviewedAt: Date | null }> {
    const recentLogs = await reviewLogRepo.find({
      where: { card: { id: cardId } },
      order: { reviewedAt: 'DESC' },
      take: LEECH_THRESHOLD,
    });

    let count = 0;
    for (const log of recentLogs) {
      if (
        log.quality === ReviewQuality.BAD ||
        log.quality === ReviewQuality.AGAIN
      ) {
        count++;
      } else {
        break;
      }
    }
    return {
      consecutiveAgainCount: count,
      lastReviewedAt: recentLogs[0]?.reviewedAt ?? null,
    };
  }

  async reviewCard(
    cardId: string,
    userId: string,
    quality: ReviewQuality,
  ): Promise<Card> {
    return this.cardRepo.manager.transaction(async (manager) => {
      const cardRepository = manager.getRepository(Card);
      const reviewLogRepository = manager.getRepository(ReviewLog);
      const currentCard = await cardRepository
        .createQueryBuilder('card')
        .leftJoinAndSelect('card.category', 'category')
        .addSelect('card.fsrsStability')
        .addSelect('card.fsrsDifficulty')
        .addSelect('card.fsrsStatus')
        .addSelect('card.fsrsElapsedDays')
        .addSelect('card.fsrsLearningSteps')
        .addSelect('card.fsrsLapses')
        .where('card.id = :cardId AND card.userId = :userId', {
          cardId,
          userId,
        })
        .setLock('pessimistic_write', undefined, ['card'])
        .getOne();

      if (!currentCard) {
        throw new NotFoundException('Card not found');
      }

      const { consecutiveAgainCount, lastReviewedAt } =
        await this.getRecentReviewState(currentCard.id, reviewLogRepository);
      const now = new Date();

      const result = this.calculateSrsUpdate(
        currentCard,
        quality,
        consecutiveAgainCount,
        currentCard.fsrsStability === null ? null : lastReviewedAt,
        now,
      );

      await reviewLogRepository.save(
        reviewLogRepository.create({
          card: currentCard,
          quality,
          intervalBefore: currentCard.interval,
          intervalAfter: result.interval,
          easeFactorBefore: null,
          easeFactorAfter: null,
          repetitionsAfter: result.repetitions,
        }),
      );

      currentCard.interval = result.interval;
      currentCard.repetitions = result.repetitions;
      currentCard.fsrsStability = result.stability;
      currentCard.fsrsDifficulty = result.difficulty;
      currentCard.fsrsStatus = result.status;
      currentCard.fsrsElapsedDays = result.elapsedDays;
      currentCard.fsrsLearningSteps = result.learningSteps;
      currentCard.fsrsLapses = result.lapses;
      currentCard.nextReviewDate = result.nextReviewDate;
      currentCard.isLeech = result.isLeech;

      return cardRepository.save(currentCard);
    });
  }

  async getDueCards(
    userId: string,
    options: {
      categoryId?: string;
      sortBy?: CardSortBy;
      sortOrder?: SortOrder;
      limit?: number;
    },
  ): Promise<Card[]> {
    const sortBy = options.sortBy || CardSortBy.NEXT_REVIEW_DATE;
    const sortOrder = options.sortOrder || SortOrder.ASC;

    const qb = this.cardRepo
      .createQueryBuilder('card')
      .leftJoinAndSelect('card.category', 'category')
      .where('card.userId = :userId', { userId })
      .andWhere(
        '(card.fsrsStability IS NULL OR card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())',
      );

    if (options.categoryId) {
      qb.andWhere('card.categoryId = :categoryId', {
        categoryId: options.categoryId,
      });
    }

    if (options.limit) {
      qb.take(options.limit);
    }

    if (sortBy === CardSortBy.LAST_REVIEWED_AT) {
      qb.orderBy(
        '(SELECT MAX("reviewLog"."reviewedAt") FROM "review_log" "reviewLog" WHERE "reviewLog"."cardId" = "card"."id")',
        sortOrder,
        'NULLS LAST',
      );
    } else {
      qb.orderBy(`card.${sortBy}`, sortOrder, 'NULLS FIRST');
    }

    return qb.getMany();
  }

  async getStats(userId: string) {
    const [cardStats, reviewedToday] = await Promise.all([
      this.cardRepo
        .createQueryBuilder('card')
        .select(
          'COUNT(*) FILTER (WHERE card.fsrsStability IS NULL OR card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())',
          'dueCount',
        )
        .addSelect('COUNT(*) FILTER (WHERE card.isLeech = true)', 'leechCount')
        .addSelect('COUNT(*)', 'totalCards')
        .where('card.userId = :userId', { userId })
        .getRawOne<{
          dueCount: string;
          leechCount: string;
          totalCards: string;
        }>(),
      this.reviewLogRepo
        .createQueryBuilder('log')
        .innerJoin('log.card', 'card')
        .where('card.userId = :userId', { userId })
        .andWhere("log.reviewedAt >= NOW() - INTERVAL '24 hours'")
        .getCount(),
    ]);

    return {
      dueCount: Number(cardStats?.dueCount ?? 0),
      leechCount: Number(cardStats?.leechCount ?? 0),
      totalCards: Number(cardStats?.totalCards ?? 0),
      reviewedToday,
    };
  }
}
