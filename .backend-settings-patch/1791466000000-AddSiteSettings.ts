import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSiteSettings1791466000000 implements MigrationInterface {
  name = "AddSiteSettings1791466000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_settings" (
        "id" character varying NOT NULL DEFAULT 'storefront',
        "content" jsonb NOT NULL,
        "heroImageKey" character varying,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "site_settings" ("id", "content") VALUES (
        'storefront',
        '{"announcement":"Same-day or next-day delivery is available, depending on when your order is placed and the delivery location.","heroEyebrow":"The new textile edit","heroTitle":"Find the fabric.","heroAccent":"Make it yours.","heroDescription":"Quality fabrics for every occasion.","primaryLabel":"Shop new arrivals","primaryHref":"/products?filter=new","secondaryLabel":"Explore collections","secondaryHref":"/category","trustOne":"Nationwide delivery","trustTwo":"Curated quality","imageNote":"Texture you can almost feel"}'::jsonb
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "site_settings"');
  }
}
