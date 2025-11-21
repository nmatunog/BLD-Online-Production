import { IsEmail, IsString, IsOptional, MinLength, IsNotEmpty } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

