import { describe, expect, it } from 'vitest';
import { GENRE_LIST } from '../data/genres';
import { PATHS } from '../data/lessons';
import { GENRES } from '../data/genres';
import { newSlot } from '../theory/progression';
import { resolveNumeral } from '../theory/roman';
import { mulberry32 } from '../theory/lick';
import { buildEarRound } from './earQuiz';

describe('ear quiz', () => {
  it('finds a one-chord change in most genres, and only ever one', () => {
    let built = 0;
    for (const genre of GENRE_LIST) {
      const mode = genre.modes[0];
      const round = buildEarRound(
        genre.templates.filter((t) => t.mode === mode), (t) => t.numerals.map((n) => newSlot(n)),
        { key: { tonic: { letter: 'A', alter: 0 }, mode }, flavor: genre.flavor }, genre.spices, mulberry32(9),
      );
      if (!round) continue;
      built++;
      expect(round.before).toHaveLength(round.after.length);
      const diffs = round.after.filter((s, i) => s.numeral !== round.before[i].numeral);
      expect(diffs).toHaveLength(1);
      expect(round.after[round.changed].numeral).not.toBe(round.before[round.changed].numeral);
      expect(round.explanation.length).toBeGreaterThan(20);
    }
    expect(built).toBeGreaterThan(GENRE_LIST.length * 0.7);
  });
});

describe('learning paths', () => {
  it('only stage things that exist and parse', () => {
    const ids = new Set<string>();
    for (const path of PATHS) {
      for (const step of path.steps) {
        expect(ids.has(step.id)).toBe(false);
        ids.add(step.id);
        if (step.setup.genre) expect(GENRES[step.setup.genre as keyof typeof GENRES]).toBeDefined();
        if (step.setup.genre && step.setup.mode) expect(GENRES[step.setup.genre as keyof typeof GENRES].modes).toContain(step.setup.mode);
        const mode = step.setup.mode ?? 'major';
        for (const n of step.setup.prog?.numerals ?? []) {
          expect(() => resolveNumeral(n, { tonic: { letter: 'C', alter: 0 }, mode })).not.toThrow();
        }
        if (step.setup.xfer !== undefined && step.setup.prog) expect(step.setup.xfer).toBeLessThan(step.setup.prog.numerals.length);
      }
    }
  });
});
