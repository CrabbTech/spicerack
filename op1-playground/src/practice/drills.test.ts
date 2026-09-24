import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { mulberry32 } from '../lib/rng';
import { judgePress, makeCard, runScore } from './drills';
import { KeySig } from '../theory/harmony';

const key: KeySig = { tonic: 'Db', mode: 'major' };

describe('card generation', () => {
  it('chord cards target exactly the chord tones and reveal a playable voicing', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 20; i++) {
      const card = makeCard('chord', key, true, rng);
      expect(card.targetChromas!.length).toBeGreaterThanOrEqual(3);
      for (const r of card.reveal) {
        expect(r.index).toBeGreaterThanOrEqual(0);
        expect(r.index).toBeLessThan(24);
      }
      // every revealed key's chroma is a target
      for (const r of card.reveal) {
        expect(card.targetChromas).toContain((65 + r.index) % 12);
      }
    }
  });

  it('keytag cards demand one exact key', () => {
    const rng = mulberry32(3);
    const card = makeCard('keytag', key, false, rng);
    expect(card.targetIndex).toBeGreaterThanOrEqual(0);
    expect(card.targetIndex).toBeLessThan(24);
    expect(card.prompt).toMatch(/^(B|T)\d+$/);
  });

  it('note cards accept both octaves of a scale note', () => {
    const rng = mulberry32(11);
    const card = makeCard('note', key, false, rng);
    expect(card.targetChromas!.length).toBe(1);
    expect(card.reveal.length).toBeGreaterThanOrEqual(1);
    const chroma = Note.chroma(card.prompt.replace(/♭/g, 'b').replace(/♯/g, '#'));
    expect(card.targetChromas![0]).toBe(chroma);
  });
});

describe('ear cards', () => {
  it('hides the name, sounds the voicing, and reveals the answer', () => {
    const rng = mulberry32(13);
    for (let i = 0; i < 10; i++) {
      const card = makeCard('ear', key, true, rng);
      expect(card.audio!.length).toBeGreaterThanOrEqual(3);
      expect(card.answer).toBeTruthy();
      expect(card.prompt).not.toBe(card.answer);
      expect(card.targetChromas!.length).toBeGreaterThanOrEqual(3);
      // the audio spells exactly the target chromas
      const audioChromas = new Set(card.audio!.map((m) => m % 12));
      expect(audioChromas).toEqual(new Set(card.targetChromas));
    }
  });
});

describe('song-grab cards', () => {
  it('demands the exact keys of a bar voicing and reveals its key tags', async () => {
    const { compileScore } = await import('../songs/compile');
    const { songById } = await import('../data/songs');
    const { makeSongCard } = await import('./drills');
    const song = compileScore(songById('laid-back-db-intro')!);
    const bars = song.sections.flatMap((sec) => sec.bars.map((bar) => ({ bar, sectionName: sec.name })));
    const rng = mulberry32(9);
    for (let i = 0; i < 8; i++) {
      const card = makeSongCard(bars, rng);
      expect(card.targetIndexes!.length).toBeGreaterThanOrEqual(3);
      // exact-key judging: a chroma-equivalent wrong octave is wrong
      let collected: number[] = [];
      for (const idx of card.targetIndexes!) {
        const res = judgePress(card, idx, collected);
        expect(res.verdict).toBe('good');
        collected = res.collected;
      }
      const other = [...Array(24).keys()].find((k) => !card.targetIndexes!.includes(k))!;
      expect(judgePress(card, other, []).verdict).toBe('wrong');
      for (const r of card.reveal) expect(r.label).toMatch(/^(B|T)\d+$/);
    }
  });
});

describe('judging', () => {
  const rng = mulberry32(5);
  const chordCard = makeCard('chord', key, false, rng);

  it('collects right tones once each and completes on the last one', () => {
    let collected: number[] = [];
    const targets = chordCard.targetChromas!;
    // press keys matching each target chroma
    targets.forEach((chroma, i) => {
      const index = [...Array(24).keys()].find((k) => (65 + k) % 12 === chroma)!;
      const res = judgePress(chordCard, index, collected);
      expect(res.verdict).toBe('good');
      expect(res.done).toBe(i === targets.length - 1);
      collected = res.collected;
    });
    // repeat press = already, not a mistake
    const again = [...Array(24).keys()].find((k) => (65 + k) % 12 === targets[0])!;
    expect(judgePress(chordCard, again, collected).verdict).toBe('already');
  });

  it('flags a non-chord tone as wrong', () => {
    const targets = chordCard.targetChromas!;
    const wrongIdx = [...Array(24).keys()].find((k) => !targets.includes((65 + k) % 12))!;
    expect(judgePress(chordCard, wrongIdx, []).verdict).toBe('wrong');
  });

  it('scores time plus two seconds a mistake', () => {
    expect(runScore(30000, 0)).toBe(30);
    expect(runScore(30000, 3)).toBe(36);
  });
});
