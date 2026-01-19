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

  @IsEnum(CheckInMethod)
  @IsOptional()
  method?: CheckInMethod;
}

