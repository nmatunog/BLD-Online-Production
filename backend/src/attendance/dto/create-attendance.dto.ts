import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { CheckInMethod } from '@prisma/client';

export class CreateAttendanceDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;

  @IsString()
  @IsNotEmpty()
  eventId!: string;

  /** Legacy single check-in uses "". Multi-session events use YYYY-MM-DD_AM / _PM (Manila). */
  @IsString()
  @IsOptional()
  sessionSlot?: string;

  @IsEnum(CheckInMethod)
  @IsOptional()
  method?: CheckInMethod;
}

