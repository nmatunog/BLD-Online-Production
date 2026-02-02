import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdjustmentEntryDto {
  @ApiProperty({
    description: 'Description of the adjustment entry',
    example: 'Balance correction',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Adjustment amount (positive or negative)',
    example: -100.00,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    description: 'Date when adjustment was made',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  adjustedAt?: string;

  @ApiProperty({
    description: 'Remarks (max 5 words)',
    example: 'Correction for error',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'OR/ Voucher Number',
    example: 'OR-20240119-12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  orVoucherNumber?: string;
}
