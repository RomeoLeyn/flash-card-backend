import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewLog } from './entities/review.entity';
import { Card } from 'src/card/entities/card.entity';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';

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
  ) { }

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

  private async getConsecutiveBadCount(cardId: string): Promise<number> {
    const recentLogs = await this.reviewLogRepo.find({
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

  async reviewCard(card: Card, quality: ReviewQuality): Promise<Card> {
    const consecutiveBadCount = await this.getConsecutiveBadCount(card.id);

    const { interval, repetitions, easeFactor, nextReviewDate, isLeech } =
      this.calculateSrsUpdate(card, quality, consecutiveBadCount);

    await this.reviewLogRepo.save(
      this.reviewLogRepo.create({
        card,
        quality,
        intervalBefore: card.interval,
        intervalAfter: interval,
        easeFactorBefore: card.easeFactor,
        easeFactorAfter: easeFactor,
        repetitionsAfter: repetitions,
      }),
    );

    card.interval = interval;
    card.repetitions = repetitions;
    card.easeFactor = easeFactor;
    card.nextReviewDate = nextReviewDate;
    card.lastReviewedAt = new Date();
    card.isLeech = isLeech;

    return this.cardRepo.save(card);
  }

  async getDueCards(
    userId: string,
    options: { categoryId?: string },
  ): Promise<Card[]> {
    const qb = this.cardRepo
      .createQueryBuilder('card')
      .leftJoinAndSelect('card.category', 'category')
      .where('card.userId = :userId', { userId })
      .andWhere('(card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())')
      .orderBy('card.nextReviewDate', 'ASC', 'NULLS FIRST')
      .take();

    if (options.categoryId) {
      qb.andWhere('card.categoryId = :categoryId', {
        categoryId: options.categoryId,
      });
    }

    return qb.getMany();
  }

  async getStats(userId: string) {
    const [dueCount, leechCount, totalCards] = await Promise.all([
      this.cardRepo
        .createQueryBuilder('card')
        .where('card.userId = :userId', { userId })
        .andWhere(
          '(card.nextReviewDate IS NULL OR card.nextReviewDate <= NOW())',
        )
        .getCount(),
      this.cardRepo.count({ where: { user: { id: userId }, isLeech: true } }),
      this.cardRepo.count({ where: { user: { id: userId } } }),
    ]);

    const reviewedToday = await this.reviewLogRepo
      .createQueryBuilder('log')
      .innerJoin('log.card', 'card')
      .where('card.userId = :userId', { userId })
      .andWhere("log.reviewedAt >= NOW() - INTERVAL '24 hours'")
      .getCount();

    return { dueCount, leechCount, totalCards, reviewedToday };
  }
}
