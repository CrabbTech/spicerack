# Quire (née Spicerack) — chords, scales & spice

Two desktop chord-progression workshops live here:

- **`v2/` — Quire** ← the good one. A practice journal for chords: an open
  notebook on a desk, a pixel crab that walks, a dated journal of every move
  explained, a stamp card of practice days, 19 genres + a Genre Lab for
  building your own, drum machine, MIDI export, song library, keyboard
  shortcuts, and a crab canon. (It was Spicerack 2 until the journal.)
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
