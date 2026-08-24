import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';
import { SIGNUP_ENCOUNTER_TYPES } from '../auth.constants';

/** Public last-name suggestions for initial signup (min 3 characters). */
export class SignupSuggestQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  lastName!: string;
}

/**
 * Update an existing initial-signup member (no password required).
 * Used when duplicate is found and the member edits their details.
 */
export class SignupUpdateDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;

  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...SIGNUP_ENCOUNTER_TYPES])
  encounterType!: string;

  @IsString()
  @IsNotEmpty()
  classNumber!: string;

  @IsString()
  @IsOptional()
  idPhoto?: string;
}
