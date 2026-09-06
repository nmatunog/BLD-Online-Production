/**
 * BLD Event Standards v1 - Phase 4: One-offs + LSS suggest + shepherding track
 * 
 * Annual programs catalog and LSS shepherding date helpers
 */

/**
 * Official annual program catalog.
 * These programs have standardized titles and are created on-demand (not auto-generated).
 */
export const ANNUAL_PROGRAMS_CATALOG = {
  MARRIAGE_ENCOUNTER: {
    title: 'Marriage Encounter',
    category: 'Encounter',
    eventType: 'ME',
    encounterType: 'ME',
    maxPerYear: 3,
    typicalMonths: [7, 8, 9, 10, 11], // Jul-Nov
    description: 'A weekend encounter program for married couples to strengthen their relationship.',
    durationDays: 3, // Friday-Sunday typically
  },
  SINGLES_ENCOUNTER: {
    title: 'Singles Encounter',
    category: 'Encounter',
    eventType: 'SE',
    encounterType: 'SE',
    maxPerYear: 2,
    typicalMonths: [7, 10], // Jul, Oct
    description: 'A weekend encounter program for single adults.',
    durationDays: 3,
  },
  SOLO_PARENTS_ENCOUNTER: {
    title: 'Solo Parents Encounter',
    category: 'Encounter',
    eventType: 'SPE',
    encounterType: 'SPE',
    maxPerYear: 1,
    typicalMonths: [9, 10], // Sep-Oct
    description: 'A weekend encounter program for solo parents.',
    durationDays: 3,
  },
  YOUTH_ENCOUNTER: {
    title: 'Youth Encounter',
    category: 'Encounter',
    eventType: 'YE',
    encounterType: 'YE',
    maxPerYear: 1,
    typicalMonths: [5, 6], // May-Jun
    description: 'A weekend encounter program for youth.',
    durationDays: 3,
  },
  FAMILY_ENRICHMENT: {
    title: 'Family Enrichment',
    category: 'Family',
    eventType: 'FE',
    maxPerYear: 1,
    typicalMonths: [4, 5], // Apr-May
    description: 'Annual family enrichment program.',
    durationDays: 1,
  },
  LSS_WEEKEND: {
    title: 'Life in the Spirit Seminar',
    category: 'Formation',
    eventType: 'LSS',
    maxPerYear: 1,
    typicalMonths: [3], // March
    description: 'Annual Life in the Spirit Seminar weekend.',
    durationDays: 2, // Sat-Sun
    defaultWeekOfMonth: 1, // 1st weekend of March
    defaultDayOfWeek: 6, // Saturday
  },
} as const;

export type AnnualProgramKey = keyof typeof ANNUAL_PROGRAMS_CATALOG;

/**
 * Convert Date to Manila timezone string YYYY-MM-DD
 */
export function toManilaDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Get the first occurrence of a day of week in a given month/year (Manila timezone).
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @returns Date object for the first occurrence
 */
export function getFirstDayOfWeekInMonth(year: number, month: number, dayOfWeek: number): Date {
  // Create date in Manila timezone for the 1st of the month
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const manilaStr = toManilaDateString(firstOfMonth);
  const [y, m] = manilaStr.split('-').map(Number);
  
  // Find the first occurrence of the target day
  const tempDate = new Date(Date.UTC(y, m - 1, 1));
  const firstDay = tempDate.getUTCDay();
  const daysToAdd = (dayOfWeek - firstDay + 7) % 7;
  
  return new Date(Date.UTC(y, m - 1, 1 + daysToAdd));
}

/**
 * Get the last Tuesday of January for a given year (Manila timezone).
 * Used as the start of LSS Salubungan.
 */
export function getLastTuesdayOfJanuary(year: number): Date {
  // Get the last day of January
  const lastDay = new Date(Date.UTC(year, 1, 0)); // Month 1 (Feb), day 0 = last day of Jan
  const manilaStr = toManilaDateString(lastDay);
  const [y, m, d] = manilaStr.split('-').map(Number);
  
  // Find the last Tuesday
  let testDate = new Date(Date.UTC(y, m - 1, d));
  while (testDate.getUTCDay() !== 2) { // 2 = Tuesday
    testDate.setUTCDate(testDate.getUTCDate() - 1);
  }
  
  return testDate;
}

/**
 * Get the date of the Nth Tuesday after a given date (Manila timezone).
 * @param startDate - Starting date
 * @param count - Number of Tuesdays after (1 = next Tuesday, 2 = 2nd Tuesday after, etc.)
 */
export function getTuesdayAfter(startDate: Date, count: number): Date {
  const date = new Date(startDate);
  let found = 0;
  
  while (found < count) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() === 2) { // Tuesday
      found++;
    }
  }
  
  return date;
}

/**
 * Calculate LSS Shepherding schedule dates given the LSS Weekend date.
 * Returns an array of dates: [Salubungan, Session 1, Session 2, ..., Session 6]
 * 
 * - Salubungan: last Tuesday of January
 * - Sessions: subsequent Tuesdays until 2 Tuesdays after LSS Weekend
 */
export function calculateLssShepherdingDates(lssWeekendDate: Date, year: number): Date[] {
  const salubungan = getLastTuesdayOfJanuary(year);
  const dates: Date[] = [salubungan];
  
  // Calculate how many Tuesdays we need from Salubungan to 2 Tuesdays after LSS
  // We need exactly 6 shepherding sessions after Salubungan
  let currentDate = new Date(salubungan);
  
  for (let i = 0; i < 6; i++) {
    currentDate = getTuesdayAfter(currentDate, 1);
    dates.push(new Date(currentDate));
  }
  
  return dates;
}

/**
 * Suggest default dates for LSS Weekend (1st Saturday-Sunday of March in Manila timezone)
 */
export function suggestLssWeekendDates(year: number): { startDate: Date; endDate: Date } {
  const firstSaturday = getFirstDayOfWeekInMonth(year, 3, 6); // March, Saturday
  const sunday = new Date(firstSaturday);
  sunday.setUTCDate(sunday.getUTCDate() + 1);
  
  // Set times: Saturday 8:00 - Sunday 17:00 (typical LSS weekend)
  const startDate = new Date(firstSaturday);
  startDate.setUTCHours(8, 0, 0, 0);
  
  const endDate = new Date(sunday);
  endDate.setUTCHours(17, 0, 0, 0);
  
  return { startDate, endDate };
}
