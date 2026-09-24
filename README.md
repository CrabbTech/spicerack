# Spicerack — chords, scales & spice 🦀

Two desktop chord-progression workshops live here:

- **`v2/` — Spicerack 2** ← the good one. A pixel crab, a field-manual look
  (paper, ink, one orange), 19 genres + a Genre Lab for building your own,
  drum machine, MIDI export, progression library, keyboard shortcuts, and a
  crab canon.
- **`v1/`** — the original: 9 genres, guitar + OP-1 Field modes, the spice
  system, scale maps, audio preview.

Each folder is a standalone Tauri app:

```bash
cd v2
npm install          # first time only
npm run tauri dev    # dev window
npm run tauri build  # .app + .dmg in src-tauri/target/release/bundle/
npm test
```

`op1-playground/` is a third, standalone web app: the OP-1 Field's 24-key
keyboard as a chord/melody workshop, plus **song tabs** — screenshots of sheet
music transcribed into OP-1 key-by-key tablature.

`example_image.jpeg` is the physical "chord_files" folder product that
inspired the whole thing.
