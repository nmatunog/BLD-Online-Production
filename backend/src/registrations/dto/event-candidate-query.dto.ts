import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EventCandidateQueryDto {
  @ApiPropertyOptional({ description: 'Search by class, name, or mobile' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['IMPORTED', 'CLAIMED', 'REGISTERED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  status?: string;
}
