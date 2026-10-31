import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveReviewDateColumns1793300000002 implements MigrationInterface {
  name = 'RemoveReviewDateColumns1793300000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'card'
            AND column_name = 'nextReviewDate'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'card'
            AND column_name = 'fsrsDue'
        ) THEN
          ALTER TABLE "card" RENAME COLUMN "nextReviewDate" TO "fsrsDue";
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "card" DROP COLUMN IF EXISTS "lastReviewedAt"`,
    );
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'This migration removes the last-review timestamp. Restore a database backup instead.',
      ),
    );
  }
}
