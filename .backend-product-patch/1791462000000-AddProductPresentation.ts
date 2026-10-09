import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddProductPresentation1791462000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "products" ADD COLUMN "color" varchar NOT NULL DEFAULT '#183b8f', ADD COLUMN "texture" varchar NOT NULL DEFAULT 'woven', ADD COLUMN "badge" varchar`); }
  async down(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "products" DROP COLUMN "badge", DROP COLUMN "texture", DROP COLUMN "color"`); }
}
