import { describe, expect, it } from 'vitest';
import { JOURNAL_KEEP, JournalEntry, appendJournal, journalDays } from './journal';

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const line = (id: string, when: number, title = 'Secondary dominant'): JournalEntry => ({ id, at: when, title, text: 'E7 pulls to A.', kind: 'spice' });

describe('the journal', () => {
  it('opens at today, newest line first, older days below', () => {
    const list = [
      line('a', at(2026, 9, 22, 18)),
      line('b', at(2026, 9, 24, 9, 5)),
      line('c', at(2026, 9, 24, 14, 2)),
      line('d', at(2026, 9, 23, 20)),
    ];
    const days = journalDays(list, '2026-09-24');
    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday', 'Tue 22 Sep']);
    expect(days[0].entries.map((e) => e.id)).toEqual(['c', 'b']);
  });

  it('puts lines written in the same instant in the order they were written, latest on top', () => {
    const same = at(2026, 9, 24, 14, 2);
    const days = journalDays([line('first', same, 'Borrowed iv'), line('second', same, 'Sus & release'), line('third', same, 'The burrow')], '2026-09-24');
    expect(days[0].entries.map((e) => e.id)).toEqual(['third', 'second', 'first']);
  });

  it('keeps the book to a fixed length, dropping the oldest lines', () => {
    const many = Array.from({ length: JOURNAL_KEEP }, (_, i) => line(`e${i}`, i, `Line ${i}`));
    const next = appendJournal(many, [line('new', 10_000)]);
    expect(next.length).toBe(JOURNAL_KEEP);
    expect(next[0].id).toBe('e1');
    expect(next[next.length - 1].id).toBe('new');
  });
});

describe('the journal, twice over', () => {
  it('does not write the same line twice in a row', () => {
    const first = line('a', at(2026, 9, 24, 9), 'Pop');
    const again = line('b', at(2026, 9, 24, 9, 1), 'Pop');
    const other = line('c', at(2026, 9, 24, 9, 2), 'Blues');
    const back = line('d', at(2026, 9, 24, 9, 3), 'Pop');
    expect(appendJournal([], [first, again, other, back]).map((e) => e.id)).toEqual(['a', 'c', 'd']);
  });
});
