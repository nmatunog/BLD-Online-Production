import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for the simplified candidate "register + check in" flow.
 *
 * Staff confirms the encounter type and class number (manual confirmation),
 * and the system automatically allocates a Community ID, registers the candidate,
 * and creates the attendance record in a single transaction.
 */
export class QuickRegisterCheckinDto {
  @ApiProperty({
    description:
      'Session to check in for: Manila calendar day + AM or PM (e.g. "2026-05-09_AM"). Each day of the event has a morning and afternoon session.',
    example: '2026-05-09_AM',
  })
  @IsString()
  @IsNotEmpty()
  sessionSlot!: string;

  @ApiProperty({
    description: 'Encounter type confirmed by staff (e.g. "ME", "SE", "SPE", "YE"). Defaults to value parsed from candidateClass.',
    required: false,
    example: 'ME',
  })
  @IsOptional()
  @IsString()
  encounterType?: string;

  @ApiProperty({
    description: 'Class number confirmed by staff (1-999). Defaults to value parsed from candidateClass.',
    required: false,
    example: 101,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  classNumber?: number;

  @ApiProperty({ required: false, example: '09928764211' })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiProperty({ required: false, example: 'candidate@email.com' })
  @IsOptional()
  @IsString()
  email?: string;
}
