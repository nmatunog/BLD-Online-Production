import { UserRole } from '@prisma/client';
export interface AuthResult {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string | null;
        phone: string | null;
        role: UserRole;
    };
}
