import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  paymentStatus!: PaymentStatus;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  paymentAmount?: number;

  @IsString()
  @IsOptional()
  paymentReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

