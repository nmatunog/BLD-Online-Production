import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const MAX_BULK_PERMANENT_DELETE = 50;

export class BulkPermanentDeleteDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Member profile IDs to permanently delete (UUID v4, max 50)',
    maxItems: MAX_BULK_PERMANENT_DELETE,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_PERMANENT_DELETE)
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
