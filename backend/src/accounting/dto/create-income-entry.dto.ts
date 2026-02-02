import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIncomeEntryDto {
  @ApiProperty({
    description: 'Description of the income entry',
    example: 'Registration fees from participants',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Amount received',
    example: 5000.00,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    description: 'Source of income',
    example: 'Registration Fees',
    required: false,
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    description: 'Date when income was received',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiProperty({
    description: 'Remarks (max 5 words)',
    example: 'Payment received early',
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

