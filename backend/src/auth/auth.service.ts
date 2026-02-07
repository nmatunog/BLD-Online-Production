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
import { LoginByQrDto } from './dto/login-by-qr.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { UserRole } from '@prisma/client';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    // Normalize phone number if provided
    const normalizedPhone = registerDto.phone
      ? normalizePhoneNumber(registerDto.phone)
      : null;
    const normalizedEmail = registerDto.email
      ? registerDto.email.trim().toLowerCase()
      : null;

    // Check if user already exists
    if (registerDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    // Check for existing phone (check both normalized and original formats)
    if (normalizedPhone) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            registerDto.phone ? { phone: registerDto.phone } : {},
          ],
        },
      });
      if (existingUser) {
        throw new ConflictException('Phone number already registered');
      }
    }

    if (!registerDto.email && !normalizedPhone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Preflight: if a user exists with same email/phone but no member, clean it so retries succeed
    if (normalizedEmail || normalizedPhone) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            normalizedEmail ? { email: normalizedEmail } : undefined,
            normalizedPhone ? { phone: normalizedPhone } : undefined,
          ].filter(Boolean) as any,
        },
        include: { member: true },
      });

      if (existingUser) {
        if (existingUser.member) {
          throw new ConflictException(
            normalizedPhone
              ? 'Mobile number is already registered.'
              : 'Email is already registered.',
          );
        }

        // Orphaned user without member profile: clean up to allow retry
        await this.prisma.user.delete({ where: { id: existingUser.id } });
      }
    }

    // All sign-ups default to MEMBER. Only the designated master super user (env) can become SUPER_USER on sign-up.
    // Require env vars to be set and non-empty before matching (otherwise undefined === undefined would make everyone super user).
    const masterEmail = process.env.MASTER_SUPER_USER_EMAIL?.trim().toLowerCase();
    const masterPhone = process.env.MASTER_SUPER_USER_PHONE
      ? normalizePhoneNumber(process.env.MASTER_SUPER_USER_PHONE)
      : null;
    const isMasterSuperUser =
      (!!masterEmail && normalizedEmail === masterEmail) ||
      (!!masterPhone && normalizedPhone === masterPhone);
    const role: UserRole = isMasterSuperUser ? UserRole.SUPER_USER : UserRole.MEMBER;

    // Generate Community ID
    const communityId = await this.generateCommunityId(
      registerDto.city,
      registerDto.encounterType,
      registerDto.classNumber,
    );

    // Create user and member in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user (use normalized phone number)
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: normalizedPhone || null,
          passwordHash,
          role,
        },
      });

      // Parse class number (01-999)
      const classNum = parseInt(registerDto.classNumber, 10);
      if (isNaN(classNum) || classNum < 1 || classNum > 999) {
        throw new BadRequestException(
          'Class number must be between 01 and 999',
        );
      }

      // Create member profile
      const member = await tx.member.create({
        data: {
          userId: user.id,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          middleName: registerDto.middleName || null,
          suffix: registerDto.suffix || null,
          nickname: registerDto.nickname || null,
          communityId,
          city: registerDto.city,
          encounterType: registerDto.encounterType,
          classNumber: classNum, // Store as integer (e.g., 18, not 1801)
        },
      });

      return { user, member };
    });

    // Generate tokens with member info (including communityId)
    return this.generateTokens(result.user, {
      nickname: result.member.nickname,
      lastName: result.member.lastName,
      firstName: result.member.firstName,
      communityId: result.member.communityId,
    });
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    if (!loginDto.email && !loginDto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Normalize phone number if provided
    const normalizedPhone = loginDto.phone
      ? normalizePhoneNumber(loginDto.phone)
      : null;

    // Find user - try both original and normalized phone formats
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          loginDto.email ? { email: loginDto.email } : {},
          normalizedPhone
            ? {
                OR: [
                  { phone: normalizedPhone },
                  { phone: loginDto.phone }, // Also try original format
                ],
              }
            : {},
        ],
      },
      include: {
        member: true,
      },
    });

    if (!user) {
      // Log for debugging - check if database is empty
      const userCount = await this.prisma.user.count();
      console.log(`[AUTH] Login failed: User not found. Total users in DB: ${userCount}`);
      if (userCount === 0) {
        console.log(`[AUTH] WARNING: Database appears to be empty!`);
      }
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

    // Generate tokens with member info (including communityId)
    return this.generateTokens(
      user,
      user.member
        ? {
            nickname: user.member.nickname,
            lastName: user.member.lastName,
            firstName: user.member.firstName,
            communityId: user.member.communityId,
          }
        : null,
    );
  }

  /**
   * Login using member QR code (communityId) + password.
   * Finds member by communityId, then authenticates the linked user with password.
   */
  async loginByQr(loginByQrDto: LoginByQrDto): Promise<AuthResult> {
    const communityId = loginByQrDto.communityId.trim().toUpperCase();
    if (!communityId) {
      throw new BadRequestException('Community ID from QR code is required');
    }

    const member = await this.prisma.member.findUnique({
      where: { communityId },
      include: { user: true },
    });

    if (!member || !member.user) {
      throw new UnauthorizedException('Invalid QR code or member not found');
    }

    const user = member.user;
    const isPasswordValid = await bcrypt.compare(
      loginByQrDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.generateTokens(user, {
      nickname: member.nickname,
      lastName: member.lastName,
      firstName: member.firstName,
      communityId: member.communityId,
    });
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

      // Fetch member info for refresh token
      const userWithMember = await this.prisma.user.findUnique({
        where: { id: session.user.id },
        include: { member: true },
      });

      // Generate new tokens with member info (including communityId)
      return this.generateTokens(
        session.user,
        userWithMember?.member
          ? {
              nickname: userWithMember.member.nickname,
              lastName: userWithMember.member.lastName,
              firstName: userWithMember.member.firstName,
              communityId: userWithMember.member.communityId,
            }
          : null,
      );
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async requestPasswordReset(
    requestDto: RequestPasswordResetDto,
  ): Promise<{ message: string; resetLink?: string }> {
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
    const resetToken = this.jwtService.sign(
      { userId: user.id, type: 'password-reset' },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      },
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email/SMS with reset token
    try {
      // Get user's name for email personalization
      const member = await this.prisma.member.findUnique({
        where: { userId: user.id },
        select: { firstName: true, lastName: true, nickname: true },
      });

      const userName = member
        ? member.nickname || `${member.firstName} ${member.lastName}`
        : 'User';

      // Send email if available
      if (user.email) {
        const result = await this.emailService.sendPasswordResetEmail(
          user.email,
          resetToken,
          userName,
        );
        // If email wasn't sent (dev mode), return the reset link
        if (!result.sent && result.resetLink) {
          return { 
            message: 'Password reset link generated (email not configured)', 
            resetLink: result.resetLink 
          };
        }
      }

      // Send SMS if phone is available and email is not
      if (!user.email && user.phone) {
        const result = await this.emailService.sendPasswordResetSMS(user.phone, resetToken);
        // If SMS wasn't sent (dev mode), return the reset link
        if (!result.sent && result.resetLink) {
          return { 
            message: 'Password reset link generated (SMS not configured)', 
            resetLink: result.resetLink 
          };
        }
      }
    } catch (error) {
      // Log error but don't fail the request (security: don't reveal if user exists)
      console.error('Error sending password reset notification:', error);
      // In development, return the reset link if email/SMS failed
      if (process.env.NODE_ENV !== 'production') {
        return { 
          message: 'Password reset link generated (notification failed)', 
          resetLink 
        };
      }
    }

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

  private async generateTokens(
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      role: UserRole;
    },
    member: {
      nickname: string | null;
      lastName: string;
      firstName: string;
      communityId?: string;
    } | null,
  ): Promise<AuthResult> {
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
      member: member
        ? {
            nickname: member.nickname,
            lastName: member.lastName,
            firstName: member.firstName,
            communityId: member.communityId,
          }
        : undefined,
    };
  }

  private async generateCommunityId(
    city: string,
    encounterType: string,
    classNumber: string,
  ): Promise<string> {
    // Format: CITY-ENCOUNTERTYPECLASSNUMBER+SEQUENCE
    // Example: CEB-ME1801 (Cebu, ME, Class 18, Sequence 01)
    //         CEB-ME1802 (Cebu, ME, Class 18, Sequence 02)
    // Class numbers: 01-999 (2 digits)
    // Sequence: 01-99 (2 digits, starts at 01 for each class)
    
    const cityCode = city.substring(0, 3).toUpperCase();
    const encounterCode = encounterType.toUpperCase();
    
    // Parse and validate class number (01-999)
    const classNum = parseInt(classNumber, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 999) {
      throw new BadRequestException(
        'Class number must be between 01 and 999',
      );
    }
    
    // Format class number as 2 digits (01-999)
    const formattedClassNumber = classNum.toString().padStart(2, '0');
    
    // Find the next sequence number for this specific class
    // Query existing members with same city, encounterType, and classNumber
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
    
    // Calculate next sequence number
    // If no members exist for this class, start at 01
    // Otherwise, find the highest sequence and increment
    let nextSequence = 1;
    
    if (existingMembers.length > 0) {
      // Extract sequence numbers from existing communityIds
      const sequences = existingMembers
        .map((member) => {
          // Extract last 2 digits (sequence) from communityId
          // Format: CEB-ME1801 -> extract "01"
          const match = member.communityId.match(/\d{2}$/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter((seq) => seq > 0);
      
      if (sequences.length > 0) {
        const maxSequence = Math.max(...sequences);
        nextSequence = maxSequence + 1;
      }
    }
    
    // Validate sequence doesn't exceed 99
    if (nextSequence > 99) {
      throw new BadRequestException(
        `Maximum sequence number (99) reached for ${cityCode}-${encounterCode} Class ${formattedClassNumber}`,
      );
    }
    
    // Format sequence as 2 digits (01-99)
    const formattedSequence = nextSequence.toString().padStart(2, '0');
    
    // Combine: CITY-ENCOUNTERTYPE + CLASS (2 digits) + SEQUENCE (2 digits)
    return `${cityCode}-${encounterCode}${formattedClassNumber}${formattedSequence}`;
  }
}

