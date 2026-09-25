import { describe, expect, it } from 'vitest';
import { GENRES } from './genres';
import { PATHS } from './lessons';
import { resolveNumeral } from '../theory/roman';

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

  it('keeps the teaching text free of emoji', () => {
    for (const path of PATHS) for (const step of path.steps) {
      // the pictographs and the dingbats; the accidentals (♭ ♯ ♮) live in the misc-symbols block and are welcome
      expect(`${step.teach} ${step.task}`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u);
    }
  });
});
