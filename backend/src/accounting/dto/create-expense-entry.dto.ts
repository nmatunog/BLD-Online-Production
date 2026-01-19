import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseEntryDto {
  @ApiProperty({
    description: 'Description of the expense entry',
    example: 'Venue rental fee',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Amount paid',
    example: 2000.00,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    description: 'Category of expense',
    example: 'Venue',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Date when expense was paid',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

