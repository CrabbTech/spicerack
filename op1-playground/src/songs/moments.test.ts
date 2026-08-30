import { describe, expect, it } from 'vitest';
import { compileScore } from './compile';
import { beatLabel, firstMomentOfBar, momentsOf } from './moments';
import { Score } from './types';

const score = (bars: Score['sections'][0]['bars']): Score => ({
  id: 'test', title: 'Test', key: { tonic: 'G', mode: 'major' }, bpm: 87,
  sections: [{ id: 'a', name: 'A', bars }],
});

describe('moments', () => {
  it('makes one chord moment for a bar with no written part', () => {
    const song = compileScore(score([{ chord: 'G' }, { chord: 'C' }]));
    const moments = momentsOf(song.sections[0]);
    expect(moments.length).toBe(2);
    expect(moments[0].kind).toBe('chord');
    expect(moments[0].keys).toEqual(song.sections[0].bars[0].voicing.midis.map((m) => m - 65));
  });

  it('makes one moment per onset of a written run', () => {
    const song = compileScore(score([{
      chord: 'G', beats: 2,
      left: ['G2', 'B2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4']
        .map((note, i) => ({ note, beat: i * 0.25, dur: 0.25 })),
    }]));
    const moments = momentsOf(song.sections[0]);
    expect(moments.length).toBe(8);
    expect(moments.every((m) => m.kind === 'notes' && m.keys.length === 1)).toBe(true);
    expect(moments.map((m) => m.startBeat)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
  });

  it('groups simultaneous notes into one moment, low to high', () => {
    const song = compileScore(score([{
      chord: 'G',
      left: [
        { beat: 0, dur: 1, note: 'B4' },
        { beat: 0, dur: 1, note: 'G4' },
        { beat: 1, dur: 1, note: 'D5' },
      ],
    }]));
    const moments = momentsOf(song.sections[0]);
    expect(moments.length).toBe(2);
    expect(moments[0].keys.length).toBe(2);
    expect(moments[0].midis[0]).toBeLessThan(moments[0].midis[1]);
  });

  it('jumps to the first moment of a bar', () => {
    const song = compileScore(score([
      { chord: 'G', left: [{ beat: 0, dur: 1, note: 'G4' }, { beat: 2, dur: 1, note: 'B4' }] },
      { chord: 'C' },
    ]));
    const moments = momentsOf(song.sections[0]);
    expect(firstMomentOfBar(moments, 1)).toBe(2);
    expect(firstMomentOfBar(moments, 0)).toBe(0);
  });

  it('counts beats the way a drummer would', () => {
    expect(beatLabel(0)).toBe('1');
    expect(beatLabel(0.25)).toBe('1e');
    expect(beatLabel(1.5)).toBe('2&');
    expect(beatLabel(3.75)).toBe('4a');
  });
});
