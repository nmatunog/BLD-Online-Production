import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { IsValidApostolate, IsValidMinistryForApostolate } from '../../common/validators/ministry-validator';

export class CreateMemberDto {
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
  @IsOptional()
  suffix?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  encounterType!: string;

  @IsString()
  @IsNotEmpty()
  classNumber!: string;

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
}
