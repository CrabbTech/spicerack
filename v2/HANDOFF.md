# Handoff — Quire, next session

Everything below is committed and pushed on `claude/spicerack-journal-redesign-swzb1h`.

**What happened.** Spicerack 2 became **Quire** — *a quire is a gathering of
pages, folded and sewn; it sounds like choir* — and the field manual became a
**practice journal**: an open notebook on a desk. The name lives in
`src/brand.ts` and everything reads it from there (wordmark, window title,
MIDI and library file names, storage keys). Storage keys moved from
`spicerack2.*` to `quire.*` with a one-time carry-over (`src/state/storage.ts`),
so nobody loses a song, their progress or their library. The Tauri bundle
identifier was deliberately left as `com.tydacrabb.spicerack2`: changing it
would give the desktop app a fresh data directory and lose the same things.

**The journal.** `src/styles.css` was rewritten again, from scratch:
- The desk (`#cbc1a9`) and the book: a spread of two pages in a CSS grid
  (`.book` → `.page-left`, `.gutter` with a dashed stitch line, `.page-right`,
  384px). Cream paper with a faint dot grid, a vermilion margin rule on every
  page, running heads (left: crab + wordmark + transport; right: the dateline,
  day/week of the year, the streak, Library), and folios in the running feet
  (Learn 1–2, Jam 3–4, Write 5–6).
- Index tabs along the top edge (`src/ui/Tabs.tsx`); the active tab is cut
  from the page's paper and joins it.
- Sections are no longer boxed: a display heading with a hairline above, the
  section number in the margin (CSS counters). Labels like KEY / GENRE / SONG
  also sit in the margin.
- Type: **Newsreader** (variable, opsz) for teaching text and chord symbols,
  **Fraunces** (variable, SOFT/opsz) for headings and the dateline, IBM Plex
  Mono for labels and buttons, Silkscreen for the wordmark. Plex Sans is gone.
  All bundled via `@fontsource-variable/*` in `src/main.tsx`.
- The log is now the **journal** (`src/state/journal.ts`): every log line is
  written into the book with its time, kept in localStorage (400 lines), shown
  under day headings (Today / Yesterday / Mon 21 Sep) on the right page in
  Write and Jam. Spice entries carry a vermilion bullet-journal square.
  Consecutive identical lines are written once. The launch greeting is
  `quiet` (shown, not journaled).
- Learn: the left page is the contents (paths with hand-drawn ticks and
  strike-throughs, a "3/8" count) plus the ear quiz; the right page is Today
  (`src/ui/Stamps.tsx`: the month as a stamp card — practised days get the
  crab pressed in vermilion at a stable per-day tilt, today is ringed) and the
  records.
- The inside cover (`src/ui/CoverModal.tsx`, opened by the wordmark): the
  gloss, a plate, "This journal belongs to" (kept as `quire.owner`), the
  keyboard shortcuts, a colophon.
- Modals are loose sheets laid on the book (the one shadow in the design).

**Motion** (`turnPage` in `src/ui/pageTurn.ts`, keyframes at the end of the
stylesheet): a change of view runs inside a View Transition — the old book
snapshot leaves around the spine, the new one arrives, forward or back
depending on page order (`data-turn` on `<html>`); the active tab morphs.
New journal lines ink in (clip-path sweep); stamps and grades thump in; the
active chord's symbol gets an underline drawn beneath it; ticks draw
themselves. The crab has a **second frame** (`src/ui/pixelCrab.ts`,
`HALF_UP` / `HALF_DOWN`, hand-placed): with `walking`, a steps() animation
alternates the frames — the wordmark crab walks while the band plays and the
Möbius cursor walks the strip. `prefers-reduced-motion` turns all of it off.

**fal.** The proxy injects the key for `fal.run` (sync) — `queue.fal.run` is
still unauthenticated, so use sync calls (curl with a long timeout works).
Eight candidates were generated with `fal-ai/flux/dev`; the one kept is a
minimal ink drawing of a small crab carrying a guitar along a beach, one
orange sun. It was pressed into the exact palette (paper / ink / vermilion,
Bayer-dithered halftone) — 14 KB at `src/ui/art/plate.png`. The pixel crab
stays the only crab in the UI proper; the plate lives on the inside cover.

**Verified.** `tsc` clean, 258 tests pass (`npm test`), `vite build` clean.
Every view was screenshotted in headless Chromium (Write, Write + transition
panel, piano, Jam solo / triads / drills / OP-1, Learn, the three sheets, the
cover, a 1000px-wide window), plus mid-flight frames of the page turn, the
crab's two frames, and a journal line inking in. Not verified by ear or in a
Tauri bundle; View Transitions need Safari 18+ in WKWebView (older falls back
to an instant change).

