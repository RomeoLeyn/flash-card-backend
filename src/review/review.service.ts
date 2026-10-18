import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewLog } from './entities/review.entity';
import { Card } from 'src/card/entities/card.entity';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';
import { CardSortBy, SortOrder } from 'src/common/enums/sort-order.enum';

export interface SrsUpdateResult {
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReviewDate: Date;
  isLeech: boolean;
}

const MIN_EASE_FACTOR = 1.3;
const LEECH_THRESHOLD = 5;

const EASE_DELTA: Record<ReviewQuality, number> = {
  [ReviewQuality.BAD]: -0.3,
  [ReviewQuality.GOOD]: 0,
  [ReviewQuality.PERFECT]: 0.15,
};

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(ReviewLog)
    private readonly reviewLogRepo: Repository<ReviewLog>,
    @InjectRepository(Card)
    private readonly cardRepo: Repository<Card>,
  ) {}

  calculateSrsUpdate(
    card: Pick<Card, 'interval' | 'repetitions' | 'easeFactor'>,
    quality: ReviewQuality,
    consecutiveBadCount: number,
  ): SrsUpdateResult {
    let { interval, repetitions, easeFactor } = card;

    if (quality === ReviewQuality.BAD) {
      repetitions = 0;
      interval = 1;
    } else {
      repetitions += 1;

      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = quality === ReviewQuality.PERFECT ? 6 : 3;
      } else {
        interval = Math.round(interval * easeFactor);
      }
    }

    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor + EASE_DELTA[quality]);

    if (interval > 6) {
      const fuzzRange = interval * 0.08;
      const fuzz = Math.round((Math.random() * 2 - 1) * fuzzRange);
      interval = Math.max(1, interval + fuzz);
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const isLeech =
      quality === ReviewQuality.BAD &&
      consecutiveBadCount + 1 >= LEECH_THRESHOLD;

    return { interval, repetitions, easeFactor, nextReviewDate, isLeech };
  }

  private async getConsecutiveBadCount(
    cardId: string,
    reviewLogRepo: Repository<ReviewLog> = this.reviewLogRepo,
  ): Promise<number> {
    const recentLogs = await reviewLogRepo.find({
      where: { card: { id: cardId } },
      order: { reviewedAt: 'DESC' },
      take: LEECH_THRESHOLD,
    });

    let count = 0;
    for (const log of recentLogs) {
      if (log.quality === ReviewQuality.BAD) count++;
      else break;
    }
    return count;
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
        .where('card.id = :cardId AND card.userId = :userId', {
          cardId,
          userId,
        })
        .setLock('pessimistic_write', undefined, ['card'])
        .getOne();

      if (!currentCard) {
        throw new NotFoundException('Card not found');
      }

      const consecutiveBadCount = await this.getConsecutiveBadCount(
        currentCard.id,
        reviewLogRepository,
      );

      const { interval, repetitions, easeFactor, nextReviewDate, isLeech } =
        this.calculateSrsUpdate(currentCard, quality, consecutiveBadCount);

      await reviewLogRepository.save(
        reviewLogRepository.create({
          card: currentCard,
          quality,
          intervalBefore: currentCard.interval,
          intervalAfter: interval,
          easeFactorBefore: currentCard.easeFactor,
          easeFactorAfter: easeFactor,
          repetitionsAfter: repetitions,
        }),
      );

      currentCard.interval = interval;
      currentCard.repetitions = repetitions;
      currentCard.easeFactor = easeFactor;
      currentCard.nextReviewDate = nextReviewDate;
      currentCard.lastReviewedAt = new Date();
      currentCard.isLeech = isLeech;

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
        '(card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())',
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
      qb.orderBy(`card.${sortBy}`, sortOrder, 'NULLS LAST');
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
          'COUNT(*) FILTER (WHERE card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())',
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
