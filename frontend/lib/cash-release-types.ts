/** Mirrors Prisma `CashReleaseType` — keep labels user-friendly for finance volunteers. */
export const CASH_RELEASE_TYPES = [
  'CASH_ADVANCE',
  'REIMBURSEMENT',
  'PURCHASE',
  'PETTY_CASH',
  'SUPPLIES',
  'HONORARIUM',
  'TRANSPORT',
  'OTHER',
] as const;

export type CashReleaseType = (typeof CASH_RELEASE_TYPES)[number];

export const CASH_RELEASE_TYPE_LABELS: Record<CashReleaseType, string> = {
  CASH_ADVANCE: 'Cash advance',
  REIMBURSEMENT: 'Reimbursement',
  PURCHASE: 'Purchase',
  PETTY_CASH: 'Petty cash',
  SUPPLIES: 'Supplies',
  HONORARIUM: 'Honorarium',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};

export function labelCashReleaseType(value: string | null | undefined): string {
  if (value && value in CASH_RELEASE_TYPE_LABELS) {
    return CASH_RELEASE_TYPE_LABELS[value as CashReleaseType];
  }
  return '—';
}
