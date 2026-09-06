import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
} from 'class-validator';

/**
 * DTO for ensuring LSS Shepherding track exists.
 * 
 * BLD Event Standards v1 - Phase 4
 */
export class EnsureLssShepherdingDto {
  /**
   * LSS Weekend event ID (if already created)
   * OR provide lssWeekendDate if not yet created
   */
  @IsOptional()
  @IsString()
  lssWeekendEventId?: string;

  /**
   * LSS Weekend start date (YYYY-MM-DD or ISO string)
   * Required if lssWeekendEventId is not provided
   */
  @IsOptional()
  @IsDateString()
  lssWeekendDate?: string;

  /**
   * Year for the LSS cycle (e.g., 2026)
   * Required to calculate Salubungan (last Tuesday of January)
   */
  @IsNotEmpty()
  @IsString()
  year!: string;

  /**
   * Location for shepherding sessions (optional)
   * Default: "BLD Covenant Community Center"
   */
  @IsOptional()
  @IsString()
  location?: string;

  /**
   * Venue for shepherding sessions (optional)
   */
  @IsOptional()
  @IsString()
  venue?: string;
}
