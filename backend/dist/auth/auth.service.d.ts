import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResult } from './interfaces/auth-result.interface';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<AuthResult>;
    login(loginDto: LoginDto): Promise<AuthResult>;
    refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResult>;
    requestPasswordReset(requestDto: RequestPasswordResetDto): Promise<{
        message: string;
    }>;
    resetPassword(resetDto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    private generateTokens;
    private generateCommunityId;
}
