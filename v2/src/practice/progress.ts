// What the player has actually done, kept between sessions: best score per
// drill, which lesson steps are finished, and which days had practice in them.

import { LensId } from '../theory/solo';
import { storageKey } from '../state/storage';

export interface Progress {
  /** best graded pass per drill, 0..100 */
  drillBest: Partial<Record<LensId, number>>;
  /** graded passes per drill */
  drillPasses: Partial<Record<LensId, number>>;
  /** lesson step ids that are done */
  lessons: string[];
  /** local dates (YYYY-MM-DD) with at least one graded pass or finished step */
  days: string[];
  /** best sprint score per fretboard drill, and how many sprints were run */
  fretBest: Record<string, number>;
  fretRuns: Record<string, number>;
  /** what keeps getting missed (interval / chord-tone / string tags) — dealt more often until it stops */
  fretMisses: Record<string, number>;
}

const KEY = storageKey('progress');
const EMPTY: Progress = { drillBest: {}, drillPasses: {}, lessons: [], days: [], fretBest: {}, fretRuns: {}, fretMisses: {} };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) } : EMPTY;
  }
  catch {
    return EMPTY;
  }
}

export const saveProgress = (p: Progress): void => localStorage.setItem(KEY, JSON.stringify(p));

export const dayKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const touchDay = (p: Progress, today: string): string[] => (p.days.includes(today) ? p.days : [...p.days, today].slice(-400));

export function recordPass(p: Progress, lens: LensId, score: number, today = dayKey()): Progress {
  return {
    ...p,
    drillBest: { ...p.drillBest, [lens]: Math.max(p.drillBest[lens] ?? 0, score) },
    drillPasses: { ...p.drillPasses, [lens]: (p.drillPasses[lens] ?? 0) + 1 },
    days: touchDay(p, today),
  };
}

export function recordLesson(p: Progress, stepId: string, today = dayKey()): Progress {
  return p.lessons.includes(stepId) ? p : { ...p, lessons: [...p.lessons, stepId], days: touchDay(p, today) };
}

/** A finished fretboard sprint: keep the best, and let each card's outcome raise or relax its tag's weight. */
export function recordSprint(p: Progress, kind: string, score: number, cards: { tag: string; right: boolean }[], today = dayKey()): Progress {
  const fretMisses = { ...p.fretMisses };
  for (const c of cards) {
    const next = Math.max(0, (fretMisses[c.tag] ?? 0) + (c.right ? -1 : 1));
    if (next) fretMisses[c.tag] = next;
    else delete fretMisses[c.tag];
  }
  return {
    ...p, fretMisses,
    fretBest: { ...p.fretBest, [kind]: Math.max(p.fretBest[kind] ?? 0, score) },
    fretRuns: { ...p.fretRuns, [kind]: (p.fretRuns[kind] ?? 0) + 1 },
    days: touchDay(p, today),
  };
}

/** Consecutive practice days ending today (or yesterday — today isn't over yet). */
export function streak(p: Progress, today = new Date()): number {
  const days = new Set(p.days);
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
