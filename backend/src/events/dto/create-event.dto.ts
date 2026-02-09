import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { EventStatus } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsOptional()
  venue?: string;

  /** Ministry-specific event (e.g. Word Sharing Circle). Null = general (all members). */
  @IsString()
  @IsOptional()
  ministry?: string;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsBoolean()
  @IsOptional()
  hasRegistration?: boolean;

  @ValidateIf((o) => o.hasRegistration === true)
  @IsInt()
  @Min(0)
  @IsOptional()
  registrationFee?: number;

  @ValidateIf((o) => o.hasRegistration === true)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;

  // Recurring event fields
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ValidateIf((o) => o.isRecurring === true)
  @IsString()
  @IsOptional()
  recurrencePattern?: string; // daily, weekly, monthly

  @ValidateIf((o) => o.isRecurring === true && o.recurrencePattern === 'weekly')
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recurrenceDays?: string[];

  @ValidateIf((o) => o.isRecurring === true)
  @IsInt()
  @Min(1)
  @IsOptional()
  recurrenceInterval?: number;

  @ValidateIf((o) => o.isRecurring === true && o.recurrencePattern === 'monthly')
  @IsString()
  @IsOptional()
  monthlyType?: string; // dayOfMonth, dayOfWeek

  @ValidateIf((o) => o.isRecurring === true && o.recurrencePattern === 'monthly' && o.monthlyType === 'dayOfMonth')
  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  monthlyDayOfMonth?: number;

  @ValidateIf((o) => o.isRecurring === true && o.recurrencePattern === 'monthly' && o.monthlyType === 'dayOfWeek')
  @IsInt()
  @Min(1)
  @Max(4)
  @IsOptional()
  monthlyWeekOfMonth?: number;

  @ValidateIf((o) => o.isRecurring === true && o.recurrencePattern === 'monthly' && o.monthlyType === 'dayOfWeek')
  @IsString()
  @IsOptional()
  monthlyDayOfWeek?: string;

  // Encounter Event fields
  @ValidateIf((o) => {
    const encounterCategories = [
      'Marriage Encounter',
      'Singles Encounter',
      'Solo Parents Encounter',
      'Family Encounter',
      'Youth Encounter',
    ];
    return encounterCategories.includes(o.category) || o.category?.toLowerCase().includes('encounter');
  })
  @IsString()
  @IsOptional()
  encounterType?: string; // e.g., "ME", "SE", "SPE", "FE", "YE"

  @ValidateIf((o) => {
    const encounterCategories = [
      'Marriage Encounter',
      'Singles Encounter',
      'Solo Parents Encounter',
      'Family Encounter',
      'Youth Encounter',
    ];
    return encounterCategories.includes(o.category) || o.category?.toLowerCase().includes('encounter');
  })
  @IsInt()
  @Min(1)
  @Max(999)
  @IsOptional()
  classNumber?: number; // e.g., 18 for ME Class 18
}

