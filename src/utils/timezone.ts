/**
 * Timezone-aware date & time utilities using IANA Time Zones:
 * - Primary: America/Toronto (handles EST UTC-5 and EDT UTC-4 automatically)
 * - Secondary: Asia/Colombo (UTC+5:30)
 */

export const TORONTO_TZ = 'America/Toronto';
export const COLOMBO_TZ = 'Asia/Colombo';

/**
 * Given a date string (YYYY-MM-DD) and time string (HH:mm) in America/Toronto,
 * returns the exact UTC Date object representing that wall-clock time in Toronto.
 */
export function parseTorontoDateTimeToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (timeStr || '08:00').split(':').map(Number);

  // Start with a UTC guess at the same wall-clock components
  const utcGuess = new Date(Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0));

  // Format that UTC instant in America/Toronto to determine Toronto's offset at that date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(utcGuess);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }

  const torontoHour = map.hour === 24 ? 0 : map.hour;
  const torontoAsUtc = Date.UTC(map.year, (map.month || 1) - 1, map.day || 1, torontoHour || 0, map.minute || 0, 0);
  const offsetMs = torontoAsUtc - utcGuess.getTime();

  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Converts a scheduled date (YYYY-MM-DD) and time (HH:mm) in America/Toronto
 * to Asia/Colombo time, accurately accounting for Toronto Daylight Saving Time (EDT vs EST).
 */
export function convertTorontoToColombo(dateStr: string, timeStr: string): {
  colomboDate: string;
  colomboTime: string;
  torontoTzAbbrev: string;
  formattedDual: string;
} {
  try {
    const utcDate = parseTorontoDateTimeToUtc(dateStr, timeStr);

    const colomboParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: COLOMBO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(utcDate);

    const cMap: Record<string, string> = {};
    for (const p of colomboParts) {
      if (p.type !== 'literal') cMap[p.type] = p.value;
    }

    const cHour = cMap.hour === '24' ? '00' : cMap.hour;
    const colomboDate = `${cMap.year}-${cMap.month}-${cMap.day}`;
    const colomboTime = `${cHour}:${cMap.minute}`;

    // Determine whether Toronto is in EDT or EST on this date
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: TORONTO_TZ,
      timeZoneName: 'short'
    }).formatToParts(utcDate);
    const tzName = tzParts.find(p => p.type === 'timeZoneName')?.value || 'ET';

    const dayDiff = colomboDate !== dateStr ? ` (${colomboDate.slice(5)})` : '';

    return {
      colomboDate,
      colomboTime,
      torontoTzAbbrev: tzName,
      formattedDual: `${timeStr} ${tzName} / ${colomboTime} LK${dayDiff}`
    };
  } catch {
    return {
      colomboDate: dateStr,
      colomboTime: timeStr,
      torontoTzAbbrev: 'ET',
      formattedDual: `${timeStr} ET`
    };
  }
}

/**
 * Returns today's YYYY-MM-DD in America/Toronto
 */
export function getTodayInToronto(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Generates a full calendar month grid (including leading/trailing padding days)
 * for any year and 0-indexed month.
 */
export function getMonthCalendarGrid(year: number, monthZeroIndexed: number): {
  dateStr: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
}[] {
  const firstDay = new Date(year, monthZeroIndexed, 1);
  const startWeekday = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(year, monthZeroIndexed + 1, 0).getDate();

  const cells: { dateStr: string; dayOfMonth: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, monthZeroIndexed, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevDate = new Date(year, monthZeroIndexed - 1, d);
    cells.push({
      dateStr: formatLocalYmd(prevDate),
      dayOfMonth: d,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(year, monthZeroIndexed, d);
    cells.push({
      dateStr: formatLocalYmd(currDate),
      dayOfMonth: d,
      isCurrentMonth: true
    });
  }

  // Next month padding to complete 7-column rows
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const needed = 7 - remainder;
    for (let d = 1; d <= needed; d++) {
      const nextDate = new Date(year, monthZeroIndexed + 1, d);
      cells.push({
        dateStr: formatLocalYmd(nextDate),
        dayOfMonth: d,
        isCurrentMonth: false
      });
    }
  }

  return cells;
}

export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDates(centerDateStr: string): string[] {
  const [y, m, d] = centerDateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dayOfWeek = dt.getDay();
  const sunday = new Date(dt);
  sunday.setDate(dt.getDate() - dayOfWeek);

  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(sunday);
    cur.setDate(sunday.getDate() + i);
    week.push(formatLocalYmd(cur));
  }
  return week;
}
