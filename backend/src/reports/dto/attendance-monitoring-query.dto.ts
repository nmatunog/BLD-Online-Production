import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AttendanceMonitoringQueryDto {
  @ApiProperty({ example: 2026, description: 'Calendar year in Asia/Manila' })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({
    required: false,
    example: 10,
    description: 'Month 1–12 in Asia/Manila. Omit for the full year.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ required: false, example: 'Intercessory Ministry' })
  @IsOptional()
  @IsString()
  ministry?: string;
}

export class AttendanceMonitoringExportQueryDto extends AttendanceMonitoringQueryDto {
  @ApiProperty({ enum: ['xlsx', 'csv'], required: false, default: 'xlsx' })
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}
