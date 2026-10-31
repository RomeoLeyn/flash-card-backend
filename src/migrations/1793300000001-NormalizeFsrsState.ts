import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeFsrsState1793300000001 implements MigrationInterface {
  name = 'NormalizeFsrsState1793300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "card"
        ADD COLUMN IF NOT EXISTS "fsrsStability" double precision,
        ADD COLUMN IF NOT EXISTS "fsrsDifficulty" double precision,
        ADD COLUMN IF NOT EXISTS "fsrsStatus" smallint,
        ADD COLUMN IF NOT EXISTS "fsrsElapsedDays" integer,
        ADD COLUMN IF NOT EXISTS "fsrsLearningSteps" integer,
        ADD COLUMN IF NOT EXISTS "fsrsLapses" integer
    `);

    await queryRunner.query(`
      UPDATE "card"
      SET "fsrsStability" = NULLIF("fsrsState" ->> 'stability', '')::double precision,
          "fsrsDifficulty" = NULLIF("fsrsState" ->> 'difficulty', '')::double precision,
          "fsrsStatus" = NULLIF("fsrsState" ->> 'state', '')::smallint,
          "fsrsElapsedDays" = NULLIF("fsrsState" ->> 'elapsed_days', '')::integer,
          "fsrsLearningSteps" = NULLIF("fsrsState" ->> 'learning_steps', '')::integer,
          "fsrsLapses" = NULLIF("fsrsState" ->> 'lapses', '')::integer,
          "interval" = COALESCE(NULLIF("fsrsState" ->> 'scheduled_days', '')::integer, "interval"),
          "repetitions" = COALESCE(NULLIF("fsrsState" ->> 'reps', '')::integer, "repetitions"),
          "nextReviewDate" = COALESCE(NULLIF("fsrsState" ->> 'due', '')::timestamptz, "nextReviewDate"),
          "lastReviewedAt" = COALESCE(NULLIF("fsrsState" ->> 'last_review', '')::timestamptz, "lastReviewedAt")
      WHERE "fsrsState" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "review_log"
       ALTER COLUMN "easeFactorBefore" DROP NOT NULL,
       ALTER COLUMN "easeFactorAfter" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "card"
       DROP COLUMN IF EXISTS "fsrsState",
       DROP COLUMN IF EXISTS "easeFactor"`,
    );
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'This migration removes the JSON FSRS state and legacy ease factor. Restore a database backup instead.',
      ),
    );
  }
}
