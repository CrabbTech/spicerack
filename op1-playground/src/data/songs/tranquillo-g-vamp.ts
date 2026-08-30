// Transcribed from a screenshot of the piano score (2026-08-30; noteheads
// measured pixel-by-pixel — see tools/read_notes.py). Two bars, repeated, one
// pedalled sweep per half-bar: four 32nds rolling up from the bass, two 16ths,
// and a high B that rings. The harmony is a ii–V–I in G that ends on an
// augmented color chord: the page spells bar 2's second sweep D♭–F♮–A♭ (flats
// against the F♯ key signature), i.e. A–C♯–E♯–G♯ — A augmented with a maj7,
// pulling back to the ii.

import { NoteEvent, Score } from '../../songs/types';

/** One sweep: 4 thirty-seconds, 2 sixteenths, and a top note held to the pedal change. */
const sweep = (notes: string[]): NoteEvent[] => [
  { note: notes[0], beat: 0, dur: 0.125 },
  { note: notes[1], beat: 0.125, dur: 0.125 },
  { note: notes[2], beat: 0.25, dur: 0.125 },
  { note: notes[3], beat: 0.375, dur: 0.125 },
  { note: notes[4], beat: 0.5, dur: 0.25 },
  { note: notes[5], beat: 0.75, dur: 0.25 },
  { note: notes[6], beat: 1, dur: 1 },
];

export const tranquilloGVamp: Score = {
  id: 'tranquillo-g-vamp',
  title: 'Tranquillo Vamp in G',
  source: 'screenshot of the piano score, 2026-08-30',
  image: 'scores/tranquillo-g-vamp.png',
  key: { tonic: 'G', mode: 'major' },
  bpm: 87,
  feel: 'Tranquillo',
  meter: [4, 4],
  caveats: [
    'Read straight off the page: one-sharp key signature, 4/4, ♩=87 tranquillo, mf, two bars under a repeat, whole rests in the right hand, four Ped. marks — one per half-bar sweep.',
    'The page prints no chord symbols; the ones below name what each measured sweep spells: Am6/9 → D6/9 over an A pedal → Gmaj7 → A augmented (maj7).',
    'Bars here are half-bars (2 beats), one per pedal marking: tab bars 1–2 are score bar 1, tab bars 3–4 are score bar 2.',
    'Bar 4 is spelled in flats on the page (D♭ F♮ A♭ against the F♯ key signature) — enharmonically A C♯ E♯ G♯; the tab names those notes as A+ chord tones (C♯/E♯/G♯).',
    'Each sweep spans G2–B4, five keys more than the 24 reach at one octave setting. OCT −1 keeps the high bell notes literal, so the two lowest notes of each sweep fold up an octave — marked * on the tab.',
    'Sweep rhythm: four 32nds, two 16ths, then the high B rings until the pedal change.',
  ],
  sections: [
    {
      id: 'a',
      name: 'A',
      repeat: 2,
      note: 'Right hand tacet (whole rests, mf). Re-pedal on every sweep; let the top B ring.',
      bars: [
        { chord: 'Am6', bass: 'A', beats: 2, left: sweep(['A2', 'E3', 'A3', 'C4', 'E4', 'F#4', 'B4']) },
        { chord: 'D6/A', beats: 2, left: sweep(['A2', 'D3', 'F#3', 'D4', 'E4', 'F#4', 'B4']) },
        { chord: 'Gmaj7', bass: 'G', beats: 2, left: sweep(['G2', 'D3', 'G3', 'B3', 'D4', 'F#4', 'B4']) },
        { chord: 'Aaug', bass: 'A', beats: 2, left: sweep(['A2', 'Db3', 'F3', 'Ab3', 'Db4', 'F4', 'B4']) },
      ],
    },
  ],
};
