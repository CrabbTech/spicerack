import { describe, expect, it } from 'vitest';
import { clickEvents } from './player';
import { compileScore, practicePlayback } from '../songs/compile';
import { songById } from '../data/songs';

describe('click schedule', () => {
  it('accents the first count-in beat and every bar start', () => {
    const clicks = clickEvents(4, 8, 4, 0.5, true);
    expect(clicks.length).toBe(12);
    expect(clicks[0]).toEqual({ time: 0, accent: true });
    expect(clicks[4]).toEqual({ time: 2, accent: true });   // beat 1 of the material
    expect(clicks[5].accent).toBe(false);
    expect(clicks[8].accent).toBe(true);                    // bar 2 downbeat
  });

  it('clicks only the count-in when the metronome is off', () => {
    const clicks = clickEvents(3, 6, 3, 0.5, false);
    expect(clicks.length).toBe(3);
    expect(clicks.every((c, i) => c.accent === (i === 0))).toBe(true);
  });

  it('is silent with no count-in and no metronome', () => {
    expect(clickEvents(0, 8, 4, 0.5, false)).toEqual([]);
  });
});

describe('practice slice', () => {
  const song = compileScore(songById('laid-back-db-intro')!);
  const section = song.sections[0];

  it('plays just the chosen bars, rebased to beat 0', () => {
    const slice = practicePlayback(section, 2, 3);
    expect(slice.slots.length).toBe(2);
    expect(slice.beats).toBe(8);
    expect(Math.min(...slice.melody.map((n) => n.start))).toBe(0);
    expect(Math.max(...slice.melody.map((n) => n.start))).toBeLessThan(8);
  });

  it('swaps a backwards range and clamps to the section', () => {
    const slice = practicePlayback(section, 99, 1);
    expect(slice.slots.length).toBe(3); // bars 2..4
  });

  it('full range matches one pass of the section', () => {
    const slice = practicePlayback(section, 0, section.bars.length - 1);
    expect(slice.beats).toBe(section.beats);
    expect(slice.melody.length).toBe(section.notes.length);
  });
});
