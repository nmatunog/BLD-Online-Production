import { IsString, IsNotEmpty } from 'class-validator';

export class CheckInQrDto {
  @IsString()
  @IsNotEmpty({ message: 'Community ID is required' })
  communityId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Event ID is required' })
  eventId!: string;
}
