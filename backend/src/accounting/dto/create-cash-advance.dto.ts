import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CashReleaseType } from '@prisma/client';

export class CreateCashAdvanceDto {
  @ApiProperty({ example: 5000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  disbursedAt?: string;

  @ApiProperty({ required: false, example: 'Juan Dela Cruz' })
  @IsOptional()
  @IsString()
  payeeName?: string;

  @ApiProperty({ required: false, example: 'DV-2026-001' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ required: false, description: 'Internal notes / purpose' })
  @IsOptional()
  @IsString()
  notation?: string;

  @ApiProperty({ required: false, enum: CashReleaseType, description: 'Kind of cash release' })
  @IsOptional()
  @IsEnum(CashReleaseType)
  releaseType?: CashReleaseType;
}
