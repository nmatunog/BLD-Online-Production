import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { EventStatus } from '@prisma/client';

export class AttendanceQueryDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  communityId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  eventStatus?: EventStatus;

  @IsOptional()
  @IsString()
  sortBy?: 'checkedInAt' | 'memberName' | 'eventTitle';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

