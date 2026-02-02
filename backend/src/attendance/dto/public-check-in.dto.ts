import { IsString, IsNotEmpty } from 'class-validator';

export class PublicCheckInDto {
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @IsString()
  @IsNotEmpty()
  eventId!: string;
}
