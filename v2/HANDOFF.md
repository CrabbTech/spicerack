# Handoff — Spicerack 2, next session

Paste this into the first message of the new session (the one with `FAL_KEY`
in its environment). Everything below is already committed and pushed on
`spicerack2-learn-jam-write-1e958d`.

---

**Context.** Spicerack 2 (`v2/`, Tauri + React + TypeScript) just got two
things: a *crab canon* feature (`src/theory/crab.ts`, `src/ui/CrabCanon.tsx`,
`src/ui/MobiusStrip.tsx`), and a full redesign into one direction — a field
manual for a small instrument: warm paper, black ink, one orange, hairline
rules, numbered sections, IBM Plex Sans/Mono + Silkscreen (bundled via
`@fontsource`, imported in `src/main.tsx`), and a hand-placed 32×24 pixel crab
(`src/ui/pixelCrab.ts`, rendered by `src/ui/PixelCrab.tsx`). The theme engine,
settings modal and every emoji are gone; tooltips are down to ~20, each one
carrying real information. `src/styles.css` was rewritten from scratch. The
Tauri icons were regenerated from `art/crab1024.png` with `npx tauri icon`.
`tsc` is clean, 247 tests pass, `vite build` is clean; every view was checked in
headless Chromium (Write, Jam, Triad lab, Learn, Compose). Not verified by ear or
in a Tauri bundle.

**Where fal comes in.** The owner connected a fal API key (`FAL_KEY`) with
~$35 of credit; the network policy now allows `fal.run`, `queue.fal.run` and
`v3.fal.media`. Use it for what image models are good at, not for the sprite:

1. *Reference sheet for the crab.* Generate a handful of silhouette/pose
   studies (front view, claws raised, flat colour, no gradients) and compare
   them against the current sprite (`scratchpad` renders can be made with a
   10-line PNG encoder; see the sprite module's comment). If a pose reads
   better, re-place the pixels by hand — never paste a generated image in.
   The sprite must stay a fixed grid, five colours, hard edges.
2. *A second frame* for a two-frame sideways walk (legs alternate) — used by
   the Möbius cursor and, at 1×, wherever the crab "walks". Draw it in
   `pixelCrab.ts` next to the first frame and animate with a CSS steps()
   toggle, not a transition.
3. *Optional splash / About illustration* in the manual's language (paper,
   ink, one orange, printed halftone) — only if it stays consistent with the
   pixel crab; if a generated image looks like a different product, drop it.

**Design rules to keep** (do not reintroduce): no emoji anywhere; no
shadows, glows or gradients; 2px radius; labels in IBM Plex Mono uppercase;
section numbers via CSS counters (`.col-left > .panel`, `.path`); paper
`#efe8d8`, ink `#1d1b17`, orange `#e4532b`; function inks tonic `#2b4c8e`,
subdominant `#2b7a58`, dominant `#a8690f`, borrowed `#6b4aa3`, secondary
`#b03a6d`. Copy is terse; the teaching text (log entries, coach lines, lesson
teach/task, spice explanations) is the product and stays.

**Open threads worth a look.**
- The OP-1 / piano keyboard diagrams still use fixed hardware greys
  (`.op1-*`, `.pn-*` in styles.css); they could take paper tones.
- `LogEntry` no longer has an icon; the log is plain text on rules. Fine, but
  a spiced entry is only distinguished by an orange title — consider a small
  mono tag.
- Custom genres saved before this change carry an unused `emoji` field;
  harmless.

**How to run:** `cd v2 && npm install && npm run dev` (browser, port 1430) or
`npm run tauri dev`. Tests: `npm test`. Deep link that skips session resume:
`?genre=pop&tonic=A&view=write&prog=I,vi,IV,V`.
