import {
  IsString,
  IsOptional,
  IsEmail,
} from 'class-validator';
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
}
