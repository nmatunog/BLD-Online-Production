import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ClaimEventCandidateDto {
  @ApiProperty({ example: 'ME 101' })
  @IsString()
  candidateClass!: string;

  @ApiProperty({ example: 'Sanchez' })
  @IsString()
  familyName!: string;

  @ApiProperty({ example: 'Henry' })
  @IsString()
  firstName!: string;

  @ApiProperty({ required: false, example: '09928764211' })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiProperty({ required: false, example: 'candidate@email.com' })
  @IsOptional()
  @IsString()
  email?: string;
}
