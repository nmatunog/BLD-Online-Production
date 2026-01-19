import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RegistrationType, PaymentStatus } from '@prisma/client';

export class RegistrationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(RegistrationType)
  @IsOptional()
  registrationType?: RegistrationType;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  @IsOptional()
  roomAssignment?: string;

  @IsString()
  @IsOptional()
  sortBy?: string; // firstName, lastName, createdAt, paymentStatus

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;
}

