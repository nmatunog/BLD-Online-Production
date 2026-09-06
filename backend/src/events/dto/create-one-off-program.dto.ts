import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for creating a one-off annual program (Marriage Encounter, Singles Encounter, etc.)
 * from the standardized catalog.
 * 
 * BLD Event Standards v1 - Phase 4
 */
export class CreateOneOffProgramDto {
  /**
   * Program key from ANNUAL_PROGRAMS_CATALOG
   * e.g., "MARRIAGE_ENCOUNTER", "SINGLES_ENCOUNTER", "LSS_WEEKEND"
   */
  @IsString()
  @IsNotEmpty()
  programKey!: string;

  /**
   * Start date (YYYY-MM-DD or ISO string)
   */
  @IsDateString()
  startDate!: string;

  /**
   * End date (YYYY-MM-DD or ISO string)
   */
  @IsDateString()
  endDate!: string;

  /**
   * Start time (HH:MM format, optional)
   * Default depends on program type
   */
  @IsOptional()
  @IsString()
  startTime?: string;

  /**
   * End time (HH:MM format, optional)
   * Default depends on program type
   */
  @IsOptional()
  @IsString()
  endTime?: string;

  /**
   * Serial number within the year (optional, for programs with multiple per year)
   * e.g., 1, 2, 3 for Marriage Encounter
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  serialNumber?: number;

  /**
   * Location (optional, uses default if not provided)
   */
  @IsOptional()
  @IsString()
  location?: string;

  /**
   * Venue (optional)
   */
  @IsOptional()
  @IsString()
  venue?: string;

  /**
   * Class number for Encounter events (optional)
   * e.g., 18 for ME Class 18
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;
}
