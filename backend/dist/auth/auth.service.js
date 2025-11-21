"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../common/prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(registerDto) {
        if (registerDto.email) {
            const existingUser = await this.prisma.user.findUnique({
                where: { email: registerDto.email },
            });
            if (existingUser) {
                throw new common_1.ConflictException('Email already registered');
            }
        }
        if (registerDto.phone) {
            const existingUser = await this.prisma.user.findUnique({
                where: { phone: registerDto.phone },
            });
            if (existingUser) {
                throw new common_1.ConflictException('Phone number already registered');
            }
        }
        if (!registerDto.email && !registerDto.phone) {
            throw new common_1.BadRequestException('Either email or phone is required');
        }
        const passwordHash = await bcrypt.hash(registerDto.password, 10);
        const userCount = await this.prisma.user.count();
        const isMasterSuperUser = registerDto.email === process.env.MASTER_SUPER_USER_EMAIL ||
            registerDto.phone === process.env.MASTER_SUPER_USER_PHONE;
        const role = isMasterSuperUser || userCount === 0
            ? client_1.UserRole.SUPER_USER
            : client_1.UserRole.MEMBER;
        const communityId = await this.generateCommunityId(registerDto.city, registerDto.encounterType, registerDto.classNumber);
        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: registerDto.email || null,
                    phone: registerDto.phone || null,
                    passwordHash,
                    role,
                },
            });
            const classNum = parseInt(registerDto.classNumber, 10);
            if (isNaN(classNum) || classNum < 1 || classNum > 999) {
                throw new common_1.BadRequestException('Class number must be between 01 and 999');
            }
            await tx.member.create({
                data: {
                    userId: user.id,
                    firstName: registerDto.firstName,
                    lastName: registerDto.lastName,
                    middleName: registerDto.middleName || null,
                    nickname: registerDto.nickname || null,
                    communityId,
                    city: registerDto.city,
                    encounterType: registerDto.encounterType,
                    classNumber: classNum,
                },
            });
            return user;
        });
        return this.generateTokens(result);
    }
    async login(loginDto) {
        if (!loginDto.email && !loginDto.phone) {
            throw new common_1.BadRequestException('Either email or phone is required');
        }
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    loginDto.email ? { email: loginDto.email } : {},
                    loginDto.phone ? { phone: loginDto.phone } : {},
                ],
            },
            include: {
                member: true,
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('Account is deactivated');
        }
        return this.generateTokens(user);
    }
    async refreshToken(refreshTokenDto) {
        try {
            this.jwtService.verify(refreshTokenDto.refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });
            const session = await this.prisma.session.findUnique({
                where: { refreshToken: refreshTokenDto.refreshToken },
                include: { user: true },
            });
            if (!session || session.expiresAt < new Date()) {
                throw new common_1.UnauthorizedException('Invalid or expired refresh token');
            }
            if (!session.user.isActive) {
                throw new common_1.UnauthorizedException('Account is deactivated');
            }
            return this.generateTokens(session.user);
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async requestPasswordReset(requestDto) {
        if (!requestDto.email && !requestDto.phone) {
            throw new common_1.BadRequestException('Either email or phone is required');
        }
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    requestDto.email ? { email: requestDto.email } : {},
                    requestDto.phone ? { phone: requestDto.phone } : {},
                ],
            },
        });
        if (!user) {
            return { message: 'If the account exists, a password reset link has been sent' };
        }
        this.jwtService.sign({ userId: user.id, type: 'password-reset' }, {
            secret: process.env.JWT_SECRET,
            expiresIn: '15m',
        });
        return { message: 'If the account exists, a password reset link has been sent' };
    }
    async resetPassword(resetDto) {
        try {
            const payload = this.jwtService.verify(resetDto.token, {
                secret: process.env.JWT_SECRET,
            });
            if (payload.type !== 'password-reset') {
                throw new common_1.UnauthorizedException('Invalid reset token');
            }
            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            const passwordHash = await bcrypt.hash(resetDto.password, 10);
            await this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash },
            });
            return { message: 'Password reset successfully' };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid or expired reset token');
        }
    }
    async generateTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
        };
        const accessToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        });
        const refreshToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET,
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await this.prisma.session.create({
            data: {
                userId: user.id,
                refreshToken,
                expiresAt,
            },
        });
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        };
    }
    async generateCommunityId(city, encounterType, classNumber) {
        const cityCode = city.substring(0, 3).toUpperCase();
        const encounterCode = encounterType.toUpperCase();
        const classNum = parseInt(classNumber, 10);
        if (isNaN(classNum) || classNum < 1 || classNum > 999) {
            throw new common_1.BadRequestException('Class number must be between 01 and 999');
        }
        const formattedClassNumber = classNum.toString().padStart(2, '0');
        const existingMembers = await this.prisma.member.findMany({
            where: {
                city: cityCode,
                encounterType: encounterCode,
                classNumber: classNum,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        let nextSequence = 1;
        if (existingMembers.length > 0) {
            const sequences = existingMembers
                .map((member) => {
                const match = member.communityId.match(/\d{2}$/);
                return match ? parseInt(match[0], 10) : 0;
            })
                .filter((seq) => seq > 0);
            if (sequences.length > 0) {
                const maxSequence = Math.max(...sequences);
                nextSequence = maxSequence + 1;
            }
        }
        if (nextSequence > 99) {
            throw new common_1.BadRequestException(`Maximum sequence number (99) reached for ${cityCode}-${encounterCode} Class ${formattedClassNumber}`);
        }
        const formattedSequence = nextSequence.toString().padStart(2, '0');
        return `${cityCode}-${encounterCode}${formattedClassNumber}${formattedSequence}`;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map