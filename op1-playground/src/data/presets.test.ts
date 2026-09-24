// Integrity suite for the preset shelf: every token must resolve to a real
// chord in its preset's mode with no parse warning — a genre pack added with
// a typo'd numeral fails here, not in the browser.

import { describe, expect, it } from 'vitest';
import { KeySig, TONIC_CHOICES, parseToken } from '../theory/harmony';
import { fitChord } from '../op1/op1';
import { PRESETS } from './presets';

it('gives every preset a unique id and at least one vibe', () => {
  expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  for (const p of PRESETS) {
    expect(p.vibe.length).toBeGreaterThan(0);
    expect(p.bpm).toBeGreaterThanOrEqual(40);
    expect(p.bpm).toBeLessThanOrEqual(220);
    expect(p.tokens.length).toBeGreaterThan(0);
  }
});

describe.each(PRESETS.map((p) => [p.name, p] as const))('%s', (_name, preset) => {
  it('parses cleanly and voices playably in several keys', () => {
    for (const tonic of ['C', 'Db', 'F#', 'A']) {
      const key: KeySig = { tonic, mode: preset.mode };
      expect(TONIC_CHOICES).toContain(tonic);
      for (const token of preset.tokens) {
        const parsed = parseToken(token.t, key);
        expect(parsed.warning, `${token.t} in ${tonic} ${preset.mode}`).toBeUndefined();
        expect(parsed.chord.notes.length).toBeGreaterThanOrEqual(3);
        const voicing = fitChord(parsed.chord.notes, parsed.chord.intervals);
        expect(voicing.midis.length).toBeGreaterThanOrEqual(2);
        expect(voicing.midis.length).toBeLessThanOrEqual(5);
      }
    }
  });
});
