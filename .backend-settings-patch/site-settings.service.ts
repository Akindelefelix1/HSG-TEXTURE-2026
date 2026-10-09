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
export const defaultStorySettings = {
  eyebrow: "Our story",
  title: "Fabric is where every great idea begins.",
  intro:
    "HSG Texture brings the discovery and delight of a great fabric market into a calm, considered shopping experience.",
  paragraphOne:
    "We started with a simple belief: choosing fabric should feel as inspiring as wearing the finished piece. So we source in small, intentional edits—prioritising beautiful hand-feel, dependable quality and colours that come alive in natural light.",
  paragraphTwo:
    "From heritage occasion cloth to easy linens and statement prints, our collection is made for designers, tailors, stylists and curious first-time makers.",
  valuesEyebrow: "What guides us",
  values: [
    {
      id: "story-value-1",
      number: "01",
      title: "Quality in the hand",
      description:
        "We choose fabrics by touch, drape and durability—not just appearance.",
    },
    {
      id: "story-value-2",
      number: "02",
      title: "Heritage, kept alive",
      description:
        "We champion textiles and techniques with stories worth carrying forward.",
    },
    {
      id: "story-value-3",
      number: "03",
      title: "Service, person to person",
      description:
        "Thoughtful help from people who know fabric and respect your vision.",
    },
  ],
  collageMediaIds: [],
  collageMedia: [],
  feedbackEyebrow: "From our customers",
  feedbackTitle: "Worn, loved and remembered.",
  feedbackIntro:
    "Real stories from customers who chose HSG Texture for moments that matter.",
  feedback: [],
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

  async getStory() {
    const record = await this.record();
    const story = {
      ...defaultStorySettings,
      ...record.story,
    } as Record<string, unknown>;
    const collageMedia =
      (story.collageMedia as
        | Array<{ key: string; name: string; type: string } | null>
        | undefined) ?? [];
    const feedback =
      (story.feedback as
        | Array<Record<string, unknown> & { mediaKey?: string }>
        | undefined) ?? [];
    return {
      ...story,
      collageMedia: collageMedia.map((media) =>
        media
          ? { ...media, url: this.storage.createReadUrl(media.key).url }
          : null,
      ),
      feedback: feedback.map((item) => ({
        ...item,
        mediaUrl: item.mediaKey
          ? this.storage.createReadUrl(item.mediaKey).url
          : undefined,
      })),
    };
  }

  async updateStory(story: Record<string, unknown>) {
    const current = await this.record();
    const oldStory = (current.story ?? {}) as Record<string, unknown>;
    const collectKeys = (value: Record<string, unknown>) =>
      [
        ...(
          (value.collageMedia as Array<{ key?: string } | null> | undefined) ??
          []
        ).map((item) => item?.key),
        ...(
          (value.feedback as Array<{ mediaKey?: string }> | undefined) ?? []
        ).map((item) => item.mediaKey),
      ].filter((key): key is string => Boolean(key));
    const previousKeys = collectKeys(oldStory);
    const clean = JSON.parse(JSON.stringify(story)) as Record<string, unknown>;
    for (const media of (clean.collageMedia as
      | Array<{ url?: string } | null>
      | undefined) ?? [])
      if (media) delete media.url;
    for (const item of (clean.feedback as
      | Array<{ mediaUrl?: string }>
      | undefined) ?? [])
      delete item.mediaUrl;
    current.story = { ...defaultStorySettings, ...clean };
    await this.settings.save(current);
    const nextKeys = collectKeys(clean);
    await Promise.all(
      previousKeys
        .filter((key) => !nextKeys.includes(key))
        .map((key) => this.storage.remove(key).catch(() => undefined)),
    );
    return this.getStory();
  }
}
