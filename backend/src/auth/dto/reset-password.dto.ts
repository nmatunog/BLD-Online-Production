import { IsString, Matches, MinLength, IsNotEmpty } from 'class-validator';

export class RequestPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{1,3}$/, {
    message: 'encounterNumber must be a number (e.g. 18 or 101)',
  })
  encounterNumber!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

