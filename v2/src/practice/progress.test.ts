import { describe, expect, it } from 'vitest';
import { Progress, recordBurrow, recordLesson, recordPass, recordSprint, streak } from './progress';

const EMPTY: Progress = { drillBest: {}, drillPasses: {}, lessons: [], days: [], fretBest: {}, fretRuns: {}, fretMisses: {}, burrowBest: {} };

describe('progress', () => {
  it('keeps the best score and counts passes', () => {
    let p = recordPass(EMPTY, 'thirds', 60, '2026-09-20');
    p = recordPass(p, 'thirds', 45, '2026-09-20');
    expect(p.drillBest.thirds).toBe(60);
    expect(p.drillPasses.thirds).toBe(2);
    expect(p.days).toEqual(['2026-09-20']);
  });
  it('keeps the deepest floor of the burrow per genre, and counts a descent as practice', () => {
    let p = recordBurrow(EMPTY, 'pop', 3, '2026-09-20');
    p = recordBurrow(p, 'pop', 2, '2026-09-21');
    p = recordBurrow(p, 'blues', 0, '2026-09-22');
    expect(p.burrowBest).toEqual({ pop: 3 });
    expect(p.days).toEqual(['2026-09-20', '2026-09-21']);
  });
  it('marks lessons once', () => {
    const p = recordLesson(recordLesson(EMPTY, 'four.roots', '2026-09-20'), 'four.roots', '2026-09-21');
    expect(p.lessons).toEqual(['four.roots']);
    expect(p.days).toEqual(['2026-09-20']);
  });
  it('remembers what gets missed on the neck, and forgets it once it lands', () => {
    let p = recordSprint(EMPTY, 'interval', 70, [{ tag: '6', right: false }, { tag: '6', right: false }, { tag: '3', right: true }], '2026-09-20');
    expect(p.fretMisses).toEqual({ 6: 2 });
    expect(p.fretBest.interval).toBe(70);
    p = recordSprint(p, 'interval', 60, [{ tag: '6', right: true }, { tag: '6', right: true }], '2026-09-20');
    expect(p.fretMisses).toEqual({});
    expect(p.fretBest.interval).toBe(70);
    expect(p.fretRuns.interval).toBe(2);
  });
  it('counts a streak that ends today or yesterday', () => {
    const p: Progress = { ...EMPTY, days: ['2026-09-17', '2026-09-18', '2026-09-19'] };
    expect(streak(p, new Date(2026, 8, 20))).toBe(3);
    expect(streak(p, new Date(2026, 8, 19))).toBe(3);
    expect(streak(p, new Date(2026, 8, 22))).toBe(0);
  });
});
