import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CashReleaseType } from '@prisma/client';

export class UpdateMonitoredDisbursementDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  disbursedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  payeeName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notation?: string;

  @ApiProperty({ required: false, enum: CashReleaseType })
  @IsOptional()
  @IsEnum(CashReleaseType)
  releaseType?: CashReleaseType;
}
