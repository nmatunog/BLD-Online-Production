export const PUBLIC_NFC_ORIGIN = 'https://app.bldcebu.com';

export type MemberCardStatus = 'ACTIVE' | 'ENCODED' | 'REVOKED';
export type DoorVerifyStatus = 'ACTIVE' | 'REVOKED' | 'NOT_FOUND';

/** Resolved display DTO. `ministry` is never null — use resolveMemberMinistry(). */
export type PublicCardMember = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  communityId: string;
  ministry: string;
  photoUrl: string | null;
};

/** Prisma/DB shape before display fallback. */
export type MemberMinistryDbRecord = {
  ministry?: string | null;
  ministryHistory?: Array<{
    ministry?: string | null;
    endDate?: string | Date | null;
    startDate?: string | Date | null;
  }>;
  user?: { ministry?: string | null } | null;
};

export type PublicVerifyMember = {
  fullName: string;
  memberId: string;
  ministry: string;
  photoUrl: string | null;
};

export type PublicVerifyResult = {
  view: 'public';
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND';
  member: PublicVerifyMember | null;
};

export type StaffVerifyResult = {
  view: 'staff';
  status: DoorVerifyStatus;
  cardStatus: MemberCardStatus | null;
  member: PublicCardMember | null;
  cardId: string | null;
};

export function buildNfcUrl(token: string, origin = PUBLIC_NFC_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/verify/${token}`;
}

export const NO_MINISTRY_ASSIGNED = 'No ministry assigned';

export function resolveMemberMinistry(member: MemberMinistryDbRecord): string {
  const open = (member.ministryHistory ?? []).filter((row) => row.endDate == null);
  const latest = [...open].sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return bTime - aTime;
  })[0];
  const fromHistory = latest?.ministry?.trim();
  if (fromHistory) return fromHistory;
  const fromMember = member.ministry?.trim();
  if (fromMember) return fromMember;
  const fromUser = member.user?.ministry?.trim();
  return fromUser || NO_MINISTRY_ASSIGNED;
}

export function printerMemberName(member: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim();
}

export function doorMemberName(member: PublicCardMember): string {
  const nick = (member.nickname || '').trim();
  const last = (member.lastName || '').trim();
  if (nick) return last ? `${nick} ${last}` : nick;
  return printerMemberName(member);
}

export function adminCardStatusLabel(status: MemberCardStatus, encodedAt?: string | null): string {
  if (status === 'REVOKED') return 'Revoked';
  if (status === 'ENCODED' || encodedAt) return 'Encoded';
  return 'Issued';
}

export function isValidDoorCard(status: DoorVerifyStatus): boolean {
  return status === 'ACTIVE';
}

export const CARD_ADMIN_ROLES = ['SUPER_USER', 'ADMINISTRATOR', 'DCS'] as const;
export const CARD_STAFF_ROLES = [
  'SUPER_USER',
  'ADMINISTRATOR',
  'DCS',
  'MINISTRY_COORDINATOR',
  'CLASS_SHEPHERD',
] as const;

export function isCardAdminRole(role: string | null | undefined): boolean {
  return !!role && (CARD_ADMIN_ROLES as readonly string[]).includes(role);
}

/** Admin and door-staff roles only. Regular MEMBER is never allowed, even with a ministry. */
export function canVerifyMemberCards(role: string | null | undefined): boolean {
  return !!role && (CARD_STAFF_ROLES as readonly string[]).includes(role);
}

export const PRINTER_NFC_HELP = [
  'Print the plastic card first. The NTAG215 or NTAG216 chip stays blank.',
  'Encode with this portal (Chrome on Android) or NFC Tools: one NDEF URI record.',
  'URI: https://app.bldcebu.com/verify/<token>',
  'After a successful read-back, lock the tag (make read-only). Locking is permanent.',
].join(' ');
