import {
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class RegisterCoupleDto {
  // Husband/Person 1
  @IsString()
  @IsNotEmpty()
  husbandCommunityId!: string;

  @IsString()
  @IsNotEmpty()
  husbandLastName!: string;

  @IsString()
  @IsNotEmpty()
  husbandFirstName!: string;

  @IsString()
  @IsOptional()
  husbandMiddleName?: string;

  @IsString()
  @IsOptional()
  husbandNickname?: string;

  // Wife/Person 2
  @IsString()
  @IsNotEmpty()
  wifeCommunityId!: string;

  @IsString()
  @IsNotEmpty()
  wifeLastName!: string;

  @IsString()
  @IsNotEmpty()
  wifeFirstName!: string;

  @IsString()
  @IsOptional()
  wifeMiddleName?: string;

  @IsString()
  @IsOptional()
  wifeNickname?: string;

  // Shared fields
  @IsString()
  @IsOptional()
  specialRequirements?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;
}

