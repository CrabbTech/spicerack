// Transcribed from a screenshot of the piano score (2026-08-30; noteheads
// measured — see tools/read_notes.py; the stacked hollow chords were resolved
// by column-profiling their rims). Same key, same 𝄫 vocabulary and same
// laid-back world as the intro page: almost certainly the A section of the
// same piece. IV → iv (with the third flattened to B𝄫) → a Imaj7 held for two
// bars, under a melody that keeps arching up to A♭4 and hanging there.

import { NoteEvent, Score } from '../../songs/types';

const ch = (notes: string[], dur: number): NoteEvent[] =>
  notes.map((note) => ({ note, beat: 0, dur }));

/** 16th-note anticipation on the "a" of beat 4, tied into the next bar. */
const pickup = (note: string): NoteEvent => ({ note, beat: 3.75, dur: 0.25 });

export const laidBackDbTheme: Score = {
  id: 'laid-back-db-theme',
  title: 'Laid-Back Theme in D♭',
  source: 'screenshot of the piano score, 2026-08-30',
  image: 'scores/laid-back-db-theme.png',
  key: { tonic: 'Db', mode: 'major' },
  bpm: 94,
  feel: 'Laid-back',
  meter: [4, 4],
  caveats: [
    'Same five-flat key and 𝄫 spelling habits as "Laid-Back Intro in D♭" — this page reads as the A section of the same piece. No tempo is printed here; ♩=94 is carried over from the intro page.',
    'Melody and chords are measured off the staff. Bar 2 flattens the G♭ chord\'s third to B𝄫 — IV turning into iv — and bars 3–4 are one D♭maj7 held through a tie.',
    'The bass anticipates each next chord with a 16th on the "a" of beat 4, tied over the barline (G♭ → into bar 2, D♭ → into bar 3, G♭ again at the end, tied toward the repeat).',
    'The left hand spans D♭3–D♭4 and the melody reaches C5, one key more than the 24-key window holds, so one edge of the range folds by an octave — marked * on the tab.',
    'The final G♭ pickup\'s destination is off-frame (next page or a repeat to the top).',
  ],
  sections: [
    {
      id: 'a',
      name: 'A SECTION',
      note: 'Chords ring their full length (pedal); the 16th pickups tie into the next chord.',
      bars: [
        {
          chord: 'Gb', bass: 'Gb',
          melody: [
            { note: 'F4', beat: 1, dur: 1 },
            { note: 'C5', beat: 2, dur: 1 },
            { note: 'Ab4', beat: 3, dur: 1 },
          ],
          left: [...ch(['Gb3', 'Bb3', 'Db4'], 3), pickup('Gb3')],
        },
        {
          chord: 'Gbm', bass: 'Gb',
          melody: [{ note: 'Ab4', beat: 0, dur: 2 }],
          left: [...ch(['Gb3', 'Bbb3', 'Db4'], 3), pickup('Db3')],
        },
        {
          chord: 'Dbmaj7', bass: 'Db',
          melody: [
            { note: 'Db4', beat: 0, dur: 1 },
            { note: 'F4', beat: 1, dur: 1 },
            { note: 'C5', beat: 2, dur: 1 },
            { note: 'Ab4', beat: 3, dur: 1 },
          ],
          left: ch(['Db3', 'F3', 'Ab3', 'C4'], 4),
        },
        {
          chord: 'Dbmaj7', bass: 'Db',
          melody: [{ note: 'Ab4', beat: 0, dur: 3 }],
          left: [...ch(['Db3', 'F3', 'Ab3', 'C4'], 3), pickup('Gb3')],
        },
      ],
    },
  ],
};
