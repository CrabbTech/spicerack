# Spicerack 🌶 — chords, scales & spice

A desktop chord-progression workshop: the software version of those die-cut
"chord folder" tools, but it plays sound, explains every trick, and speaks both
**guitar tab** and **OP-1 Field keyboard**.

Pick a key and a genre → get an idiomatic progression → **spice it up** with
secondary dominants, borrowed chords, tritone subs, passing diminisheds and
more — each move explained in plain language in the log. Then grab matching
scales for solos, as a full-neck fretboard map or lit-up OP-1 keys.

## Features

- **Key selector** (all 12 tonics) + mode chips per genre (major, minor, Dorian, Phrygian, Lydian, Mixolydian)
- **9 genres**: Classic Rock, 80's Rock, Thrash Metal, Prog, Lofi Hip-Hop, Neo-Soul, Funk, Blues, Pop Punk — each with authentic progression templates, voicing style, groove pattern and tempo
- **Spice rack**: 18 transformations (secondary dominant, borrowed iv, ♭VII, Mario cadence, tritone sub, color tones, sus & release, passing dim7, Picardy third, Andalusian slide, truck-driver modulation, backdoor dominant, half-step slide, line cliché, pedal point, Phrygian ♭II, devil's interval, harmonic-minor V) — every application is explained
- **Guitar mode**: chord grids with cycle-able voicings (open grips, barre shapes, funk 9th grips…), smart neck-proximity defaults, full-neck scale maps with position box, copyable ASCII tab
- **OP-1 Field mode**: the real 24-key F-to-E layout (3-2-3-2 black keys), one-hand chord fittings with inversions, scale key-maps, octave shift, copyable key chart
- **Sound**: Karplus-Strong plucked strings for guitar, a soft synth voice for OP-1, per-genre strum patterns with swing — click any chord to hear it, or play the whole loop
- **Teaching palette**: every diatonic chord in the key, plus a "borrow shelf" of idiomatic out-of-key chords that explain themselves when used

All music theory is computed (correct enharmonic spelling per key — B♭ in F, C♯ in A),
and the chord-shape library is interval-verified by the test suite.

## Run it

```bash
npm install
npm run tauri dev      # development app window
npm run tauri build    # release .app + .dmg (in src-tauri/target/release/bundle/)
npm test               # 51 theory/voicing/layout tests
npm run dev            # UI only, in a browser
```

## Stack

Tauri 2 (native shell) · React 19 + TypeScript + Vite · SVG diagrams ·
Web Audio (no samples) · Vitest. No runtime dependencies beyond React.

## Layout

```
src/theory/   notes, scales, chords, roman numerals, progressions, spices
src/data/     the genre book (progressions, spice lists, scale recs, grooves)
src/guitar/   shape library + voicing engine + tab rendering
src/op1/      OP-1 Field key layout + chord fitting
src/audio/    Karplus-Strong + synth + pattern scheduler
src/ui/       React components
```
