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
  displayName: string; // e.g., "Ez" or "Nilo Matunog"
  rememberedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'bld_remembered_member';

export const deviceMemory = {
  /**
   * Remember a member on this device
   */
  rememberMember(data: {
    communityId: string;
    memberId: string;
    firstName: string;
    lastName: string;
    nickname?: string | null;
  }): RememberedMember {
    const displayName = data.nickname
      ? `${data.nickname} ${data.lastName}`
      : `${data.firstName} ${data.lastName}`;

    const remembered: RememberedMember = {
      communityId: data.communityId,
      memberId: data.memberId,
      displayName,
      rememberedAt: new Date().toISOString(),
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

  /**
   * Get the remembered member on this device (if any)
   */
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

      // Validate structure
      if (
        !parsed.communityId ||
        !parsed.memberId ||
        !parsed.displayName ||
        !parsed.rememberedAt
      ) {
        // Invalid data, clear it
        this.clearRememberedMember();
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to get remembered member:', error);
      return null;
    }
  },

  /**
   * Clear the remembered member ("Not you?" button)
   */
  clearRememberedMember(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear remembered member:', error);
      }
    }
  },

  /**
   * Check if this device has a remembered member
   */
  hasRememberedMember(): boolean {
    return this.getRememberedMember() !== null;
  },

  /**
   * Get a short description of the remembered member for UI display
   * e.g., "This phone is remembered as Ez"
   */
  getDisplayText(): string {
    const remembered = this.getRememberedMember();
    if (!remembered) {
      return '';
    }
    return `This phone is remembered as ${remembered.displayName}`;
  },
};
