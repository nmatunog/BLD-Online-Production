import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<ApiResponseDto<AuthResult>>;
    login(loginDto: LoginDto): Promise<ApiResponseDto<AuthResult>>;
    refreshToken(refreshTokenDto: RefreshTokenDto): Promise<ApiResponseDto<AuthResult>>;
    requestPasswordReset(requestDto: RequestPasswordResetDto): Promise<ApiResponseDto<{
        message: string;
    }>>;
    resetPassword(resetDto: ResetPasswordDto): Promise<ApiResponseDto<{
        message: string;
    }>>;
}
