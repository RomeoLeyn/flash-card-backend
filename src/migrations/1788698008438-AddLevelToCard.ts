import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLevelToCard1788698008438 implements MigrationInterface {
  name = 'AddLevelToCard1788698008438';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumResult: unknown = await queryRunner.query(
      `SELECT e.enumlabel AS label
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname = 'card_level_enum'
       ORDER BY e.enumsortorder`,
    );
    if (
      !Array.isArray(enumResult) ||
      !enumResult.every(
        (row: unknown): row is { label: string } =>
          typeof row === 'object' &&
          row !== null &&
          'label' in row &&
          typeof row.label === 'string',
      )
    ) {
      throw new Error('Could not inspect public.card_level_enum.');
    }
    const enumRows = enumResult;
    const expectedLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    if (enumRows.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."card_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
      );
    } else if (
      enumRows.length !== expectedLevels.length ||
      enumRows.some((row, index) => row.label !== expectedLevels[index])
    ) {
      throw new Error(
        'The existing public.card_level_enum type does not contain the expected CEFR values.',
      );
    }

    const columnResult: unknown = await queryRunner.query(
      `SELECT udt_schema, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'card'
           AND column_name = 'level'`,
    );
    if (
      !Array.isArray(columnResult) ||
      !columnResult.every(
        (row: unknown): row is { udt_schema: string; udt_name: string } =>
          typeof row === 'object' &&
          row !== null &&
          'udt_schema' in row &&
          typeof row.udt_schema === 'string' &&
          'udt_name' in row &&
          typeof row.udt_name === 'string',
      )
    ) {
      throw new Error('Could not inspect public.card.level.');
    }
    const columns = columnResult;

    if (columns.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "public"."card" ADD "level" "public"."card_level_enum"`,
      );
    } else if (
      columns[0].udt_schema !== 'public' ||
      columns[0].udt_name !== 'card_level_enum'
    ) {
      throw new Error(
        'The existing public.card.level column does not use public.card_level_enum.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "card" DROP COLUMN "level"`);
    await queryRunner.query(`DROP TYPE "public"."card_level_enum"`);
  }
}
