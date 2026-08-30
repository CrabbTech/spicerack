// Transcribed from a screenshot of the piano score (2026-08-30; noteheads
// measured pixel-by-pixel against the staff lines — see tools/read_notes.py).
// Four-bar intro in D♭: a broken-chord tresillo (3+3+2) in the left hand over
// a bass that walks D♭ – D♭ – B♭ – B𝄫, i.e. down to D♭+'s ♯5 spelled flat.

import { NoteEvent, Score } from '../../songs/types';

/** Eight straight eighths across the bar. */
const eighths = (notes: string[]): NoteEvent[] =>
  notes.map((note, i) => ({ note, beat: i * 0.5, dur: 0.5 }));

export const laidBackDbIntro: Score = {
  id: 'laid-back-db-intro',
  title: 'Laid-Back Intro in D♭',
  source: 'screenshot of the piano score, 2026-08-30',
  image: 'scores/laid-back-db-intro.png',
  key: { tonic: 'Db', mode: 'major' },
  bpm: 94,
  feel: 'Laid-back',
  meter: [4, 4],
  // the left hand sits around D♭3, so the octave switch goes down two:
  // the OP-1's 24 keys become F2 – E4 and every written note lands unfolded.
  octaveShift: -2,
  caveats: [
    'Chord symbols, key, tempo, meter, the repeat and the 1st-ending bracket are read straight off the page.',
    'The left hand is transcribed literally — notehead positions measured against the staff lines. It is a 3+3+2 tresillo of broken chord tones, straight eighths.',
    'Bar 4 is spelled with a double flat: B𝄫, the ♯5 of D♭+ written to keep the bass line falling.',
    'The right hand rests for all four bars (whole rests, mf), so the tab has no melody line.',
    'Only the 1st ending is visible in the screenshot; the 2nd ending is off-frame, so the second pass reuses it.',
  ],
  sections: [
    {
      id: 'intro',
      name: 'INTRO',
      repeat: 2,
      note: 'Right hand tacet (whole rests, mf) — everything here is the left hand.',
      bars: [
        {
          chord: 'Db', bass: 'Db',
          left: eighths(['Db3', 'F3', 'Ab3', 'Db3', 'F3', 'Ab3', 'Db3', 'F3']),
        },
        {
          chord: 'Bbm7/Db', bass: 'Db',
          left: eighths(['Bb3', 'Db3', 'F3', 'Ab3', 'Db3', 'F3', 'Ab3', 'F3']),
        },
        {
          chord: 'Bbm', bass: 'Bb',
          left: eighths(['Bb2', 'Db3', 'F3', 'Bb2', 'Db3', 'F3', 'Bb2', 'Db3']),
        },
        {
          chord: 'Bbbaug', bass: 'Bbb', ending: 1, mark: 'repeat to the top',
          left: eighths(['Bbb2', 'Db3', 'F3', 'Bbb2', 'F3', 'Db3', 'Bbb2', 'Db3']),
        },
      ],
    },
  ],
};
