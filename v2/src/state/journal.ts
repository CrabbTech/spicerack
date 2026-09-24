// The journal proper: everything the app told you, kept with the day and the
// time it said it. The reducer's log is the working copy for one session;
// this is the book it gets written into, and it comes back on the next launch.

import { storageKey } from './storage';
import { dayKeyOf, dayLabel } from './dates';

export interface JournalEntry {
  id: string;
  /** when it was written, ms since the epoch */
  at: number;
  title: string;
  text: string;
  kind: 'spice' | 'info';
}

const KEY = storageKey('journal');
/** how many lines the book keeps — about a season of steady use */
export const JOURNAL_KEEP = 400;

export function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as JournalEntry[]) : [];
    return Array.isArray(list)
      ? list.filter((e) => e && typeof e.at === 'number' && typeof e.title === 'string' && typeof e.text === 'string')
      : [];
  }
  catch {
    return [];
  }
}

export function saveJournal(list: JournalEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-JOURNAL_KEEP)));
  }
  catch {
    // storage full or unavailable — the session log still shows everything
  }
}

/** Newer lines go at the end; a line that repeats the one before it is not written twice; the book stays at most JOURNAL_KEEP lines long. */
export function appendJournal(list: JournalEntry[], entries: JournalEntry[]): JournalEntry[] {
  const next = [...list];
  for (const e of entries) {
    const last = next[next.length - 1];
    if (last && last.title === e.title && last.text === e.text) continue;
    next.push(e);
  }
  return next.slice(-JOURNAL_KEEP);
}

export interface JournalDay {
  day: string;
  label: string;
  /** newest first */
  entries: JournalEntry[];
}

/** The book opened at today: days newest first, and within a day the newest line on top. */
export function journalDays(list: JournalEntry[], today = dayKeyOf(new Date())): JournalDay[] {
  const byDay = new Map<string, JournalEntry[]>();
  for (const e of list) {
    const day = dayKeyOf(new Date(e.at));
    const bucket = byDay.get(day);
    if (bucket) bucket.push(e);
    else byDay.set(day, [e]);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, entries]) => ({ day, label: dayLabel(day, today), entries: [...entries].sort((a, b) => b.at - a.at) }));
}
