import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddProductDetails1791464000000 implements MigrationInterface {
  async up(q:QueryRunner):Promise<void>{await q.query(`ALTER TABLE "products" ADD COLUMN "composition" varchar, ADD COLUMN "width" varchar, ADD COLUMN "feel" varchar, ADD COLUMN "care" varchar`)}
  async down(q:QueryRunner):Promise<void>{await q.query(`ALTER TABLE "products" DROP COLUMN "care", DROP COLUMN "feel", DROP COLUMN "width", DROP COLUMN "composition"`)}
}
