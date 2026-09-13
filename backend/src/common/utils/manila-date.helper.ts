/**
 * Manila Timezone Helper Functions
 * 
 * BLD Event Standards v1: All event dates/times are in Asia/Manila timezone
 * These helpers ensure correct conversion between Manila calendar dates and UTC storage
 */

const MANILA_TZ = 'Asia/Manila';

/**
 * Convert a Date to Manila date string (YYYY-MM-DD)
 * Uses Intl.DateTimeFormat for accurate timezone conversion
 */
export function toManilaDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Get the weekday name for a date in Manila timezone
 */
export function getManilaWeekday(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    weekday: 'long',
  }).format(d);
}

/**
 * Get Manila day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getManilaDayOfWeek(d: Date): number {
  const dateStr = toManilaDateString(d);
  // Parse the Manila date and get its day of week
  const [year, month, day] = dateStr.split('-').map(Number);
  const manilaDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // Use noon to avoid edge cases
  return manilaDate.getUTCDay();
}

/**
 * Build a Manila date-time from calendar components
 * Returns a Date object representing the given Manila calendar date/time
 * 
 * Example: buildManilaDateTime(2026, 9, 15, 19, 0) 
 *   → Date representing Tuesday Sep 15, 2026 19:00 Manila (stored as 11:00 UTC)
 */
export function buildManilaDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
): Date {
  // Build ISO string with Manila offset (+08:00)
  const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+08:00`;
  return new Date(isoString);
}

/**
 * Get the next occurrence of a specific weekday in Manila timezone
 * @param baseDate - The date to start from (in UTC)
 * @param targetDayOfWeek - Target day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @param hour - Hour in Manila time (0-23)
 * @param minute - Minute in Manila time (0-59)
 * @returns Date object representing the next occurrence of that weekday at the specified time
 */
export function getNextWeekdayManila(
  baseDate: Date,
  targetDayOfWeek: number,
  hour: number,
  minute: number,
): Date {
  // Get Manila date for base
  const manilaDateStr = toManilaDateString(baseDate);
  const [year, month, day] = manilaDateStr.split('-').map(Number);
  
  // Get current day of week in Manila
  const currentDayOfWeek = getManilaDayOfWeek(baseDate);
  
  // Calculate days until next occurrence
  let daysUntil = targetDayOfWeek - currentDayOfWeek;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }
  
  // Build target date
  const targetDay = day + daysUntil;
  return buildManilaDateTime(year, month, targetDay, hour, minute);
}

/**
 * Check if a date (in Manila timezone) falls in the blackout period (Dec 24 - Jan 1)
 */
export function isInBlackoutPeriod(d: Date): boolean {
  const manilaStr = toManilaDateString(d);
  const [, month, day] = manilaStr.split('-').map(Number);
  return (month === 12 && day >= 24) || (month === 1 && day === 1);
}

/**
 * Get the week-of-month (1st, 2nd, 3rd, 4th, 5th) for a date in Manila timezone
 */
export function getWeekOfMonth(d: Date): number {
  const manilaStr = toManilaDateString(d);
  const [, , day] = manilaStr.split('-').map(Number);
  return Math.ceil(day / 7);
}

/**
 * Check if a date is 1st or 3rd Tuesday of the month (Holy Mass subtype for CW)
 */
export function isHolyMassTuesday(d: Date): boolean {
  const weekday = getManilaWeekday(d);
  if (weekday !== 'Tuesday') return false;
  
  const week = getWeekOfMonth(d);
  return week === 1 || week === 3;
}

/**
 * Add days to a Manila calendar date, preserving Manila time
 * @param date - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New date with days added, preserving the same Manila time-of-day
 */
export function addDaysManila(date: Date, days: number): Date {
  // Get Manila date components
  const manilaDateStr = toManilaDateString(date);
  const [year, month, day] = manilaDateStr.split('-').map(Number);
  
  // Get Manila time components
  const manilaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  
  const [hour, minute, second] = manilaTime.split(':').map(Number);
  
  // Calculate new date
  const newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  newDate.setUTCDate(newDate.getUTCDate() + days);
  
  const newYear = newDate.getUTCFullYear();
  const newMonth = newDate.getUTCMonth() + 1;
  const newDay = newDate.getUTCDate();
  
  return buildManilaDateTime(newYear, newMonth, newDay, hour, minute, second);
}
