import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsInt,
  IsIn,
  Min,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsValidApostolate, IsValidMinistryForApostolate } from '../../common/validators/ministry-validator';

export class UpdateMemberDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsOptional()
  suffix?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  communityId?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  encounterType?: string;

  @IsString()
  @IsOptional()
  classNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @IsValidApostolate({
    message: 'Apostolate must be one of the valid BLD Cebu apostolates',
  })
  apostolate?: string;

  @IsString()
  @IsOptional()
  @IsValidMinistryForApostolate('apostolate', {
    message: 'Ministry must belong to the selected apostolate',
  })
  ministry?: string;

  @IsString()
  @IsOptional()
  serviceArea?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodType?: string;

  @IsString()
  @IsOptional()
  profession?: string;

  @IsString()
  @IsOptional()
  civilStatus?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  spouseName?: string;

  @IsString()
  @IsOptional()
  dateOfMarriage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfChildren?: number;

  @IsOptional()
  @IsArray()
  children?: Array<{ name?: string; gender?: string; dateOfBirth?: string }>;

  @IsString()
  @IsOptional()
  dateOfEncounter?: string;

  /** Community-level attendance start (YYYY-MM-DD, Asia/Manila). Null/blank clears to computed fallback. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Attendance start date must be YYYY-MM-DD' })
  attendanceStartDate?: string | null;

  /** Start date of the current ministry assignment (YYYY-MM-DD, Asia/Manila). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ministry start date must be YYYY-MM-DD' })
  ministryStartDate?: string | null;
}
