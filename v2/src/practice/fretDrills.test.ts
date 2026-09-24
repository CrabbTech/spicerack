import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../theory/lick';
import { FRET_DRILLS, checkClick, checkPlayed, makeCard, scoreSprint, shapeText } from './fretDrills';

const GUITAR = { openMidi: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'e'], maxFret: 15 };
const BASS = { openMidi: [28, 33, 38, 43], names: ['E', 'A', 'D', 'G'], maxFret: 15 };

describe('fret drills', () => {
  it('only deals cards whose answers are really right', () => {
    for (const tuning of [GUITAR, BASS]) {
      for (const drill of FRET_DRILLS) {
        const rand = mulberry32(drill.id.length * 31 + tuning.openMidi.length);
        for (let i = 0; i < 60; i++) {
          const card = makeCard(drill.id, tuning, rand);
          expect(card.explain).not.toMatch(/undefined|NaN/);
          if (card.kind === 'degree') {
            expect(card.choices).toContain(card.correctChoice);
            const [root, mystery] = card.given;
            const gap = (tuning.openMidi[mystery.string] + mystery.fret) - (tuning.openMidi[root.string] + root.fret);
            expect(card.choices!.indexOf(card.correctChoice!)).toBe(gap - 1);
            continue;
          }
          expect(card.answers.length).toBeGreaterThan(0);
          for (const a of card.answers) {
            expect(a.fret).toBeGreaterThanOrEqual(0);
            expect(a.fret).toBeLessThanOrEqual(tuning.maxFret);
            expect(checkClick(card, a)).toBe(true);
            expect(checkPlayed(card, tuning.openMidi[a.string] + a.fret)).toBe(true);
          }
          expect(checkClick(card, { string: card.answers[0].string, fret: card.answers[0].fret + 1 })).toBe(
            card.answers.some((a) => a.string === card.answers[0].string && a.fret === card.answers[0].fret + 1),
          );
        }
      }
    }
  });

  it('describes interval shapes the way a hand feels them, kink included', () => {
    expect(shapeText({ string: 0, fret: 5 }, { string: 1, fret: 7 }, GUITAR)).toBe('1 string higher, 2 frets toward the body');
    expect(shapeText({ string: 1, fret: 5 }, { string: 2, fret: 4 }, GUITAR)).toBe('1 string higher, 1 fret back toward the nut');
    expect(shapeText({ string: 3, fret: 5 }, { string: 4, fret: 5 }, GUITAR)).toContain('crosses onto the B string');
    expect(shapeText({ string: 0, fret: 5 }, { string: 2, fret: 7 }, BASS)).not.toContain('crosses');
  });

  it('knows the 4-fret unison across G–B', () => {
    const rand = mulberry32(2);
    const gaps = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const card = makeCard('unison', GUITAR, rand);
      const from = card.given[0];
      gaps.add(`${from.string}:${card.answers[0].fret - from.fret}`);
    }
    expect([...gaps].filter((g) => g.startsWith('4:'))).toEqual(['4:4']);
    expect([...gaps].filter((g) => !g.startsWith('4:')).every((g) => g.endsWith(':5'))).toBe(true);
  });

  it('deals missed intervals more often', () => {
    const count = (misses?: Record<string, number>) => {
      const rand = mulberry32(11);
      let n = 0;
      for (let i = 0; i < 400; i++) if (makeCard('interval', { ...GUITAR, misses }, rand).tag === '6') n++;
      return n;
    };
    expect(count({ 6: 4 })).toBeGreaterThan(count() * 2);
  });

  it('scores accuracy first, speed second', () => {
    const run = (right: number, seconds: number) => scoreSprint('interval', Array.from({ length: 10 }, (_, i) => ({ right: i < right, seconds })));
    expect(run(10, 2).score).toBe(100);
    expect(run(10, 9).score).toBe(80);
    expect(run(5, 2).score).toBe(50);
    expect(run(10, 6).pace).toBe(6);
  });
});
