import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LiquidationLineInputDto {
  @ApiProperty({ example: 'Meals — team building' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 1200.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ required: false, example: 'Meals' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  orVoucherNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class SaveLiquidationLinesDto {
  @ApiProperty({ required: false, description: 'Notes on the liquidation report' })
  @IsOptional()
  @IsString()
  notation?: string;

  @ApiProperty({ type: [LiquidationLineInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiquidationLineInputDto)
  lines!: LiquidationLineInputDto[];
}
