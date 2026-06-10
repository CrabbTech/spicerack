# Spicerack — chords, scales & spice 🦀

Two desktop chord-progression workshops live here:

- **`v2/` — Spicerack 2** ← the good one. Vaporwave crab logo, 15 genres + a
  Genre Lab for building your own, 9 themes + a custom theme editor, drum
  machine, MIDI export, progression library, keyboard shortcuts.
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

`example_image.jpeg` is the physical "chord_files" folder product that
inspired the whole thing.
