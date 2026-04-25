import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportCandidatesQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Validate and preview only; do not write to database' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean = false;
}
