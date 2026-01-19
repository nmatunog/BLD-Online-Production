import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export enum ReportType {
  ATTENDANCE = 'ATTENDANCE',
  REGISTRATION = 'REGISTRATION',
  MEMBER = 'MEMBER',
  EVENT = 'EVENT',
  RECURRING_ATTENDANCE = 'RECURRING_ATTENDANCE',
}

export class ReportQueryDto {
  @ApiProperty({ enum: ReportType, description: 'Type of report to generate' })
  @IsEnum(ReportType)
  reportType!: ReportType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty({ required: false, description: 'ISO date string (YYYY-MM-DD or full ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, description: 'ISO date string (YYYY-MM-DD or full ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  encounterType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ministry?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  // Recurring attendance report fields
  @ApiProperty({ required: false, description: 'individual | ministry | community' })
  @IsOptional()
  @IsString()
  recurringReportType?: string;

  @ApiProperty({ required: false, description: 'monthly | quarterly | ytd | annual' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apostolate?: string;
}
