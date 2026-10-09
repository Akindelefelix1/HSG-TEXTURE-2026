import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StorageService } from "../storage/storage.service.js";
import { UpdateSiteSettingsDto } from "./site-settings.dto.js";
import {
  SiteSettings,
  type SiteSettingsContent,
} from "./site-settings.entity.js";

export const defaultSiteSettings: SiteSettingsContent = {
  announcement:
    "Same-day or next-day delivery is available, depending on when your order is placed and the delivery location.",
  heroEyebrow: "The new textile edit",
  heroTitle: "Find the fabric.",
  heroAccent: "Make it yours.",
  heroDescription: "Quality fabrics for every occasion.",
  primaryLabel: "Shop new arrivals",
  primaryHref: "/products?filter=new",
  secondaryLabel: "Explore collections",
  secondaryHref: "/category",
  trustOne: "Nationwide delivery",
  trustTwo: "Curated quality",
  imageNote: "Texture you can almost feel",
};

@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectRepository(SiteSettings)
    private readonly settings: Repository<SiteSettings>,
    private readonly storage: StorageService,
  ) {}

  private async record() {
    const existing = await this.settings.findOneBy({ id: "storefront" });
    if (existing) return existing;
    return this.settings.save(
      this.settings.create({
        id: "storefront",
        content: defaultSiteSettings,
      }),
    );
  }

  async get() {
    const record = await this.record();
    let heroImageUrl: string | undefined;
    if (record.heroImageKey) {
      try {
        heroImageUrl = this.storage.createReadUrl(record.heroImageKey).url;
      } catch {
        // Text settings remain available if object storage is temporarily down.
      }
    }
    return {
      ...defaultSiteSettings,
      ...record.content,
      heroImageKey: record.heroImageKey ?? undefined,
      heroImageUrl,
    };
  }

  async update(dto: UpdateSiteSettingsDto) {
    const current = await this.record();
    const previousHeroImageKey = current.heroImageKey;
    const { heroImageKey, ...content } = dto;
    current.content = {
      ...defaultSiteSettings,
      ...current.content,
      ...content,
    };
    if (heroImageKey !== undefined) current.heroImageKey = heroImageKey;
    await this.settings.save(current);
    if (
      heroImageKey &&
      previousHeroImageKey &&
      heroImageKey !== previousHeroImageKey
    ) {
      try {
        await this.storage.remove(previousHeroImageKey);
      } catch {
        // A cleanup failure must not roll back the newly saved storefront.
      }
    }
    return this.get();
  }
}
