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
