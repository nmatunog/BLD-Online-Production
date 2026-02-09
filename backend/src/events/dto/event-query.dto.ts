import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { EventStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class EventQueryDto {
  /** Admin/Super User: include all ministry-specific events (e.g. all WSC). Default: general + user's ministry only. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeAllMinistryEvents?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string; // startDate, createdAt, title

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

