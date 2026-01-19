import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  ValidateIf,
} from 'class-validator';

export class RegisterNonMemberDto {
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
  nameSuffix?: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @ValidateIf((o) => o.email !== undefined)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  specialRequirements?: string;

  // For Encounter events: member profile creation fields
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  encounterType?: string;

  @IsString()
  @IsOptional()
  classNumber?: string;

  @IsString()
  @IsOptional()
  apostolate?: string;

  @IsString()
  @IsOptional()
  ministry?: string;

  // For ME events: spouse fields
  @IsString()
  @IsOptional()
  spouseFirstName?: string;

  @IsString()
  @IsOptional()
  spouseLastName?: string;

  @IsString()
  @IsOptional()
  spouseMiddleName?: string;

  @IsString()
  @IsOptional()
  spouseNameSuffix?: string;

  @IsString()
  @IsOptional()
  spouseNickname?: string;

  @ValidateIf((o) => o.spouseEmail !== undefined)
  @IsEmail()
  @IsOptional()
  spouseEmail?: string;

  @IsString()
  @IsOptional()
  spousePhone?: string;

  @IsString()
  @IsOptional()
  spouseCity?: string;

  @IsString()
  @IsOptional()
  spouseEncounterType?: string;

  @IsString()
  @IsOptional()
  spouseClassNumber?: string;

  // Couple registration linking
  @IsString()
  @IsOptional()
  coupleRegistrationId?: string;

  @IsString()
  @IsOptional()
  coupleRole?: string; // HUSBAND, WIFE, PERSON1, PERSON2
}

