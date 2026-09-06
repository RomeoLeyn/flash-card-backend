import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranscriptionToCard1788698008436 implements MigrationInterface {
  name = 'AddTranscriptionToCard1788698008436';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card" ADD "transcription" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "card" DROP COLUMN "transcription"`);
  }
}
