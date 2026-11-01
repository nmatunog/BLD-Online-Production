import type { MissingPrintItem } from '@/services/member-cards.service';

export const MISSING_PRINT_LABELS: Record<MissingPrintItem, string> = {
  photo: 'No photo',
  firstName: 'No first name',
  lastName: 'No last name',
  memberId: 'Invalid member ID',
  card: 'No issued card',
};
