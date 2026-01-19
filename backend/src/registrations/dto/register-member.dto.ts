import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class RegisterMemberDto {
  @IsString()
  @IsNotEmpty()
  memberCommunityId!: string; // Community ID for lookup

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  specialRequirements?: string;

  @ValidateIf((o) => o.emergencyContact !== undefined)
  @IsString()
  @IsOptional()
  emergencyContact?: string; // JSON string or plain text

  @IsString()
  @IsOptional()
  coupleRegistrationId?: string; // For couple registrations

  @IsString()
  @IsOptional()
  coupleRole?: string; // HUSBAND, WIFE, PERSON1, PERSON2
}

