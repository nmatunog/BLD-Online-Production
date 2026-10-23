export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function manilaTodayParts(): { year: number; month: number; day: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day };
}

export function formatPct(pct: number | null): string {
  return pct == null ? 'n/a' : `${pct}%`;
}

export function formatAttendedHeld(attended: number, held: number): string {
  return held === 0 ? 'n/a' : `${attended}/${held}`;
}

export function periodLabel(year: number, month: number | null): string {
  if (!month) return String(year);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatGeneratedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function isLowPct(pct: number | null): boolean {
  return pct != null && pct < 50;
}
