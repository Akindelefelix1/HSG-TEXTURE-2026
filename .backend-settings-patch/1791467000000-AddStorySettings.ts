import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStorySettings1791467000000 implements MigrationInterface {
  name = "AddStorySettings1791467000000";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "site_settings" ADD "story" jsonb');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "site_settings" DROP COLUMN "story"');
  }
}
