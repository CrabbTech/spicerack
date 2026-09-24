// Dates the way a journal writes them: a dateline, the day of the year, the
// week, a time in the margin, and a month laid out as a grid of days.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Wednesday, 24 September 2026" */
export const dateline = (d = new Date()): string =>
  `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "September 2026" */
export const monthName = (year: number, month: number): string => `${MONTHS[month]} ${year}`;

/** 1 on New Year's Day. */
export function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86400000) + 1;
}

export const daysInYear = (d = new Date()): number => (dayOfYear(new Date(d.getFullYear(), 11, 31)));

/** ISO week number: weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(d = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** "14:02" — the time a line was written, for the margin. */
export function timeLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Local YYYY-MM-DD, the key every day-keyed store uses. */
export const dayKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseDay = (day: string): Date => {
  const [y, m, dd] = day.split('-').map(Number);
  return new Date(y, m - 1, dd);
};

/** How a journal heads an earlier day: Today, Yesterday, then "Mon 22 Sep" (with the year once it differs). */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  const d = parseDay(day);
  const t = parseDay(today);
  if (dayKeyOf(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1)) === day) return 'Yesterday';
  const label = `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return d.getFullYear() === t.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

/** A month as rows of seven, Monday first; leading and trailing cells are null. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d++) cells.push(dayKeyOf(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}
