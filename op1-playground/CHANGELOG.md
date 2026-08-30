# Changelog — OP-1 Field Studio

All notable changes to `op1-playground`. Newest first. Dates are local;
hashes refer to this repo's `main`.

## 2026-08-30 · Trouble keys
- Play-along now remembers which physical keys you miss, per song
  (`Grader.missedByKey` folded into localStorage after every graded take).
- The play-along panel shows the worst offenders as chips (`T4 ×5`) with a
  reset; the home shelf warns "watch T4 · T2" on each song's card.

## 2026-08-30 · Ear training — `735dc91`
- New drill kind **by ear**: the card sounds a diatonic chord (name hidden,
  🔊 replay on tap); grab its tones by ear, any octave. The name reveals with
  the voicing when you complete it. Sevenths toggle applies; bests persist
  like every drill.

## 2026-08-30 · Home: streaks, records, a suggested session — `ba56f58`
- New default view **OP-1 FIELD STUDIO**: practice-day log + day streak
  (yesterday-grace), song shelf with each song's best graded take, drill
  records, three-step suggested session (warm-up grabs → play-along goal that
  raises tempo only past 85% accuracy → keep-warm pass).
- Session steps and shelf cards deep-link into Songs/Drills with the song
  preselected. Graded finishes (play-along, drill runs) log the practice day.

## 2026-08-30 · Unified nav + song-sourced drills — `6d2b202`
- One segmented **HOME / PLAYGROUND / SONGS / DRILLS** nav in every header
  (HOME added in `ba56f58`).
- Drills gain a source picker: "any key" (diatonic) or any song — cards deal
  **exact grabs from the song's compiled bars** (octave-strict, reveals B/T
  key tags), best per song persisted.

## 2026-08-30 · Drills — `e4228d5`
- Third view (`?view=drills`): 10-card sprints against the clock in any
  key/mode. Chord grabs (any octave; triads/sevenths), key-tag recall
  (exact B/T key), note names (either octave).
- QWERTY piano or MIDI input; wrong presses +2s; completed cards reveal the
  fitted voicing; best per config in localStorage.

## 2026-08-30 · Play-along mode — `55632c1`
- 🎹 Play-along in the practice strip: backing mutes to the click, every
  press graded against the tab (±250ms window, octave-tolerant).
- Input from OP-1 Field over USB (Web MIDI note-ons) or the built-in QWERTY
  piano (Z/Q rows mirror the 3-2-3-2 layout, on-screen keycap hints).
- Live accuracy % / notes / strays / ±ms feel; hits green, strays red on the
  keyboard; best score per song/section/tempo persisted.

## 2026-08-30 · Practice engine — `37a02f0`
- Practice strip in Songs: tempo slider (40–120% of song BPM), one-bar
  count-in the loop skips on repeats, meter-aware metronome (3/4 correct),
  A/B bar-range looping with looped bars outlined.

## 2026-08-30 · Song tabs (checkpoint) — `cb2959e`
- Score schema + compiler: voicings honoring the printed bass, per-section
  octave switch, repeat/volta expansion, octave folding marked `*`.
- Practice-stand Songs view: source screenshot above a full-width OP-1
  keyboard that follows stepping (←/→, shift+←/→) and playback.
- Measured transcription pipeline (`tools/read_notes.py`: staff-line +
  notehead detection from pixels; probe mode; bass/treble clefs).
- Four transcribed songs with images; adaptive-grid text tabs (quarters →
  thirty-seconds, triplets); MIDI export; JSON import (localStorage);
  integrity test suite over every registered song.

## Earlier (same repo)
- `8b0b887` Spicerack v1/v2 chord-progression workshops + GitHub Pages deploy.
