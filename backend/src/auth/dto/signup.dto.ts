import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';
import {
  IsValidApostolate,
  IsValidMinistryForApostolate,
} from '../../common/validators/ministry-validator';
import { SIGNUP_ENCOUNTER_TYPES } from '../auth.constants';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...SIGNUP_ENCOUNTER_TYPES])
  encounterType!: string;

  @IsString()
  @IsNotEmpty()
  classNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date of birth must be YYYY-MM-DD',
  })
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidApostolate()
  apostolate!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidMinistryForApostolate('apostolate')
  ministry!: string;

  @IsString()
  @IsOptional()
  city?: string;
}
