import { IsOptional, IsString } from "class-validator";

export class UpdateSiteSettingsDto {
  @IsOptional() @IsString() announcement?: string;
  @IsOptional() @IsString() heroEyebrow?: string;
  @IsOptional() @IsString() heroTitle?: string;
  @IsOptional() @IsString() heroAccent?: string;
  @IsOptional() @IsString() heroDescription?: string;
  @IsOptional() @IsString() primaryLabel?: string;
  @IsOptional() @IsString() primaryHref?: string;
  @IsOptional() @IsString() secondaryLabel?: string;
  @IsOptional() @IsString() secondaryHref?: string;
  @IsOptional() @IsString() trustOne?: string;
  @IsOptional() @IsString() trustTwo?: string;
  @IsOptional() @IsString() imageNote?: string;
  @IsOptional() @IsString() heroImageKey?: string;
}
