/**
 * Device Memory Service - Remember member identity on this device
 * 
 * Security: Matches the public check-in bar (accepts communityId without password).
 * Storage: localStorage with communityId, memberId, and display name.
 * Use case: One phone, one remembered member at a time. Couples can switch with "Not you?"
 */

export interface RememberedMember {
  communityId: string;
  memberId: string;
  displayName: string;
  rememberedAt: string;
  role?: string;
}

const STORAGE_KEY = 'bld_remembered_member';

export const deviceMemory = {
  rememberMember(data: {
    communityId: string;
    memberId: string;
    firstName: string;
    lastName: string;
    nickname?: string | null;
    role?: string;
  }): RememberedMember {
    const displayName = data.nickname
      ? `${data.nickname} ${data.lastName}`
      : `${data.firstName} ${data.lastName}`;

    const remembered: RememberedMember = {
      communityId: data.communityId,
      memberId: data.memberId,
      displayName,
      rememberedAt: new Date().toISOString(),
      role: data.role || 'MEMBER',
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remembered));
      } catch (error) {
        console.error('Failed to remember member:', error);
      }
    }

    return remembered;
  },

  getRememberedMember(): RememberedMember | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as RememberedMember;

      if (
        !parsed.communityId ||
        !parsed.memberId ||
        !parsed.displayName ||
        !parsed.rememberedAt
      ) {
        this.clearRememberedMember();
        return null;
      }

      if (!parsed.role) {
        parsed.role = 'MEMBER';
      }

      return parsed;
    } catch (error) {
      console.error('Failed to get remembered member:', error);
      return null;
    }
  },

  clearRememberedMember(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear remembered member:', error);
      }
    }
  },

  hasRememberedMember(): boolean {
    return this.getRememberedMember() !== null;
  },

  getDisplayText(): string {
    const remembered = this.getRememberedMember();
    if (!remembered) {
      return '';
    }
    return `This phone is remembered as ${remembered.displayName}`;
  },

  isStaffOrAdmin(): boolean {
    const remembered = this.getRememberedMember();
    if (!remembered || !remembered.role) {
      return false;
    }
    const staffRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR', 'CLASS_SHEPHERD'];
    return staffRoles.includes(remembered.role);
  },
};
