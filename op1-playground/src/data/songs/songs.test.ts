// Integrity suite for the song library: every transcription must compile to
// keys you can actually press, so a typo in a new score fails here, not on the
// hardware. Adding a song needs no change to this file.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { MODE_NAMES } from '../../theory/harmony';
import { OP1_KEY_COUNT } from '../../op1/op1';
import { MAX_OCTAVE_SHIFT, MIN_OCTAVE_SHIFT, compileScore, expandPasses } from '../../songs/compile';
import { FIGURE_IDS } from '../../songs/figures';
import { barBeats } from '../../songs/types';
import { buildSongChart } from '../../export/songTab';
import { readScore, scoreToJson } from '../../songs/parse';
import { SONGS } from './index';

it('gives every song a unique id', () => {
  expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
});

describe.each(SONGS.map((s) => [s.title, s] as const))('%s', (_title, score) => {
  const song = compileScore(score);

  it('describes itself completely', () => {
    expect(score.id).toMatch(/^[a-z0-9-]+$/);
    expect(score.bpm).toBeGreaterThan(20);
    expect(Object.keys(MODE_NAMES)).toContain(score.key.mode);
    expect(Note.chroma(score.key.tonic)).not.toBeNull();
    expect(score.sections.length).toBeGreaterThan(0);
  });

  it('reads every chord and pitch it names', () => {
    expect(song.warnings).toEqual([]);
    for (const section of score.sections) {
      expect(section.bars.length).toBeGreaterThan(0);
      for (const bar of section.bars) {
        expect(barBeats(bar, score)).toBeGreaterThan(0);
        if (bar.bass) expect(Note.chroma(bar.bass)).not.toBeNull();
        if (bar.figure) expect(FIGURE_IDS).toContain(bar.figure);
        for (const ev of [...(bar.melody ?? []), ...(bar.left ?? [])]) {
          expect(Note.midi(ev.note), `${ev.note} in ${section.name}`).not.toBeNull();
          expect(ev.dur).toBeGreaterThan(0);
          expect(ev.beat).toBeLessThan(barBeats(bar, score));
        }
      }
      if (section.figure) expect(FIGURE_IDS).toContain(section.figure);
    }
  });

  it('lands on real OP-1 keys at a reachable octave shift', () => {
    for (const section of song.sections) {
      expect(section.octaveShift).toBeGreaterThanOrEqual(MIN_OCTAVE_SHIFT);
      expect(section.octaveShift).toBeLessThanOrEqual(MAX_OCTAVE_SHIFT);
      for (const bar of section.bars) {
        expect(bar.keyTags.length).toBe(bar.voicing.midis.length);
        for (const tag of bar.keyTags) expect(tag).toMatch(/^(B([1-9]|1[0-4])|T([1-9]|10))$/);
      }
      for (const note of section.notes) {
        expect(note.index).toBeGreaterThanOrEqual(0);
        expect(note.index).toBeLessThan(OP1_KEY_COUNT);
      }
      expect(expandPasses(section).length).toBeGreaterThanOrEqual(section.bars.length);
    }
  });

  it('ships the score image it references', () => {
    if (!score.image) return;
    expect(score.image.startsWith('data:')).toBe(false);
    expect(existsSync(join(process.cwd(), 'public', score.image)),
      `public/${score.image} is missing`).toBe(true);
  });

  it('prints a chart that names its sections and bars', () => {
    const chart = buildSongChart(song);
    expect(chart).toContain(score.title.toUpperCase());
    for (const section of song.sections) {
      expect(chart).toContain(section.name);
      for (const bar of section.bars) expect(chart).toContain(bar.chord.symbol);
    }
  });

  it('survives a JSON round trip', () => {
    const back = readScore(JSON.parse(scoreToJson(score)));
    expect(back.ok).toBe(true);
    if (back.ok) expect(compileScore(back.score).totalBars).toBe(song.totalBars);
  });
});
