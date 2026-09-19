import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExampleToCard1788698008437 implements MigrationInterface {
  name = 'AddExampleToCard1788698008437';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "card" ADD "example" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "card" DROP COLUMN "example"`);
  }
}
