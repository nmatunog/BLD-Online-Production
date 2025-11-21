import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/reset-password.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { Public } from './decorators/public.decorator';

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
    description: 'Password reset email sent',
  })
  async requestPasswordReset(
    @Body() requestDto: RequestPasswordResetDto,
  ): Promise<ApiResponseDto<{ message: string }>> {
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
}

