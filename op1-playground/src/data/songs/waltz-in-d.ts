// Transcribed from a screenshot of the piano score (2026-08-30; every filled
// notehead measured with tools/read_notes.py, accidentals and the sustained
// second voice read from zoomed crops). A moto-perpetuo waltz in D: constant
// eighths in both hands, D → B7 (V/ii territory) → G → Gm → D → F♯m7/C♯ over
// eight repeated bars, then a second strain that adds a sustained bass voice.

import { NoteEvent, Score } from '../../songs/types';

/** Six straight eighths across a 3/4 bar. */
const eighths = (notes: string[]): NoteEvent[] =>
  notes.map((note, i) => ({ note, beat: i * 0.5, dur: 0.5 }));

/** The bar-3/11 melody cell: two eighths, a quarter, two eighths. */
const cell = (a: string, b: string, c: string, d: string, e: string): NoteEvent[] => [
  { note: a, beat: 0, dur: 0.5 },
  { note: b, beat: 0.5, dur: 0.5 },
  { note: c, beat: 1, dur: 1 },
  { note: d, beat: 2, dur: 0.5 },
  { note: e, beat: 2.5, dur: 0.5 },
];

export const waltzInD: Score = {
  id: 'waltz-in-d',
  title: 'Waltz in D',
  source: 'screenshot of the piano score, 2026-08-30',
  image: 'scores/waltz-in-d.png',
  key: { tonic: 'D', mode: 'major' },
  bpm: 126,
  meter: [3, 4],
  caveats: [
    'No tempo is printed; ♩=126 is a placeholder for a flowing waltz — correct it if you know the piece.',
    'Bars 1–8 sit between repeat signs and are measured note-for-note. The ♯s in bars 3–4 (D♯ against B) make B major/B7; bar 6 flattens B to B♭ for G minor while the tune leans on F♯ → G.',
    'Bar 8\'s bass is printed D♭3 — enharmonically C♯3 — giving F♯m7 over its fifth; the tab names it C♯.',
    'A second strain starts at bar 9 (new repeat sign) and adds a sustained low voice: D2/F♯2 dotted quarters, a B2 half + C♯3 quarter, then a B3 dotted half over B7. The screenshot cuts off after bar 11, so this section is a fragment and is not set to repeat.',
    'The two hands together span D2–F♯5, far more than 24 keys; each section\'s octave switch is chosen for its own range and out-of-window notes fold — marked * on the tab.',
  ],
  sections: [
    {
      id: 'strain-1',
      name: 'STRAIN 1',
      repeat: 2,
      note: 'Both hands run in eighths. Practicing hands separately? Melody alone fits at OCT 0, bass alone at OCT −2 — together the tab folds to one setting.',
      bars: [
        {
          chord: 'D', bass: 'D',
          melody: eighths(['F#5', 'C#5', 'F#5', 'C#5', 'F#5', 'C#5']),
          left: eighths(['D3', 'F#3', 'A3', 'F#3', 'A3', 'F#3']),
        },
        {
          chord: 'D', bass: 'D',
          melody: eighths(['F#5', 'C#5', 'F#5', 'C#5', 'F#5', 'C#5']),
          left: eighths(['D3', 'F#3', 'A3', 'F#3', 'A3', 'F#3']),
        },
        {
          chord: 'B7', bass: 'B',
          melody: cell('B4', 'A4', 'C#5', 'A4', 'B4'),
          left: eighths(['B2', 'D#3', 'F#3', 'D#3', 'F#3', 'D#3']),
        },
        {
          chord: 'B7', bass: 'B',
          melody: eighths(['E5', 'D#5', 'E5', 'F#5', 'D#5', 'B4']),
          left: eighths(['B2', 'D#3', 'F#3', 'D#3', 'F#3', 'D#3']),
        },
        {
          chord: 'G', bass: 'G',
          melody: eighths(['F#5', 'B4', 'F#5', 'B4', 'F#5', 'B4']),
          left: eighths(['G2', 'B2', 'D3', 'B2', 'D3', 'B2']),
        },
        {
          chord: 'Gm', bass: 'G',
          melody: eighths(['F#5', 'Bb4', 'F#5', 'Bb4', 'G5', 'Bb4']),
          left: eighths(['G2', 'Bb2', 'D3', 'Bb2', 'D3', 'Bb2']),
        },
        {
          chord: 'D', bass: 'D',
          melody: eighths(['F#5', 'D5', 'F#5', 'D5', 'E5', 'F#5']),
          left: eighths(['D3', 'F#3', 'A3', 'F#3', 'A3', 'F#3']),
        },
        {
          chord: 'F#m7/C#',
          melody: [
            { note: 'A4', beat: 0, dur: 0.5 }, { note: 'E5', beat: 0, dur: 0.5 },
            { note: 'F#4', beat: 0.5, dur: 0.5 },
            { note: 'A4', beat: 1, dur: 0.5 }, { note: 'D5', beat: 1, dur: 0.5 },
            { note: 'F#4', beat: 1.5, dur: 0.5 },
            { note: 'A4', beat: 2, dur: 0.5 }, { note: 'C#5', beat: 2, dur: 0.5 },
            { note: 'F#4', beat: 2.5, dur: 0.5 },
          ],
          left: eighths(['Db3', 'F#3', 'A3', 'F#3', 'A3', 'F#3']),
          mark: 'repeat, then on to strain 2',
        },
      ],
    },
    {
      id: 'strain-2',
      name: 'STRAIN 2 (fragment)',
      note: 'A sustained low voice joins under the eighths (bass alone fits at OCT −2). The page cuts off after bar 11.',
      bars: [
        {
          chord: 'D', bass: 'D',
          melody: eighths(['F#5', 'C#5', 'F#5', 'C#5', 'F#5', 'C#5']),
          left: [
            { note: 'D2', beat: 0, dur: 1.5 },
            { note: 'F#2', beat: 1.5, dur: 1.5 },
            ...eighths(['D3', 'F#3', 'A3', 'F#3', 'A3', 'F#3']),
          ],
        },
        {
          chord: 'Bm7', bass: 'B',
          melody: eighths(['F#5', 'C#5', 'F#5', 'C#5', 'F#5', 'C#5']),
          left: [
            { note: 'B2', beat: 0, dur: 2 },
            { note: 'C#3', beat: 2, dur: 1 },
            ...eighths(['D3', 'F#3', 'A3', 'F#3', 'A3', 'F#3']),
          ],
        },
        {
          chord: 'B7', bass: 'B',
          melody: cell('B4', 'A4', 'C#5', 'A4', 'B4'),
          left: [
            { note: 'B3', beat: 0, dur: 3 },
            ...eighths(['B2', 'D#3', 'F#3', 'D#3', 'F#3', 'D#3']),
          ],
          mark: 'continues off-frame',
        },
      ],
    },
  ],
};
