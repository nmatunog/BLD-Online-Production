import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class IssueCardsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

export class IssueForWriteDto {
  @IsUUID('4')
  memberId!: string;
}

export class CheckInByCardDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsOptional()
  @IsString()
  sessionSlot?: string;
}
