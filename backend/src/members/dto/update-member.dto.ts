import {
  IsString,
  IsOptional,
  IsEmail,
} from 'class-validator';

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
  apostolate?: string;

  @IsString()
  @IsOptional()
  ministry?: string;

  @IsString()
  @IsOptional()
  serviceArea?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;
}
