import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

export type SiteSettingsContent = {
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  trustOne: string;
  trustTwo: string;
  imageNote: string;
};

@Entity("site_settings")
export class SiteSettings {
  @PrimaryColumn({ type: "varchar", default: "storefront" })
  id!: string;

  @Column({ type: "jsonb" })
  content!: SiteSettingsContent;

  @Column({ type: "varchar", nullable: true })
  heroImageKey?: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
