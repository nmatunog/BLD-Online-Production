import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetPasswordFromTempDto {
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @IsString()
  @IsNotEmpty()
  tempPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

