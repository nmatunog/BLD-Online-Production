import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

/**
 * DTO for ensuring a Word Sharing Circle (WSC) series exists for a ministry.
 * Creates or updates a weekly WSC series with computed title: "WSC - {Official Ministry Name}"
 * 
 * BLD Event Standards v1 - Phase 3: WSC one-per-ministry
 */
export class EnsureWscSeriesDto {
  /** Official ministry name from MINISTRIES_BY_APOSTOLATE (required) */
  @IsString()
  @IsNotEmpty()
  ministry!: string;

  /** Weekday(s) for WSC meetings - can support multiple days per week if needed */
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  recurrenceDays!: string[]; // e.g., ["wednesday"], ["monday", "thursday"]

  /** Start time in HH:MM format (e.g., "19:00") */
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  /** End time in HH:MM format (e.g., "21:00") */
  @IsString()
  @IsNotEmpty()
  endTime!: string;

  /** Location (e.g., "BLD Covenant Community Center") */
  @IsString()
  @IsNotEmpty()
  location!: string;

  /** Optional venue detail (e.g., "Room 201", "Main Hall") */
  @IsString()
  @IsNotEmpty()
  venue!: string;
}
