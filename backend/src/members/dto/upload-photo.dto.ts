import { IsOptional, IsString } from 'class-validator';

export class UploadPhotoDto {
  /** JPEG/PNG data URL from the client cropper (used when not sending multipart). */
  @IsOptional()
  @IsString()
  photoDataUrl?: string;
}
