import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SIGNUP_ENCOUNTER_TYPES } from '../../auth/auth.constants';
import {
  IsValidApostolate,
  IsValidMinistryForApostolate,
} from '../../common/validators/ministry-validator';

/** Blank strings count as "not provided" for optional fields. */
const isProvided = (value: unknown) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

/**
 * Admin-only member creation (POST /members/admin-create).
 * Deliberately has no role, password, isActive, communityId or photo fields:
 * the global ValidationPipe (forbidNonWhitelisted) rejects them.
 */
export class AdminCreateMemberDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'firstName must not be blank' })
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'lastName must not be blank' })
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ enum: SIGNUP_ENCOUNTER_TYPES, example: 'ME' })
  @IsString()
  @IsIn([...SIGNUP_ENCOUNTER_TYPES])
  encounterType!: string;

  @ApiProperty({ example: '18' })
  @IsString()
  @Matches(/^\d{1,3}$/, { message: 'Class number must be 1 to 3 digits' })
  classNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  suffix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  civilStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsValidApostolate()
  apostolate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsValidMinistryForApostolate('apostolate')
  ministry?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: AdminCreateMemberDto) => isProvided(o.email))
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '09209648523' })
  @ValidateIf((o: AdminCreateMemberDto) => isProvided(o.phone))
  @IsString()
  @Matches(/^09\d{9}$/, {
    message: 'Phone must be 11 digits starting with 09 (e.g., 09209648523)',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'Cebu' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ example: '2026-11-24' })
  @ValidateIf((o: AdminCreateMemberDto) => isProvided(o.ministryStartDate))
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ministry start date must be YYYY-MM-DD.' })
  ministryStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmNotDuplicate?: boolean;
}
