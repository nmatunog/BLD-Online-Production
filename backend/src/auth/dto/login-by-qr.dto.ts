import { IsString } from 'class-validator';

export class LoginByQrDto {
  @IsString()
  communityId!: string;

  @IsString()
  password!: string;
}
