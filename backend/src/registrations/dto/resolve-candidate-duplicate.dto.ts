import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ResolveCandidateDuplicateDto {
  @IsString()
  @IsNotEmpty()
  signature!: string;

  @IsUUID()
  keeperId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  deleteIds?: string[];
}
