export const PUBLIC_NFC_ORIGIN = 'https://app.bldcebu.com';

export type MemberCardStatus = 'ACTIVE' | 'ENCODED' | 'REVOKED';
export type DoorVerifyStatus = 'ACTIVE' | 'REVOKED' | 'NOT_FOUND';

export type PublicCardMember = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  communityId: string;
  ministry: string | null;
  photoUrl: string | null;
};

export function buildNfcUrl(token: string, origin = PUBLIC_NFC_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/verify/${token}`;
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

export function canVerifyMemberCards(
  role: string | null | undefined,
  ministry?: string | null,
): boolean {
  if (!role) return false;
  if ((CARD_STAFF_ROLES as readonly string[]).includes(role)) return true;
  return role === 'MEMBER' && !!ministry?.trim();
}

export const PRINTER_NFC_HELP = [
  'Print the plastic card first. The NTAG215 or NTAG216 chip stays blank.',
  'Encode with this portal (Chrome on Android) or NFC Tools: one NDEF URI record.',
  'URI: https://app.bldcebu.com/verify/<token>',
  'After a successful read-back, lock the tag (make read-only). Locking is permanent.',
].join(' ');
