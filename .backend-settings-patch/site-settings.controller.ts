import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  Public,
  Role,
  Roles,
  RolesGuard,
} from "../../common/auth.js";
import {
  UpdateSiteSettingsDto,
  UpdateStorySettingsDto,
} from "./site-settings.dto.js";
import { SiteSettingsService } from "./site-settings.service.js";

@ApiTags("settings")
@Controller("settings")
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Public()
  @Get()
  get() {
    return this.settings.get();
  }
}

@ApiTags("admin settings")
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin/settings")
export class AdminSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  update(@Body() dto: UpdateSiteSettingsDto) {
    return this.settings.update(dto);
  }
}

@ApiTags("story")
@Controller("story")
export class StoryController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Public() @Get() get() {
    return this.settings.getStory();
  }
}

@ApiTags("admin story")
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin/story")
export class AdminStoryController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() get() {
    return this.settings.getStory();
  }
  @Put() update(@Body() dto: UpdateStorySettingsDto) {
    return this.settings.updateStory(dto.story);
  }
}
