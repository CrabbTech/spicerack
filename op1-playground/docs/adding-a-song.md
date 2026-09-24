# Adding a song

The pipeline is: **screenshot of a score → a `Score` object → OP-1 tab**. The
transcription is the only manual step; key tags, voicings, the octave switch,
playback and MIDI all fall out of the compiler.

There are two ways in, and they share the same schema:

| | Use it when | Lives in |
| --- | --- | --- |
| **Committed song** | You want the song in the app for good, covered by tests | `src/data/songs/<id>.ts` |
| **Pasted import** | You want a tab *now*, without a rebuild | Songs → **+ import a score** (localStorage) |

The import panel accepts exactly the JSON form of the same object, so a pasted
score can be promoted to a committed one by copying it into a data file.

## 1. Read the page

Write down only what the score actually prints:

- **Key and mode** — from the key signature and the tonic the music sits on.
- **Tempo, feel, meter** — `♩= 94`, `Laid-back`, `4/4`.
- **Section names** — the boxed marks: `INTRO`, `VERSE`, `CHORUS`.
- **Chord symbols, one per bar** (or more; see `beats`).
- **Repeats and voltas** — a repeat sign is `repeat: 2`; a `1.` bracket is
  `ending: 1` on that bar.
- **The bass note** each bar sits on, when the page dictates it — a slash chord
  carries its own (`Bbm7/Db`), otherwise pin it with `bass`.
- **Written notes** you can read cleanly: melody in `melody`, lower part in
  `left`, as `{ beat, dur, note }` with the pitch **as written** (`Db3`).

Don't read staff noteheads by eye — measure them with
[`tools/read_notes.py`](../tools/read_notes.py): convert the image to BMP with
`sips -s format bmp`, run the script with no extra args to probe the staff-line
rows, then run it per staff to get every notehead's pitch from its pixel
position (`bass` or `treble` clef). It can't see accidentals, beams or rests —
read those from zoomed `sips` crops. The full workflow lives in the
`score-to-op1-tab` skill.

If a part still can't be read — photo skew, handwriting — give the bar a
`figure` instead of inventing pitches, and say so in `caveats`. The
caveats are printed at the top of the tab — being straight about what is
transcribed and what is a stand-in is part of the format.

## 1½. Keep the screenshot

Save the source image to `public/scores/<id>.png` and set `image:
'scores/<id>.png'` on the score. The Songs view shows it above the keyboard —
the whole point is reading the real page while the app tells you the keys.
(An imported-JSON song can use a `data:` URL instead; the integrity suite
checks that committed image paths actually exist.)

## 2. Write the score

```ts
// src/data/songs/my-song.ts
import { Score } from '../../songs/types';

export const mySong: Score = {
  id: 'my-song',
  title: 'My Song',
  source: 'screenshot of the piano score, 2026-08-30',
  key: { tonic: 'Db', mode: 'major' },
  bpm: 94,
  feel: 'Laid-back',
  meter: [4, 4],
  octaveShift: -2,          // omit to let the compiler choose
  caveats: ['what is read off the page vs. inferred'],
  sections: [
    {
      id: 'intro',
      name: 'INTRO',
      repeat: 2,
      figure: 'up-down-8ths',   // default accompaniment for bars without `left`
      bars: [
        { chord: 'Db', bass: 'Db' },
        { chord: 'Bbm7/Db' },
        { chord: 'Bbm', bass: 'Bb', melody: [{ beat: 0, dur: 1, note: 'F5' }] },
        { chord: 'Bbbaug', bass: 'Bbb', ending: 1 },
      ],
    },
  ],
};
```

Then register it:

```ts
// src/data/songs/index.ts
import { mySong } from './my-song';
export const SONGS: Score[] = [laidBackDbIntro, mySong];
```

`npm test` now covers it: `songs.test.ts` compiles every registered song and
fails if a chord can't be read, a pitch is nonsense, a bar has no length, or a
voicing lands outside the 24 keys.

## Field reference

**Score** — `id`, `title`, `artist?`, `source?`, `key {tonic, mode}`, `bpm`,
`feel?`, `meter?` (default `[4,4]`), `octaveShift?`, `image?`, `caveats?`,
`sections`.

**Section** — `id`, `name`, `repeat?` (total passes), `octaveShift?`,
`figure?`, `note?`, `bars`.

**Bar** — `chord` (symbol *or* numeral: `Bbm7/Db`, `vi7`, `V7/vi`), `bass?`,
`beats?`, `ending?`, `mark?`, `melody?`, `left?`, `figure?`.

**NoteEvent** — `beat` (0-based in the bar), `dur` (beats), `note` (as written,
`Db3`), `ghost?`.

When the harmony moves *inside* a bar — a pedal change or a second chord on
beat 3 — give each half its own bar with `beats: 2` and say so in `caveats`, so
the reader can map tab bars back to the page's bar numbers.

**Figures** — `up-down-8ths`, `arp-up-8ths`, `arp-down-8ths`,
`root-fifth-quarters`, `root-8ths`, `held`. Add more in `src/songs/figures.ts`:
a figure is a list of `{ beat, dur, idx }` steps indexing a ladder of the bar's
own chord tones, so it can never fall out of the harmony or off the keyboard.

## What the compiler does with it

- **Voicings** — each bar is fitted into the 24-key window, honouring the bass
  the page prints; big chords drop the 5th, then the 11th, then the 9th.
- **Octave switch** — one shift per section, chosen from the written register
  (or forced with `octaveShift`). The tab prints it as `OCT −2 (keys F2 – E4)`.
- **Folding** — a written pitch outside the window is folded by octaves and
  marked `*` on the tab, so you always know when the hardware couldn't reach.
- **Grid** — each written part is ruled at the coarsest division that still
  lands every onset on a cell: eighths for a comping figure, sixteenths for a
  run, triplets when the page has them.
- **Repeats** — `repeat` + `ending` expand into the bars you actually play. If
  a later ending wasn't transcribed, that pass reuses the last one there is.
