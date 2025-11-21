"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberLookupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MemberLookupService = class MemberLookupService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByCommunityId(communityId) {
        const member = await this.prisma.member.findUnique({
            where: { communityId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        role: true,
                        isActive: true,
                    },
                },
            },
        });
        if (!member) {
            throw new common_1.NotFoundException(`Member with Community ID "${communityId}" not found`);
        }
        if (!member.user.isActive) {
            throw new common_1.NotFoundException(`Member with Community ID "${communityId}" is inactive`);
        }
        return member;
    }
    isValidCommunityIdFormat(communityId) {
        const pattern = /^[A-Z]{3}-[A-Z]{2,4}\d{2}\d{2}$/;
        return pattern.test(communityId);
    }
    normalizeCommunityId(communityId) {
        return communityId.trim().toUpperCase();
    }
};
exports.MemberLookupService = MemberLookupService;
exports.MemberLookupService = MemberLookupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MemberLookupService);
//# sourceMappingURL=member-lookup.service.js.map