import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { UpdateEventDto } from './update-event.dto';

/**
 * BLD Event Standards v1 - Phase 5: Scope for updating series-backed occurrences
 */
export enum OverwriteScope {
  /** Update only this occurrence (one-off override) */
  OCCURRENCE = 'OCCURRENCE',
  /** Update series template and regenerate/update future occurrences from this date forward */
  SERIES_FUTURE = 'SERIES_FUTURE',
}

/**
 * Extended UpdateEventDto with scope selection for series-backed occurrences.
 * When updating an event that belongs to a series (has recurrenceTemplateId),
 * overwriteScope is REQUIRED to prevent ambiguous updates.
 */
export class UpdateEventScopeDto extends UpdateEventDto {
  /**
   * Overwrite scope: required when updating a series-backed occurrence.
   * - OCCURRENCE: Update only this occurrence (date/time/venue/subtype/location override)
   * - SERIES_FUTURE: Update the series template and apply to future occurrences
   */
  @IsEnum(OverwriteScope)
  @IsOptional()
  overwriteScope?: OverwriteScope;
}
