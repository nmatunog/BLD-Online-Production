import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const MAX_BULK_PERMANENT_DELETE = 50;

export class BulkPermanentDeleteDto {
  @ApiProperty({
    type: [String],
    description: 'Member profile IDs to permanently delete (max 50)',
    maxItems: MAX_BULK_PERMANENT_DELETE,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_PERMANENT_DELETE)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  memberIds!: string[];
}
