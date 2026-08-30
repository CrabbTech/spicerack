import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { OP1_BASE_MIDI, OP1_TOP_MIDI } from '../op1/op1';
import {
  chooseOctaveShift, compileScore, expandPasses, foldIntoWindow, gridFor, playbackFor, windowFor,
} from './compile';
import { renderFigure, reflectIndex } from './figures';
import { Score } from './types';

const score = (bars: Score['sections'][0]['bars'], extra: Partial<Score> = {}): Score => ({
  id: 'test', title: 'Test', key: { tonic: 'Db', mode: 'major' }, bpm: 94,
  sections: [{ id: 'a', name: 'A', bars }],
  ...extra,
});

describe('octave shift', () => {
  it('drops two octaves for a bass-clef part', () => {
    const midis = ['Db3', 'F3', 'Ab3', 'Bb2'].map((n) => Note.midi(n)!);
    expect(chooseOctaveShift(midis)).toBe(-2);
  });

  it('stays home when there is nothing written', () => {
    expect(chooseOctaveShift([])).toBe(0);
  });

  it('folds out-of-range pitches into the 24 keys and says so', () => {
    const [lo] = windowFor(0);
    expect(foldIntoWindow(lo, 0)).toEqual({ index: 0, folded: false });
    const low = foldIntoWindow(Note.midi('Db2')!, 0);
    expect(low.folded).toBe(true);
    expect(low.index).toBeGreaterThanOrEqual(0);
    expect(low.index).toBeLessThan(24);
  });
});

describe('bars', () => {
  it('puts a slash chord bass on the lowest key', () => {
    const song = compileScore(score([{ chord: 'Bbm7/Db' }]));
    const bar = song.sections[0].bars[0];
    expect(bar.voicing.midis[0] % 12).toBe(Note.chroma('Db'));
  });

  it('honours a pinned bass note', () => {
    const song = compileScore(score([{ chord: 'Bbm', bass: 'Bb' }, { chord: 'Bbbaug', bass: 'Bbb' }]));
    const [first, second] = song.sections[0].bars;
    expect(first.voicing.midis[0] % 12).toBe(Note.chroma('Bb'));
    expect(second.voicing.midis[0] % 12).toBe(Note.chroma('Bbb'));
  });

  it('reads numerals as well as chord symbols', () => {
    const song = compileScore(score([{ chord: 'vi7' }]));
    expect(song.sections[0].bars[0].chord.symbol).toBe('B♭m7');
    expect(song.warnings).toEqual([]);
  });

  it('keeps written notes inside the window and names them at the section shift', () => {
    const song = compileScore(score(
      [{ chord: 'Db', left: [{ beat: 0, dur: 1, note: 'Db3' }] }],
      { octaveShift: -2 },
    ));
    const note = song.sections[0].notes[0];
    expect(note.folded).toBe(false);
    expect(note.name).toBe('D♭3');
    expect(note.index).toBeGreaterThanOrEqual(0);
    expect(note.index).toBeLessThan(24);
  });

  it('flags a bar it cannot read', () => {
    const song = compileScore(score([{ chord: 'H#nope' }]));
    expect(song.warnings.length).toBe(1);
  });
});

describe('figures', () => {
  it('folds ladder indices back down instead of hammering the top note', () => {
    expect(reflectIndex(4, 4)).toBe(2);
    expect(reflectIndex(2, 4)).toBe(2);
  });

  it('renders only chord tones, inside the window', () => {
    const song = compileScore(score([{ chord: 'Db', figure: 'up-down-8ths' }]));
    const bar = song.sections[0].bars[0];
    const chromas = new Set(bar.chord.notes.map((n) => Note.chroma(n)));
    expect(bar.notes.length).toBe(8);
    for (const note of bar.notes) {
      expect(chromas.has(note.midi % 12)).toBe(true);
      expect(note.midi).toBeGreaterThanOrEqual(OP1_BASE_MIDI);
      expect(note.midi).toBeLessThanOrEqual(OP1_TOP_MIDI);
      expect(note.derived).toBe(true);
    }
  });

  it('trims a figure to a short bar', () => {
    expect(renderFigure('up-down-8ths', [65, 69, 72], 2).length).toBe(4);
  });

  it('lets a written left hand win over the section figure', () => {
    const song = compileScore(score([], {
      sections: [{
        id: 'a', name: 'A', figure: 'root-8ths',
        bars: [{ chord: 'Db', left: [{ beat: 0, dur: 4, note: 'Db5' }] }],
      }],
    }));
    expect(song.sections[0].notes.length).toBe(1);
    expect(song.sections[0].notes[0].derived).toBe(false);
  });
});

describe('grid resolution', () => {
  const bars = [{ startBeat: 0 }, { startBeat: 2 }];

  it('rules eighths for an eighth-note figure', () => {
    const notes = [0, 0.5, 1, 1.5, 2, 2.5].map((start) => ({ start }));
    expect(gridFor(notes, bars).label).toBe('eighth');
  });

  it('goes finer rather than lose a run of sixteenths', () => {
    const notes = [0, 0.25, 0.5, 0.75, 2, 2.25].map((start) => ({ start }));
    expect(gridFor(notes, bars).cells).toBe(4);
  });

  it('handles triplets', () => {
    const notes = [0, 1 / 3, 2 / 3, 2].map((start) => ({ start }));
    expect(gridFor(notes, bars).cells).toBe(3);
  });

  it('shows every sixteenth of a written sweep on the chart', () => {
    const song = compileScore(score([{
      chord: 'G', beats: 2,
      left: ['G2', 'B2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4']
        .map((note, i) => ({ note, beat: i * 0.25, dur: 0.25 })),
    }], { key: { tonic: 'G', mode: 'major' } }));
    const section = song.sections[0];
    expect(section.notes.length).toBe(8);
    expect(gridFor(section.notes, section.bars).cells).toBe(4);
    expect(section.notes.filter((n) => n.folded).length).toBe(2);
  });
});

describe('repeats and voltas', () => {
  const volta = compileScore(score([], {
    sections: [{
      id: 'a', name: 'A', repeat: 2,
      bars: [
        { chord: 'Db' }, { chord: 'Bbm' },
        { chord: 'Ab7', ending: 1 }, { chord: 'Db', ending: 2 },
      ],
    }],
  }));

  it('plays common bars every pass and each ending once', () => {
    const passes = expandPasses(volta.sections[0]);
    expect(passes.map((p) => p.bar.chord.symbol)).toEqual(['D♭', 'B♭m', 'A♭7', 'D♭', 'B♭m', 'D♭']);
    expect(passes.map((p) => p.pass)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('reuses the last transcribed ending when a later one is missing', () => {
    const partial = compileScore(score([], {
      sections: [{
        id: 'a', name: 'A', repeat: 2,
        bars: [{ chord: 'Db' }, { chord: 'Bbbaug', ending: 1 }],
      }],
    }));
    const passes = expandPasses(partial.sections[0]);
    expect(passes.length).toBe(4);
    expect(passes.filter((p) => p.pass === 2).map((p) => p.bar.number)).toEqual([1, 2]);
  });

  it('lines playback up bar for bar with the expansion', () => {
    const play = playbackFor(volta.sections);
    expect(play.slots.length).toBe(6);
    expect(play.beats).toBe(24);
  });

  it('sounds the section at its own octave shift', () => {
    const song = compileScore(score([{ chord: 'Db' }], { octaveShift: -2 }));
    const play = playbackFor(song.sections);
    expect(Math.min(...play.slots[0].midis)).toBeLessThan(OP1_BASE_MIDI);
  });
});
