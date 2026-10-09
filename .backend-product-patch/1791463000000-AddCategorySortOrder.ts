import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCategorySortOrder1791463000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "categories" ADD COLUMN "sortOrder" integer NOT NULL DEFAULT 0`); await q.query(`WITH ranked AS (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "section" ORDER BY "createdAt") - 1 AS position FROM "categories") UPDATE "categories" c SET "sortOrder" = ranked.position FROM ranked WHERE c."id" = ranked."id"`); }
  async down(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "categories" DROP COLUMN "sortOrder"`); }
}
