import { Module } from '@nestjs/common';
import { BunnyCDNService } from './bunnycdn.service';

@Module({
  providers: [BunnyCDNService],
  exports: [BunnyCDNService],
})
export class BunnyCDNModule {}






