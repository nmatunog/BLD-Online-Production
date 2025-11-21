import { PrismaService } from '../prisma/prisma.service';
import { Member } from '@prisma/client';
export declare class MemberLookupService {
    private prisma;
    constructor(prisma: PrismaService);
    findByCommunityId(communityId: string): Promise<Member>;
    isValidCommunityIdFormat(communityId: string): boolean;
    normalizeCommunityId(communityId: string): string;
}
