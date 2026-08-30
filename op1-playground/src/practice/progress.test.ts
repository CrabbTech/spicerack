import { describe, expect, it } from 'vitest';
import {
  collectProgress, parseDrillBest, parseSongBest, streakOf, suggestSession,
} from './progress';

describe('record parsing', () => {
  it('reads play-along bests back from their keys', () => {
    expect(parseSongBest('op1playground.best.waltz-in-d.strain-1.80', '72'))
      .toEqual({ songId: 'waltz-in-d', sectionId: 'strain-1', tempoPct: 80, accuracy: 72 });
    expect(parseSongBest('op1playground.drill.chord.C.major.3', '30')).toBeUndefined();
    expect(parseSongBest('op1playground.best.x.y.NaNish', 'oops')).toBeUndefined();
  });

  it('reads both drill-best shapes', () => {
    expect(parseDrillBest('op1playground.drill.chord.Db.major.7', '41.5'))
      .toEqual({ label: 'chord grabs · Db major · sevenths', seconds: 41.5 });
    expect(parseDrillBest('op1playground.drill.song.waltz-in-d', '33'))
      .toEqual({ label: 'song grabs', songId: 'waltz-in-d', seconds: 33 });
  });

  it('collects and sorts a mixed bag', () => {
    const progress = collectProgress([
      ['op1playground.best.a.s.70', '80'],
      ['op1playground.best.a.s.90', '65'],
      ['op1playground.drill.song.a', '50'],
      ['op1playground.drill.keytag.C.major.3', '20'],
      ['op1playground.days', '["2026-08-30"]'],
    ]);
    expect(progress.songBests[0].tempoPct).toBe(90);
    expect(progress.drillBests[0].seconds).toBe(20);
  });
});

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streakOf(['2026-08-28', '2026-08-29', '2026-08-30'], '2026-08-30')).toBe(3);
  });

  it('lets yesterday keep the streak alive before today is logged', () => {
    expect(streakOf(['2026-08-28', '2026-08-29'], '2026-08-30')).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(streakOf(['2026-08-26', '2026-08-29'], '2026-08-30')).toBe(1);
    expect(streakOf(['2026-08-25'], '2026-08-30')).toBe(0);
    expect(streakOf([], '2026-08-30')).toBe(0);
  });
});

describe('session suggestion', () => {
  const songs = [
    { id: 'a', title: 'Song A' },
    { id: 'b', title: 'Song B' },
  ];

  it('starts a beginner on drills plus a first graded take', () => {
    const steps = suggestSession(songs, { songBests: [], drillBests: [] });
    expect(steps.length).toBe(3);
    expect(steps[0].go.view).toBe('drills');
    expect(steps[1].why).toContain('no play-along on record');
  });

  it('pushes the tempo once accuracy clears 85', () => {
    const steps = suggestSession(songs, {
      songBests: [{ songId: 'a', sectionId: 's', tempoPct: 80, accuracy: 91 }],
      drillBests: [],
    });
    expect(steps[1].title).toContain('90%');
    expect(steps[1].why).toContain('time to speed up');
  });

  it('asks for a better take before speeding up', () => {
    const steps = suggestSession(songs, {
      songBests: [{ songId: 'a', sectionId: 's', tempoPct: 80, accuracy: 60 }],
      drillBests: [],
    });
    expect(steps[1].title).toContain('80%');
    expect(steps[1].why).toContain('beat it');
  });
});
