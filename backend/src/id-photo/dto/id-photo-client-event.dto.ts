import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ID_PHOTO_CLIENT_FLOWS = ['signup', 'profile', 'admin'] as const;
export const ID_PHOTO_CLIENT_REASONS = [
  'too_small',
  'heic_decode',
  'decode',
  'camera_denied',
  'camera_unavailable',
  'load_error',
] as const;

export class IdPhotoClientEventDto {
  @IsIn(ID_PHOTO_CLIENT_REASONS)
  reason!: (typeof ID_PHOTO_CLIENT_REASONS)[number];

  @IsIn(ID_PHOTO_CLIENT_FLOWS)
  flow!: (typeof ID_PHOTO_CLIENT_FLOWS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mimeType?: string;
}
