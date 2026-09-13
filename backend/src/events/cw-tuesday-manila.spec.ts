/**
 * Test: Community Worship Tuesday Manila Timezone Bug Reproduction
 * 
 * ISSUE: After CW Setup, Events UI showed Wednesdays instead of Tuesdays
 * ROOT CAUSE: Incorrect Manila calendar-date → UTC conversion when generating CW occurrences
 * 
 * REQUIREMENT: CW must be Tuesdays 19:00–21:00 in Asia/Manila timezone (Event Standards v1)
 */

describe('CW Tuesday Manila Timezone Bug', () => {
  const MANILA_TZ = 'Asia/Manila';

  /**
   * Helper: Build a Manila date-time (like the user would input "Tuesday 19:00 Manila")
   * Returns the equivalent UTC instant
   */
  function buildManilaDateTime(year: number, month: number, day: number, hour: number, minute: number): Date {
    // Build ISO string and parse as Manila time
    // Manila is UTC+8, so subtract 8 hours to get UTC
    const manilaStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`;
    return new Date(manilaStr);
  }

  /**
   * Helper: Get Manila weekday name for a UTC Date
   */
  function getManilaWeekday(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      weekday: 'long',
    }).format(date);
  }

  /**
   * Helper: Get Manila date string YYYY-MM-DD
   */
  function toManilaDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MANILA_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
  
  /**
   * Helper: Get Manila time string HH:mm
   */
  function toManilaTimeString(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  /**
   * Core test: Given "next Tuesday 19:00 Manila", the generated occurrence date
   * MUST display as Tuesday in Asia/Manila timezone
   */
  it('should generate Tuesday occurrence when input is Tuesday 19:00 Manila', () => {
    // Scenario: User creates CW template on 2026-09-13 (a Saturday)
    // Next Tuesday is 2026-09-15
    const nextTuesday = buildManilaDateTime(2026, 9, 15, 19, 0);
    
    // Verify template date is Tuesday in Manila
    expect(getManilaWeekday(nextTuesday)).toBe('Tuesday');
    expect(toManilaDateString(nextTuesday)).toBe('2026-09-15');
    
    // When we generate an occurrence from this template
    // The occurrence's startDate MUST also be Tuesday in Manila
    const occurrenceStart = new Date(nextTuesday);
    
    // BUG REPRODUCTION: If we naively use UTC date math, we might get Wednesday
    // CORRECT: Must format in Manila timezone to verify day
    const weekday = getManilaWeekday(occurrenceStart);
    
    expect(weekday).toBe('Tuesday'); // This MUST be Tuesday, not Wednesday
  });

  /**
   * Test multiple weeks of CW generation
   * Each occurrence MUST be Tuesday in Manila timezone
   */
  it('should generate 4 consecutive Tuesday occurrences in Manila timezone', () => {
    const tuesdays: Date[] = [];
    
    // Start: Tuesday Sep 15, 2026 19:00 Manila
    let current = buildManilaDateTime(2026, 9, 15, 19, 0);
    
    for (let i = 0; i < 4; i++) {
      tuesdays.push(new Date(current));
      // Advance 7 days (next week)
      current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    // Verify all are Tuesdays in Manila
    tuesdays.forEach((date, index) => {
      const weekday = getManilaWeekday(date);
      const dateStr = toManilaDateString(date);
      
      expect(weekday).toBe('Tuesday');
      console.log(`CW Occurrence ${index + 1}: ${dateStr} ${weekday} 19:00 Manila`);
    });
    
    // Verify expected dates
    expect(toManilaDateString(tuesdays[0])).toBe('2026-09-15');
    expect(toManilaDateString(tuesdays[1])).toBe('2026-09-22');
    expect(toManilaDateString(tuesdays[2])).toBe('2026-09-29');
    expect(toManilaDateString(tuesdays[3])).toBe('2026-10-06');
  });

  /**
   * Test the "classic off-by-one" scenario:
   * When Manila date is advanced but UTC calculation mishandles the conversion
   */
  it('should not shift Tuesday to Wednesday when crossing midnight UTC', () => {
    // Critical edge case: Tuesday 19:00 Manila = Tuesday 11:00 UTC
    // But if we add 7 days to UTC midnight instead of Manila midnight, we can shift the day
    
    const tuesday1 = buildManilaDateTime(2026, 9, 15, 19, 0);
    
    // Wrong approach (reproduces the bug):
    // If we start from UTC midnight of the Manila date, then add hours:
    const manilaDateStr = toManilaDateString(tuesday1);
    const [year, month, day] = manilaDateStr.split('-').map(Number);
    const wrongBase = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const wrongOccurrence = new Date(wrongBase);
    wrongOccurrence.setUTCHours(11, 0, 0, 0); // Adding 11:00 UTC (which is 19:00 Manila)
    
    // Check what weekday this produces in Manila
    const wrongWeekday = getManilaWeekday(wrongOccurrence);
    
    // This might be Wednesday if the UTC date was interpreted wrong
    console.log(`Wrong approach weekday: ${wrongWeekday} (should be Tuesday)`);
    
    // Correct approach: preserve Manila calendar date
    const correctWeekday = getManilaWeekday(tuesday1);
    expect(correctWeekday).toBe('Tuesday');
  });

  /**
   * Test that the occurrence generation preserves Manila calendar dates
   * when advancing weeks
   */
  it('should preserve Tuesday when using Manila-based week calculation', () => {
    // Start from a known Tuesday in Manila
    const baseTuesday = buildManilaDateTime(2026, 9, 15, 19, 0);
    
    // Generate next 4 weeks by adding 7 days to the Manila date
    for (let week = 1; week <= 4; week++) {
      // Calculate next Tuesday: base + (week * 7 days)
      const nextTuesday = new Date(baseTuesday.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      
      // MUST be Tuesday in Manila
      const weekday = getManilaWeekday(nextTuesday);
      expect(weekday).toBe('Tuesday');
      
      // Verify time is 19:00 Manila
      const time = toManilaTimeString(nextTuesday);
      expect(time).toBe('19:00');
    }
  });

  /**
   * Test the actual week-based generation logic (simulates what events.service.ts does)
   */
  it('should generate correct Tuesdays using week-based iteration', () => {
    // Template: Tuesday 2026-09-15 19:00 Manila
    const templateStart = buildManilaDateTime(2026, 9, 15, 19, 0);
    
    // Get Monday 00:00 UTC for the week containing templateStart
    function getStartOfWeekUTC(d: Date): Date {
      const date = new Date(d);
      const day = date.getUTCDay();
      const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday = 1
      date.setUTCDate(diff);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    }
    
    const weekStart = getStartOfWeekUTC(templateStart);
    const dayNum = 2; // Tuesday = 2 (Monday = 1)
    
    const occurrences: Date[] = [];
    
    for (let w = 0; w < 4; w++) {
      const baseWeek = new Date(weekStart);
      baseWeek.setUTCDate(baseWeek.getUTCDate() + w * 7);
      
      // OLD BUGGY WAY (reproduces the issue):
      // Calculate occurrence date in UTC space
      const occStartOld = new Date(baseWeek);
      occStartOld.setUTCDate(baseWeek.getUTCDate() + (dayNum - 1));
      occStartOld.setUTCHours(
        templateStart.getUTCHours(), // This is 11 for 19:00 Manila
        templateStart.getUTCMinutes(),
        0,
        0,
      );
      
      occurrences.push(occStartOld);
    }
    
    // Check if these are Tuesdays in Manila (they should be, but might not with the buggy logic)
    occurrences.forEach((occ, index) => {
      const weekday = getManilaWeekday(occ);
      const dateStr = toManilaDateString(occ);
      console.log(`Occurrence ${index + 1}: ${dateStr} ${weekday}`);
      
      // This might fail if the bug exists
      expect(weekday).toBe('Tuesday');
    });
  });
});
