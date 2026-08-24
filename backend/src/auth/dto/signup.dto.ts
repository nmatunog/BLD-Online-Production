import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
} from 'class-validator';
import { SIGNUP_ENCOUNTER_TYPES } from '../auth.constants';

/**
 * Minimum for unique Community ID (CITY-ENCOUNTER+CLASS+SEQ) + member QR:
 * firstName, lastName, encounterType, classNumber.
 * City defaults to CEB. Nickname optional. Phone/ministry/DOB deferred to account activation.
 */
export class SignupDto {
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
  city?: string;

  @IsString()
  @IsOptional()
  idPhoto?: string;
}