**Design rules to keep.** Paper `#f6f0e2`, desk `#cbc1a9`, ink `#1d1b17`,
vermilion `#e4532b`; function inks unchanged (tonic `#2b4c8e`, subdominant
`#2b7a58`, dominant `#a8690f`, borrowed `#6b4aa3`, secondary `#b03a6d`). No
emoji. Shadows only under the book and under a loose sheet. 2px radius. Labels
in mono capitals; prose in the serif; every teaching line stays.

**Open threads.**
- The plate is a print; if it ever feels like a different product, drop it and
  put the big walking crab there instead.
- `.foot-note` shortcuts wrap to two lines in Write at 1400px; fine, but the
  inside cover now lists them properly, so the foot could carry fewer.
- The `journal` panel is capped at 540px with its own scrollbar; a "more"
  affordance or a full journal page could come later.
- A Tauri window title and `productName` say Quire; `npx tauri icon` was not
  re-run (the icon is unchanged).

**How to run:** `cd v2 && npm install && npm run dev` (browser, port 1430) or
`npm run tauri dev`. Tests: `npm test`. Deep link that skips session resume:
`?genre=pop&tonic=A&view=write&prog=I,vi,IV,V`.

---

# Handoff — the Mac app (`claude/quire-mac-app`)

**What happened.** Quire became a proper macOS application, built on the
journal branch. The Tauri shell (`v2/src-tauri`) grew:

- `crates/quire-dsp` — the YIN pitch detector ported from `src/input/pitch.ts`
  to Rust, with the same tests (sine sweeps, loud 2nd harmonic, bass E1 with
  a 4096 window, mid-frame onsets, silence/noise/whispers, scratch reuse).
  The note tracker stays in TypeScript so mic, interface and tests share it.
- `src/audio.rs` — the interface as an input: cpal (Core Audio) opens the
  chosen device, the callback de-interleaves the chosen input (or mixes them),
  and a worker thread keeps a rolling window, runs the detector every hop
  (512 samples) and emits `quire://audio` every second hop (~47/s) with
  `{freq, midi, clarity, rms, level, t}`; `quire://audio-state` says running /
  stopped / error. Commands: `audio_devices`, `audio_start(device, channel,
  low)`, `audio_stop`.
- `src/midi.rs` — CoreMIDI through midir on its own thread; `midi_ports`,
  `midi_start(port)`, `midi_stop`; events `quire://midi` and `quire://midi-state`.
- `src/menu.rs` — the menu bar (Quire / File / Edit / Song / View / Window /
  Help) with accelerators; every item emits `quire://menu` with its id and the
  controller's `onMenu` turns it into a move.
- `tauri.conf.json` — `titleBarStyle: Overlay`, `hiddenTitle`, traffic lights
  at (16, 19), desk-coloured window background, `bundle.category: Music`,
  `bundle.macOS.entitlements: Entitlements.plist` (audio-input),
  `minimumSystemVersion: 12.0`. `tauri-plugin-window-state` remembers the
  window. Capabilities add `window-state:default` and
  `core:window:allow-start-dragging` (the `.titlebar` strip is a drag region).

On the page: `src/input/native.ts` is the bridge (`openInterface`,
`openNativeMidi`, device and port lists, `isDesktop`, `isMac`); the controller
has an `interface` input source, `sound` settings (`src/state/sound.ts`,
kept as `quire.sound`), native MIDI when on the desktop, and the menu
dispatcher; `SoundModal` is the Sound sheet (⌘, · the Sound… button in
Listen); the inside cover lists the menu keys on a Mac; `<html data-shell>`
is `mac` in the app (`?shell=mac` previews the chrome in a browser). The mic
can be asked for by device in a browser too.

**Verified here (Linux container).** The whole Tauri crate type-checks and
lints clean with the Linux backends of cpal (ALSA) and midir installed
(`cargo check`, `cargo clippy`); `cargo test` passes in `quire-dsp`. tsc,
vitest (261) and `vite build` are clean. **Not verified:** nothing was built or
run on a Mac — the first `npm run tauri dev` on macOS is the real test. Things
most likely to need a touch there: the exact `PredefinedMenuItem` builder
names on this tauri version (all compiled here, so they exist), the traffic
light offset against the tab row, and Core Audio device names as ids (they
are the `name()` cpal reports — an interface with two identically named
entries would collide).

**Companion setup.** Quire reads the interface directly; Core Audio shares
inputs, so AmpliTube keeps the guitar too. The Sound sheet explains the
routing, including BlackHole/Loopback for grading the processed tone.

**Open threads.**
- Output device selection: Web Audio in WKWebView cannot pick an output
  (`setSinkId` is missing), so the band plays through the system default. A
  native output path would mean moving playback out of the webview — big.
- The interface's latency is taken as 30 ms like the mic; a real measurement
  (loopback ping) could replace the constant.
- `?shell=mac` only previews the chrome; the Interface source and device
  lists need the app.
