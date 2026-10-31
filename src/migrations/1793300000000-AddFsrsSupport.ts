import { MigrationInterface, QueryRunner } from 'typeorm';

function isEnumType(
  value: unknown,
): value is { udt_schema: string; udt_name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'udt_schema' in value &&
    typeof value.udt_schema === 'string' &&
    'udt_name' in value &&
    typeof value.udt_name === 'string'
  );
}

export class AddFsrsSupport1793300000000 implements MigrationInterface {
  name = 'AddFsrsSupport1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card" ADD COLUMN IF NOT EXISTS "fsrsState" jsonb`,
    );
    await queryRunner.query(
      `UPDATE "card"
       SET "fsrsState" = NULL,
           "interval" = 0,
           "repetitions" = 0,
           "easeFactor" = 2.5,
           "nextReviewDate" = NULL,
           "lastReviewedAt" = NULL,
           "isLeech" = false`,
    );

    const enumTypes: unknown = await queryRunner.query(
      `SELECT udt_schema, udt_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'review_log'
         AND column_name = 'quality'`,
    );
    if (
      !Array.isArray(enumTypes) ||
      enumTypes.length !== 1 ||
      !isEnumType(enumTypes[0])
    ) {
      throw new Error('Could not inspect review_log.quality enum.');
    }

    const { udt_schema: schema, udt_name: enumName } = enumTypes[0];
    const enumIdentifier = `"${schema.replaceAll('"', '""')}"."${enumName.replaceAll('"', '""')}"`;

    for (const rating of ['again', 'hard', 'easy']) {
      await queryRunner.query(
        `ALTER TYPE ${enumIdentifier} ADD VALUE IF NOT EXISTS '${rating}'`,
      );
    }
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'This migration resets legacy schedules and cannot be reversed. Restore a database backup instead.',
      ),
    );
  }
}
