import { MemberCardStatus } from '@prisma/client';

/** Printed Community ID: CEB-XX0000, plus production IDs like CEB-ME1801 and CEB-ME01-0001. */
export const PRINT_MEMBER_ID_PATTERN = /^CEB-[A-Z]{2,4}(?:\d{4}|\d{2}-\d{4})$/;

export const PRINT_READY_FILTERS = ['READY', 'MISSING', 'ALL'] as const;
export type PrintReadyFilter = (typeof PRINT_READY_FILTERS)[number];

export const MISSING_PRINT_ITEMS = ['photo', 'firstName', 'lastName', 'memberId', 'card'] as const;
export type MissingPrintItem = (typeof MISSING_PRINT_ITEMS)[number];

export type PrintReadyCard = {
  status?: string | null;
  tokenHash?: string | null;
  tokenEncrypted?: string | null;
};

export type PrintReadyMember = {
  firstName?: string | null;
  lastName?: string | null;
  communityId?: string | null;
  photoUrl?: string | null;
  cards?: PrintReadyCard[];
};

export function isValidPrintMemberId(communityId: string | null | undefined): boolean {
  return PRINT_MEMBER_ID_PATTERN.test((communityId ?? '').trim().toUpperCase());
}

function hasIssuedVerifyCard(cards: PrintReadyCard[] | undefined): boolean {
  return (cards ?? []).some((card) => {
    const issued =
      card.status === MemberCardStatus.ACTIVE || card.status === MemberCardStatus.ENCODED;
    const hasToken = Boolean(card.tokenHash?.trim() || card.tokenEncrypted?.trim());
    return issued && hasToken;
  });
}

/**
 * ID-print readiness. Not required: ministry, blood type, emergency contact, signature.
 */
export function assessPrintReadiness(member: PrintReadyMember): {
  ready: boolean;
  missing: MissingPrintItem[];
} {
  const missing: MissingPrintItem[] = [];
  if (!member.photoUrl?.trim()) missing.push('photo');
  if (!member.firstName?.trim()) missing.push('firstName');
  if (!member.lastName?.trim()) missing.push('lastName');
  if (!isValidPrintMemberId(member.communityId)) missing.push('memberId');
  if (!hasIssuedVerifyCard(member.cards)) missing.push('card');
  return { ready: missing.length === 0, missing };
}

export function matchesPrintReadyFilter(
  ready: boolean,
  filter: PrintReadyFilter | undefined,
): boolean {
  if (!filter || filter === 'ALL') return true;
  return filter === 'READY' ? ready : !ready;
}
