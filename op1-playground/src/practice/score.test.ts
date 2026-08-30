import { describe, expect, it } from 'vitest';
import { Grader, expectedFor } from './score';
import { QWERTY_TO_INDEX } from './qwerty';
import { compileScore } from '../songs/compile';
import { songById } from '../data/songs';

describe('expected timeline', () => {
  const song = compileScore(songById('laid-back-db-intro')!);
  const section = song.sections[0];

  it('uses the written notes at the practice tempo', () => {
    const exp = expectedFor(section, 0, 0, 60); // 1s per beat
    expect(exp.notes.length).toBe(8);           // 8 eighths
    expect(exp.passMs).toBe(4000);
    expect(exp.notes[1].atMs).toBe(500);
  });

  it('rebases a mid-section slice to zero', () => {
    const exp = expectedFor(section, 2, 3, 60);
    expect(exp.notes[0].atMs).toBe(0);
    expect(exp.passMs).toBe(8000);
  });
});

describe('hands-separate expectations', () => {
  it('scopes to one part and covers both when unscoped', async () => {
    const { compileScore } = await import('../songs/compile');
    const { songById } = await import('../data/songs');
    const song = compileScore(songById('waltz-in-d')!);
    const section = song.sections[0];
    const both = expectedFor(section, 0, 0, 60);
    const melody = expectedFor(section, 0, 0, 60, 'melody');
    const left = expectedFor(section, 0, 0, 60, 'left');
    expect(melody.notes.length).toBe(6);
    expect(left.notes.length).toBe(6);
    expect(both.notes.length).toBe(12);
    expect(melody.passMs).toBe(both.passMs);
  });
});

describe('grader', () => {
  const fixture = {
    notes: [
      { atMs: 0, midi: 61, index: 8 },
      { atMs: 500, midi: 65, index: 12 },
      { atMs: 1000, midi: 68, index: 15 },
    ],
    passMs: 2000,
  };

  it('credits an on-time right note and reports the timing error', () => {
    const g = new Grader(fixture);
    const v = g.play(510, 65);
    expect(v.kind).toBe('hit');
    expect(v.index).toBe(12);
    expect(v.deltaMs).toBe(10);
  });

  it('rejects the right note far off the beat and any wrong note', () => {
    const g = new Grader(fixture);
    expect(g.play(1500, 65).kind).toBe('miss');
    expect(g.play(10, 62).kind).toBe('miss');
    expect(g.stats().extras).toBe(2);
  });

  it('does not double-credit one expected note', () => {
    const g = new Grader(fixture);
    expect(g.play(0, 61).kind).toBe('hit');
    expect(g.play(40, 61).kind).toBe('miss');
  });

  it('matches across octaves by default, exactly when strict', () => {
    expect(new Grader(fixture).play(0, 73).kind).toBe('hit');
    expect(new Grader(fixture, { anyOctave: false }).play(0, 73).kind).toBe('miss');
  });

  it('follows the loop into later passes, including the boundary', () => {
    const g = new Grader(fixture);
    expect(g.play(2000 + 490, 65).kind).toBe('hit');   // pass 2
    expect(g.play(3990, 61).kind).toBe('hit');         // just early for pass 3's first note
    expect(g.stats().expected).toBe(6);                // two passes' worth
  });

  it('reports which keys went unhit, per pass', () => {
    const g = new Grader(fixture);
    g.play(0, 61);            // hit note 0 (index 8)
    g.play(2000 + 500, 65);   // pass 2: hit note 1 (index 12)
    const missed = g.missedByKey();
    expect(missed.get(8)).toBe(1);   // missed in pass 2 only
    expect(missed.get(12)).toBe(1);  // missed in pass 1 only
    expect(missed.get(15)).toBe(2);  // missed both passes
  });

  it('scores a clean take at 100', () => {
    const g = new Grader(fixture);
    g.play(0, 61); g.play(500, 65); g.play(1000, 68);
    expect(g.accuracy).toBe(100);
    expect(g.stats().avgAbsMs).toBe(0);
  });
});

describe('qwerty layout', () => {
  it('covers all 24 keys exactly once', () => {
    const indexes = Object.values(QWERTY_TO_INDEX);
    expect(new Set(indexes).size).toBe(24);
    expect(Math.min(...indexes)).toBe(0);
    expect(Math.max(...indexes)).toBe(23);
  });
});
