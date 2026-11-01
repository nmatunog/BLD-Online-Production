import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MemberCardStatus } from '@prisma/client';
import { PRINT_READY_FILTERS, type PrintReadyFilter } from '../member-card-readiness';

function toBooleanFlag(value: unknown): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

function toStringArray(value: unknown): unknown {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

export class CardQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MemberCardStatus)
  status?: MemberCardStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

export class ExportCardsDto {
  @IsOptional()
  @Transform(({ value }) => toBooleanFlag(value))
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  memberIds?: string[];

  @IsOptional()
  @IsEnum(MemberCardStatus)
  status?: MemberCardStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PRINT_READY_FILTERS)
  printReady?: PrintReadyFilter;
}

export class MemberIdsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PRINT_READY_FILTERS)
  printReady?: PrintReadyFilter;
}
