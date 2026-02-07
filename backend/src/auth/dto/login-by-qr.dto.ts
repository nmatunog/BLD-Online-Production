import { IsString, MinLength } from 'class-validator';

export class LoginByQrDto {
  @IsString()
  communityId!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
