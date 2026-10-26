import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MemberCardStatus } from '@prisma/client';

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
  @IsEnum(MemberCardStatus)
  status?: MemberCardStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
