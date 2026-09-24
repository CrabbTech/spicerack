# OP-1 Field Playground

A playground for the OP-1 Field's 24-key keyboard (F4–E6, octave shift ±2):
build chord progressions, autocomplete them, hang a generated melody on top,
and read everything as **OP-1 tabs** — every chord and melody note named by
the physical key you press (`B1..B14` bottom row, `T1..T10` raised row).

Standalone web app, separate from Spicerack (`v1/`, `v2/`).

## Run

```sh
npm install
npm run dev        # http://localhost:1440
npm test           # vitest
npm run build      # type-checks + bundles to dist/
```

## Song tabs

Hit **♪ Songs** (or open `?song=<id>`) for the other half of the app: real
sheet music, read as OP-1 tab. A screenshot of a score becomes a `Score` object
— chords, repeats, voltas, written notes — and the compiler works out the
voicings, the physical keys, the octave switch each section wants, and which
notes had to fold to fit 24 keys. Sections play back, export as MIDI, and copy
out as text.

Two ways to add one: commit a data file under `src/data/songs/`, or paste the
same thing as JSON into **+ import a score** (kept in localStorage). Both are
covered by [docs/adding-a-song.md](docs/adding-a-song.md); the integrity suite
compiles every committed song, so a mis-typed chord fails in `npm test` rather
than on the hardware.

## What it generates

- **Presets** — 20 classic progressions (Axis, ii–V–I, 12-bar blues, Andalusian,
  Royal Road, line cliché, modal vamps…), filterable by vibe.
- **Your progressions** — type numerals (`Imaj7 vi7 ii7 V7`, `bVII`, `V7/vi`)
  or chord names (`Am7`, `B♭maj7`, `C/E`); both parse, numerals are inferred.
- **Next Chord autocomplete** — ranked candidates mined from a corpus of classic
  changes plus functional-harmony fallbacks, each with a why; click to append.
- **✨ Auto-finish** — walks the corpus from your last chord into a proper cadence.
- **🎲 Dice** — mood-seeded generator (bright / wistful / dark / dreamy / gritty /
  tense) with sevenths and secondary-dominant spice; 4 or 8 chords.
- **Spice** — substitutions for the selected chord: parallel borrow, tritone sub,
  suspensions, secondary dominants, backdoor.
- **Melody Lab** — seeded melody generator (density, contour, register,
  syncopation) that puts chord tones on strong beats and scale steps between;
  reroll everything or one bar at a time.
- **Smooth voice-leading** — auto-picks inversions so your hand barely moves.
- **Playback** — Tone.js transport with swing and an arpeggiator (up/down/up-down).
- **Exports** — copy the text tab chart, download a 2-track MIDI file
  (chords + melody, same swing as playback), or send live over USB to actual
  hardware with **HW out** (Web MIDI, Chrome).

## Stack

- [tonal](https://github.com/tonaljs/tonal) — all music theory primitives.
  A thin adapter (`src/theory/harmony.ts`) adds this project's conventions:
  numeral case = quality (`ii7` = m7, `II7` = dom7), numerals read against the
  tonic major scale, and `V7/x` secondary dominants — none of which tonal's own
  `Progression` helper handles.
- [Tone.js](https://tonejs.github.io) — synths + transport scheduling.
- [@tonejs/midi](https://github.com/Tonejs/Midi) — MIDI file writing.
- React 19 + Vite + TypeScript, vitest for the theory/generator suites.
