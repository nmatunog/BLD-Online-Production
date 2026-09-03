import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { LoginByQrDto } from './dto/login-by-qr.dto';
import { RegisterDto } from './dto/register.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordFromTempDto } from './dto/set-password-from-temp.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { SignupResult, SignupSuggestion } from './interfaces/signup-result.interface';
import { UserRole } from '@prisma/client';
import { roleRequiresCredentials } from './auth.constants';
import { normalizePhoneNumber, phoneToE164 } from '../common/utils/phone.util';
import { SignupUpdateDto } from './dto/signup-lookup.dto';
import { MembersService } from '../members/members.service';

/** Inputs that map to Cebu (Community ID starts with CEB) */
const CEBU_ALIASES = ['talisay', 'don bosco', 'holy family', 'schoenstatt'];
const KNOWN_CITY_CODES = ['CEB', 'BAL', 'DAN', 'DUM', 'ORM', 'MAN'];

function normalizeCityToCode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (CEBU_ALIASES.some((alias) => lower.includes(alias))) return 'CEB';
  const upper = raw.toUpperCase();
  if (KNOWN_CITY_CODES.includes(upper)) return upper;
  return upper.substring(0, 3);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private membersService: MembersService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    const normalizedPhone = registerDto.phone
      ? normalizePhoneNumber(registerDto.phone)
      : null;
    const normalizedEmail = registerDto.email
      ? registerDto.email.trim().toLowerCase()
      : null;

    if (registerDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    if (normalizedPhone) {
      const phoneVariants = [normalizedPhone, registerDto.phone];
      const e164Phone = phoneToE164(normalizedPhone);
      if (e164Phone) {
        phoneVariants.push(e164Phone);
      }

      const existingUser = await this.prisma.user.findFirst({
        where: {
          phone: { in: phoneVariants.filter((v): v is string => Boolean(v)) },
        },
      });
      if (existingUser) {
        throw new ConflictException('Phone number already registered');
      }
    }

    if (!registerDto.email && !normalizedPhone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

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

        await this.prisma.user.delete({ where: { id: existingUser.id } });
      }
    }

    const masterEmail = process.env.MASTER_SUPER_USER_EMAIL?.trim().toLowerCase();
    const masterPhone = process.env.MASTER_SUPER_USER_PHONE
      ? normalizePhoneNumber(process.env.MASTER_SUPER_USER_PHONE)
      : null;
    const isMasterSuperUser =
      (!!masterEmail && normalizedEmail === masterEmail) ||
      (!!masterPhone && normalizedPhone === masterPhone);
    const role: UserRole = isMasterSuperUser ? UserRole.SUPER_USER : UserRole.MEMBER;

    const cityCode = normalizeCityToCode(registerDto.city);
    if (!cityCode) {
      throw new BadRequestException('City or location is required.');
    }

    const communityId = await this.generateCommunityId(
      cityCode,
      registerDto.encounterType,
      registerDto.classNumber,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: normalizedPhone || null,
          passwordHash,
          role,
        },
      });

      const classNum = parseInt(registerDto.classNumber, 10);
      if (isNaN(classNum) || classNum < 1 || classNum > 999) {
        throw new BadRequestException(
          'Class number must be between 01 and 999',
        );
      }

      const member = await tx.member.create({
        data: {
          userId: user.id,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          middleName: registerDto.middleName || null,
          suffix: registerDto.suffix || null,
          nickname: registerDto.nickname || null,
          communityId,
          city: cityCode,
          encounterType: registerDto.encounterType,
          classNumber: classNum,
        },
      });

      return { user, member };
    });

    return this.generateTokens(result.user, {
      nickname: result.member.nickname,
      lastName: result.member.lastName,
      firstName: result.member.firstName,
      communityId: result.member.communityId,
      ministry: result.member.ministry,
      apostolate: result.member.apostolate,
    });
  }

  /**
   * Initial signup — phone required, password optional (set via post-signup prompt or forgot-password later).
   * Active immediately for attendance / Community ID + QR.
   *
   * Duplicate hierarchy (most effective first):
   * 1. Exact lastName + firstName → block (409, existing details)
   * 2. Exact lastName + nickname (if nickname given) → block (409)
   * 3. Client-side: lastName prefix suggestions (3+ chars) via suggestSignupMatches
   */
  async signup(signupDto: SignupDto): Promise<SignupResult> {
    const firstName = signupDto.firstName.trim();
    const lastName = signupDto.lastName.trim();
    const nickname = signupDto.nickname?.trim() || null;
    const encounterType = signupDto.encounterType.trim().toUpperCase();
    const classNum = parseInt(signupDto.classNumber, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 999) {
      throw new BadRequestException('Class number must be between 01 and 999');
    }

    const normalizedPhone = normalizePhoneNumber(signupDto.phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Invalid Philippine mobile number. Use format: 09XXXXXXXXX');
    }

    const phoneVariants = [normalizedPhone];
    const e164Phone = phoneToE164(normalizedPhone);
    if (e164Phone) {
      phoneVariants.push(e164Phone);
    }

    const existingPhone = await this.prisma.user.findFirst({
      where: {
        phone: { in: phoneVariants.filter((v): v is string => Boolean(v)) },
      },
    });

    if (existingPhone) {
      throw new ConflictException('This mobile number is already registered');
    }

    const cityCode = normalizeCityToCode(signupDto.city?.trim() || 'Cebu') || 'CEB';

    const existing = await this.findSignupDuplicate(lastName, firstName, nickname);
    if (existing) {
      throw new ConflictException({
        message: 'Your account already exists',
        existing: this.toSignupResult(existing, true),
      });
    }

    const communityId = await this.generateCommunityId(
      cityCode,
      encounterType,
      signupDto.classNumber,
    );

    const member = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: normalizedPhone,
          passwordHash: null,
          role: UserRole.MEMBER,
          isActive: true,
        },
      });

      return tx.member.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          nickname,
          communityId,
          city: cityCode,
          encounterType,
          classNumber: classNum,
        },
      });
    });

    try {
      const { photoUrl } = await this.membersService.savePhoto(member.id, signupDto.idPhoto);
      
      // Generate QR code for new member
      let qrCodeUrl: string | null = null;
      try {
        const regenerated = await this.membersService.regenerateQRCode(member.id);
        qrCodeUrl = regenerated.qrCodeUrl;
      } catch (error) {
        console.warn(`Failed to generate QR code for ${member.communityId}:`, error);
      }
      
      return { ...this.toSignupResult(member, false), photoUrl, qrCodeUrl };
    } catch (err) {
      await this.prisma.user.delete({ where: { id: member.userId } });
      throw new BadRequestException(
        'Could not save ID photo. Please try another photo.',
      );
    }
  }

  /**
   * Suggestive fill: members whose last name starts with the query (min 3 chars).
   */
  async suggestSignupMatches(lastNameQuery: string): Promise<SignupSuggestion[]> {
    const q = lastNameQuery.trim();
    if (q.length < 3) {
      return [];
    }

    const members = await this.prisma.member.findMany({
      where: {
        lastName: { startsWith: q, mode: 'insensitive' },
        user: { isActive: true },
      },
      select: {
        id: true,
        communityId: true,
        firstName: true,
        lastName: true,
        nickname: true,
        encounterType: true,
        classNumber: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 8,
    });

    return members.map((m) => ({
      memberId: m.id,
      communityId: m.communityId,
      firstName: m.firstName,
      lastName: m.lastName,
      nickname: m.nickname,
      encounterType: m.encounterType,
      classNumber: m.classNumber,
    }));
  }

  /**
   * Update details of an existing initial-signup member (identified by memberId + communityId).
   * Encounter/class changes do not rewrite Community ID (stable QR identifier).
   * Now supports setting phone and password for login activation.
   */
  async updateSignup(dto: SignupUpdateDto): Promise<SignupResult> {
    const memberId = dto.memberId.trim();
    const communityId = dto.communityId.trim().toUpperCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const nickname = dto.nickname?.trim() || null;
    const encounterType = dto.encounterType.trim().toUpperCase();
    const classNum = parseInt(dto.classNumber, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 999) {
      throw new BadRequestException('Class number must be between 01 and 999');
    }

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, communityId },
      include: { user: true },
    });

    if (!member) {
      throw new BadRequestException('Member not found for this Community ID');
    }

    // Prevent renaming into someone else's identity
    const clash = await this.findSignupDuplicate(lastName, firstName, nickname, member.id);
    if (clash) {
      throw new ConflictException({
        message: 'Your account already exists',
        existing: this.toSignupResult(clash, true),
      });
    }

    const userUpdateData: {
      isActive: boolean;
      phone?: string | null;
      passwordHash?: string;
    } = { isActive: true };

    let normalizedPhone: string | null = null;
    if (dto.phone) {
      normalizedPhone = normalizePhoneNumber(dto.phone);
      if (!normalizedPhone) {
        throw new BadRequestException('Invalid Philippine mobile number. Use format: 09XXXXXXXXX');
      }

      const phoneVariants = [normalizedPhone];
      const e164Phone = phoneToE164(normalizedPhone);
      if (e164Phone) {
        phoneVariants.push(e164Phone);
      }

      const existingPhone = await this.prisma.user.findFirst({
        where: {
          phone: { in: phoneVariants.filter((v): v is string => Boolean(v)) },
          id: { not: member.userId },
        },
      });

      if (existingPhone) {
        throw new ConflictException('This mobile number is already registered');
      }

      userUpdateData.phone = normalizedPhone;
    }
    // Phone is collected separately on login-setup screen, not required for profile update

    if (dto.password) {
      if (!dto.phone && !member.user.phone) {
        throw new BadRequestException('Mobile number is required when setting a password');
      }
      userUpdateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        firstName,
        lastName,
        nickname,
        encounterType,
        classNumber: classNum,
      },
    });

    // Only update user fields if phone or password was provided
    if (dto.phone || dto.password) {
      await this.prisma.user.update({
        where: { id: member.userId },
        data: userUpdateData,
      });
    } else {
      // Just ensure user is active
      await this.prisma.user.update({
        where: { id: member.userId },
        data: { isActive: true },
      });
    }

    let photoUrl = member.photoUrl;
    if (dto.idPhoto) {
      try {
        const saved = await this.membersService.savePhoto(updated.id, dto.idPhoto);
        photoUrl = saved.photoUrl;
      } catch {
        throw new BadRequestException('Could not save ID photo. Please try another photo.');
      }
    } else if (!member.photoUrl) {
      throw new BadRequestException('ID photo is required for your Community ID card');
    }

    // Generate QR code if missing (backfill for existing members)
    let qrCodeUrl = member.qrCodeUrl;
    if (!qrCodeUrl) {
      try {
        const regenerated = await this.membersService.regenerateQRCode(updated.id);
        qrCodeUrl = regenerated.qrCodeUrl;
      } catch (error) {
        console.warn(`Failed to generate QR code for ${updated.communityId}:`, error);
      }
    }

    return {
      ...this.toSignupResult(updated, true),
      photoUrl,
      qrCodeUrl,
      message: 'Your details were saved. Community ID is unchanged.',
    };
  }

  private async findSignupDuplicate(
    lastName: string,
    firstName: string,
    nickname: string | null,
    excludeMemberId?: string,
  ) {
    // 1) Strongest: family name + first name
    const byName = await this.prisma.member.findFirst({
      where: {
        lastName: { equals: lastName, mode: 'insensitive' },
        firstName: { equals: firstName, mode: 'insensitive' },
        ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
      },
    });
    if (byName) return byName;

    // 2) Family name + nickname (when nickname provided)
    if (nickname && nickname.length >= 2) {
      const byNick = await this.prisma.member.findFirst({
        where: {
          lastName: { equals: lastName, mode: 'insensitive' },
          nickname: { equals: nickname, mode: 'insensitive' },
          ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
        },
      });
      if (byNick) return byNick;
    }

    return null;
  }

  private toSignupResult(
    member: {
      id: string;
      communityId: string;
      firstName: string;
      lastName: string;
      nickname: string | null;
      encounterType: string;
      classNumber: number;
      photoUrl?: string | null;
    },
    isExistingMember: boolean,
  ): SignupResult {
    return {
      memberId: member.id,
      communityId: member.communityId,
      firstName: member.firstName,
      lastName: member.lastName,
      nickname: member.nickname,
      encounterType: member.encounterType,
      classNumber: member.classNumber,
      isExistingMember,
      photoUrl: member.photoUrl ?? null,
      message: isExistingMember
        ? 'Your account already exists'
        : 'Signup successful. Your Community ID is ready for attendance. Complete mobile and ministry details later when activating your account.',
    };
  }

  private assertUserCanLogin(user: {
    passwordHash: string | null;
    role: UserRole;
    isActive: boolean;
  }): void {
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if (!user.passwordHash) {
      if (roleRequiresCredentials(user.role)) {
        throw new UnauthorizedException(
          'Portal login is not set up yet. Contact an administrator to assign credentials.',
        );
      }
      throw new UnauthorizedException(
        'No login set up yet. You are registered for attendance. Contact your ministry coordinator to set up app access.',
      );
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    if (!loginDto.email && !loginDto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const emailLookup = loginDto.email?.trim()
      ? loginDto.email.trim().toLowerCase()
      : null;
    const normalizedPhone = loginDto.phone
      ? normalizePhoneNumber(loginDto.phone)
      : null;

    const orConditions: Array<{ email?: string; phone?: string }> = [];
    if (emailLookup) orConditions.push({ email: emailLookup });
    if (normalizedPhone) {
      orConditions.push({ phone: normalizedPhone });
      const e164Phone = phoneToE164(normalizedPhone);
      if (e164Phone) {
        orConditions.push({ phone: e164Phone });
      }
      if (loginDto.phone && loginDto.phone !== normalizedPhone) {
        orConditions.push({ phone: loginDto.phone });
      }
    }
    const where =
      orConditions.length === 1
        ? (emailLookup
            ? { email: { equals: emailLookup, mode: 'insensitive' as const } }
            : orConditions[0])
        : {
            OR: orConditions.map((cond) =>
              cond.email
                ? { email: { equals: cond.email, mode: 'insensitive' as const } }
                : cond,
            ),
          };

    const user = await this.prisma.user.findFirst({
      where,
      include: {
        member: true,
      },
    });

    if (!user) {
      const userCount = await this.prisma.user.count();
      console.log(`[AUTH] Login failed: User not found. Total users in DB: ${userCount}`);
      if (userCount === 0) {
        console.log(`[AUTH] WARNING: Database appears to be empty!`);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    this.assertUserCanLogin(user);

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash!,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(
      user,
      user.member
        ? {
            nickname: user.member.nickname,
            lastName: user.member.lastName,
            firstName: user.member.firstName,
            communityId: user.member.communityId,
            ministry: user.member.ministry,
            apostolate: user.member.apostolate,
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
    this.assertUserCanLogin(user);

    const isPasswordValid = await bcrypt.compare(
      loginByQrDto.password,
      user.passwordHash!,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user, {
      nickname: member.nickname,
      lastName: member.lastName,
      firstName: member.firstName,
      communityId: member.communityId,
      ministry: member.ministry,
      apostolate: member.apostolate,
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
              ministry: userWithMember.member.ministry,
              apostolate: userWithMember.member.apostolate,
            }
          : null,
      );
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async requestPasswordReset(
    requestDto: RequestPasswordResetDto,
  ): Promise<{ message: string; resetToken?: string }> {
    const normalizedPhone = normalizePhoneNumber(requestDto.phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Invalid mobile number');
    }

    const normalizedLastName = requestDto.lastName.trim().toLowerCase();
    const encounterNumber = parseInt(requestDto.encounterNumber.trim(), 10);
    if (Number.isNaN(encounterNumber) || encounterNumber < 1 || encounterNumber > 999) {
      throw new BadRequestException('Encounter number must be between 1 and 999');
    }

    const phoneVariants = [normalizedPhone, requestDto.phone.trim()];
    const e164Phone = phoneToE164(normalizedPhone);
    if (e164Phone) {
      phoneVariants.push(e164Phone);
    }

    const member = await this.prisma.member.findFirst({
      where: {
        lastName: { equals: normalizedLastName, mode: 'insensitive' },
        classNumber: encounterNumber,
        user: {
          phone: {
            in: phoneVariants.filter((v): v is string => Boolean(v)),
          },
        },
      },
      include: { user: true },
    });

    if (!member?.user) {
      return {
        message:
          'If details match an account, password reset can continue',
      };
    }
    const user = member.user;

    const resetToken = this.jwtService.sign(
      { userId: user.id, type: 'password-reset' },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      },
    );

    return {
      message: 'Identity verified. You can now set a new password.',
      resetToken,
    };
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

  async setPasswordFromTemp(dto: SetPasswordFromTempDto): Promise<{ message: string }> {
    const communityId = dto.communityId.trim().toUpperCase();
    const member = await this.prisma.member.findUnique({
      where: { communityId },
      include: { user: true },
    });

    if (!member?.user) {
      throw new UnauthorizedException('Invalid temporary credentials');
    }

    if (!member.user.passwordHash) {
      throw new UnauthorizedException('No temporary credentials on file for this member');
    }

    const validTempPassword = await bcrypt.compare(dto.tempPassword, member.user.passwordHash);
    if (!validTempPassword) {
      throw new UnauthorizedException('Invalid temporary credentials');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: member.user.id },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password updated successfully' };
  }

  private async generateTokens(
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      role: UserRole;
      ministry?: string | null;
    },
    member: {
      nickname: string | null;
      lastName: string;
      firstName: string;
      communityId?: string;
      ministry?: string | null;
      apostolate?: string | null;
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
        ministry: user.ministry ?? null,
      },
      member: member
        ? {
            nickname: member.nickname,
            lastName: member.lastName,
            firstName: member.firstName,
            communityId: member.communityId,
            ministry: member.ministry ?? null,
            apostolate: member.apostolate ?? null,
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
    
    // Use CommunityIdCounter table for atomic sequence generation
    // This prevents race conditions when multiple signups happen simultaneously
    
    // Try to get existing counter
    let counter = await this.prisma.communityIdCounter.findUnique({
      where: {
        cityCode_encounterCode_classNumber: {
          cityCode,
          encounterCode,
          classNumber: classNum,
        },
      },
    });
    
    if (!counter) {
      // First time for this class: seed from existing members' max sequence
      const existingMembers = await this.prisma.member.findMany({
        where: {
          city: cityCode,
          encounterType: encounterCode,
          classNumber: classNum,
        },
        select: { communityId: true },
      });
      
      let maxSequence = 0;
      if (existingMembers.length > 0) {
        const sequences = existingMembers
          .map((m) => {
            const match = m.communityId.match(/\d{2}$/);
            return match ? parseInt(match[0], 10) : 0;
          })
          .filter((seq) => seq > 0);
        if (sequences.length > 0) {
          maxSequence = Math.max(...sequences);
        }
      }
      
      // Create counter seeded with max+1, or 1 if no members exist
      try {
        counter = await this.prisma.communityIdCounter.create({
          data: {
            cityCode,
            encounterCode,
            classNumber: classNum,
            nextSequence: maxSequence + 1,
          },
        });
      } catch (error) {
        // Race: another request created it first, fetch and use it
        counter = await this.prisma.communityIdCounter.findUniqueOrThrow({
          where: {
            cityCode_encounterCode_classNumber: {
              cityCode,
              encounterCode,
              classNumber: classNum,
            },
          },
        });
      }
    }
    
    // Atomically increment and get next sequence
    const updated = await this.prisma.communityIdCounter.update({
      where: {
        cityCode_encounterCode_classNumber: {
          cityCode,
          encounterCode,
          classNumber: classNum,
        },
      },
      data: {
        nextSequence: { increment: 1 },
      },
    });
    
    const nextSequence = updated.nextSequence - 1; // Use the sequence before increment
    
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

  async getIncompleteSignups(limit = 100): Promise<Array<{
    userId: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    createdAt: Date;
    sessionsCount: number;
  }>> {
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.MEMBER,
        member: null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return users.map((u) => ({
      userId: u.id,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      sessionsCount: u._count.sessions,
    }));
  }

  async deleteIncompleteSignup(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.member) {
      throw new BadRequestException('This user already has a member profile and is not an incomplete signup.');
    }
    if (user.role !== UserRole.MEMBER) {
      throw new BadRequestException('Only MEMBER orphan records can be deleted from incomplete signups.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'Incomplete signup record deleted.' };
  }
}

