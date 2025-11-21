import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    // Check if user already exists
    if (registerDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    if (registerDto.phone) {
      const existingUser = await this.prisma.user.findUnique({
        where: { phone: registerDto.phone },
      });
      if (existingUser) {
        throw new ConflictException('Phone number already registered');
      }
    }

    if (!registerDto.email && !registerDto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Determine role (first user gets SUPER_USER, or check master super user)
    const userCount = await this.prisma.user.count();
    const isMasterSuperUser =
      registerDto.email === process.env.MASTER_SUPER_USER_EMAIL ||
      registerDto.phone === process.env.MASTER_SUPER_USER_PHONE;
    const role: UserRole = isMasterSuperUser || userCount === 0
      ? UserRole.SUPER_USER
      : UserRole.MEMBER;

    // Generate Community ID
    const communityId = await this.generateCommunityId(
      registerDto.city,
      registerDto.encounterType,
      registerDto.classNumber,
    );

    // Create user and member in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: registerDto.email || null,
          phone: registerDto.phone || null,
          passwordHash,
          role,
        },
      });

      // Create member profile
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
          classNumber: parseInt(registerDto.classNumber, 10),
        },
      });

      return user;
    });

    // Generate tokens
    return this.generateTokens(result);
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    if (!loginDto.email && !loginDto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Find user
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate tokens
    return this.generateTokens(user);
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResult> {
    try {
      // Verify refresh token
      this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Find session
      const session = await this.prisma.session.findUnique({
        where: { refreshToken: refreshTokenDto.refreshToken },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Check if user is still active
      if (!session.user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Generate new tokens
      return this.generateTokens(session.user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async requestPasswordReset(
    requestDto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    if (!requestDto.email && !requestDto.phone) {
      throw new BadRequestException('Either email or phone is required');
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
      // Don't reveal if user exists for security
      return { message: 'If the account exists, a password reset link has been sent' };
    }

    // Generate reset token
    this.jwtService.sign(
      { userId: user.id, type: 'password-reset' },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      },
    );

    // TODO: Send email/SMS with reset token via Resend
    // This will be implemented in Phase 4

    return { message: 'If the account exists, a password reset link has been sent' };
  }

  async resetPassword(resetDto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      // Verify reset token
      const payload = this.jwtService.verify(resetDto.token, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('Invalid reset token');
      }

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(resetDto.password, 10);

      // Update password
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  private async generateTokens(user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
  }): Promise<AuthResult> {
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

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

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

  private async generateCommunityId(
    city: string,
    encounterType: string,
    classNumber: string,
  ): Promise<string> {
    // Format: CITY-ENCOUNTERTYPECLASSNUMBER
    // Example: CEB-ME1801
    const cityCode = city.substring(0, 3).toUpperCase();
    const encounterCode = encounterType.toUpperCase();
    const formattedClassNumber = classNumber.padStart(4, '0');
    return `${cityCode}-${encounterCode}${formattedClassNumber}`;
  }
}

