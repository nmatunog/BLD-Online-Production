import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelEventDto {
  @ApiProperty({
    description: 'Reason for cancelling the event',
    required: false,
    example: 'Due to unforeseen circumstances, the event has been cancelled.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Cancellation reason must not exceed 500 characters' })
  cancellationReason?: string;
}






