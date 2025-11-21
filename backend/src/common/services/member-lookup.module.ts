import { Module } from '@nestjs/common';
import { MemberLookupService } from './member-lookup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MemberLookupService],
  exports: [MemberLookupService],
})
export class MemberLookupModule {}

