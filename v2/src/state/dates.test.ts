import { describe, expect, it } from 'vitest';
import { dateline, dayLabel, dayOfYear, daysInYear, isoWeek, monthGrid, timeLabel } from './dates';

describe('journal dates', () => {
  const wed = new Date(2026, 8, 24, 14, 2);

  it('writes the dateline in full', () => {
    expect(dateline(wed)).toBe('Thursday, 24 September 2026');
  });

  it('counts the day and the week of the year', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(wed)).toBe(267);
    expect(daysInYear(wed)).toBe(365);
    expect(daysInYear(new Date(2028, 5, 1))).toBe(366);
    expect(isoWeek(wed)).toBe(39);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53); // 1 Jan 2027 is a Friday: still ISO week 53 of 2026
  });

  it('puts the time in the margin', () => {
    expect(timeLabel(wed.getTime())).toBe('14:02');
    expect(timeLabel(new Date(2026, 8, 24, 9, 5).getTime())).toBe('09:05');
  });

  it('heads earlier days the way a diary does', () => {
    expect(dayLabel('2026-09-24', '2026-09-24')).toBe('Today');
    expect(dayLabel('2026-09-23', '2026-09-24')).toBe('Yesterday');
    expect(dayLabel('2026-09-21', '2026-09-24')).toBe('Mon 21 Sep');
    expect(dayLabel('2025-12-31', '2026-09-24')).toBe('Wed 31 Dec 2025');
  });

  it('lays a month out Monday-first in rows of seven', () => {
    const cells = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe('2026-09-01');
    expect(cells.filter(Boolean).length).toBe(30);
    expect(cells[cells.length - 1]).toBeNull();
  });
});
