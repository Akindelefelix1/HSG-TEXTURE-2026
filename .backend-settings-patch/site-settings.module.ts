import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StorageModule } from "../storage/storage.module.js";
import {
  AdminSiteSettingsController,
  AdminStoryController,
  SiteSettingsController,
  StoryController,
} from "./site-settings.controller.js";
import { SiteSettings } from "./site-settings.entity.js";
import { SiteSettingsService } from "./site-settings.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([SiteSettings]), StorageModule],
  controllers: [
    SiteSettingsController,
    AdminSiteSettingsController,
    StoryController,
    AdminStoryController,
  ],
  providers: [SiteSettingsService],
})
export class SiteSettingsModule {}
