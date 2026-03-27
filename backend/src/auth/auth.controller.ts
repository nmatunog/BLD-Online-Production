import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginByQrDto } from './dto/login-by-qr.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/reset-password.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already registered',
  })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<ApiResponseDto<AuthResult>> {
    const result = await this.authService.register(registerDto);
    return {
      success: true,
      data: result,
      message: 'Registration successful',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email or phone' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<ApiResponseDto<AuthResult>> {
    const result = await this.authService.login(loginDto);
    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }

  @Public()
  @Post('login-by-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with member QR code (communityId) + password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or member not found' })
  async loginByQr(
    @Body() loginByQrDto: LoginByQrDto,
  ): Promise<ApiResponseDto<AuthResult>> {
    const result = await this.authService.loginByQr(loginByQrDto);
    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<ApiResponseDto<AuthResult>> {
    const result = await this.authService.refreshToken(refreshTokenDto);
    return {
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    };
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Identity verified for password reset',
  })
  async requestPasswordReset(
    @Body() requestDto: RequestPasswordResetDto,
  ): Promise<ApiResponseDto<{ message: string; resetToken?: string }>> {
    const result = await this.authService.requestPasswordReset(requestDto);
    return {
      success: true,
      data: result,
      message: result.message,
    };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
  })
  async resetPassword(
    @Body() resetDto: ResetPasswordDto,
  ): Promise<ApiResponseDto<{ message: string }>> {
    const result = await this.authService.resetPassword(resetDto);
    return {
      success: true,
      data: result,
      message: result.message,
    };
  }

  @Get('admin/incomplete-signups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Admin: list incomplete signups (orphan MEMBER users without member profile)' })
  async getIncompleteSignups(): Promise<ApiResponseDto<unknown>> {
    const data = await this.authService.getIncompleteSignups();
    return {
      success: true,
      data,
      message: 'Incomplete signups retrieved',
    };
  }

  @Delete('admin/incomplete-signups/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete/reset an incomplete signup record' })
  async deleteIncompleteSignup(
    @Param('userId') userId: string,
    @CurrentUser() _user: { id: string },
  ): Promise<ApiResponseDto<{ message: string }>> {
    const result = await this.authService.deleteIncompleteSignup(userId);
    return {
      success: true,
      data: result,
      message: result.message,
    };
  }
}

