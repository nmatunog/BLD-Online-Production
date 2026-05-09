import { UserRole } from '@prisma/client';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    /**
     * For MINISTRY_COORDINATOR: the ministry they coordinate (used for event scoping).
     * Null/empty for everyone else.
     */
    ministry?: string | null;
  };
  member?: {
    nickname: string | null;
    lastName: string;
    firstName: string;
    communityId?: string;
    /**
     * The ministry this member serves in (Member.ministry). Used to grant ministry-aligned
     * MEMBERs staff-level access to events whose ministry matches.
     */
    ministry?: string | null;
    apostolate?: string | null;
  };
}

