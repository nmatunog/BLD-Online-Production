import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';
import { SIGNUP_ENCOUNTER_TYPES } from '../auth.constants';

/**
 * Minimum for unique Community ID (CITY-ENCOUNTER+CLASS+SEQ) + member QR:
 * firstName, lastName, encounterType, classNumber, phone (09xxxxxxxxx).
 * City defaults to CEB. Nickname optional. Password deferred to optional post-signup prompt.
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
  @IsNotEmpty({ message: 'Philippine mobile number is required' })
  @Matches(/^09\d{9}$/, {
    message: 'Phone must be 11 digits starting with 09 (e.g., 09209648523)',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: 'ID photo is required for your Community ID card' })
  @MaxLength(500_000)
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/i, {
    message: 'ID photo must be a processed image',
  })
  idPhoto!: string;
}
