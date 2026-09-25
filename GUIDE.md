# Quire — a quick guide

Quire is a practice journal for chords: a desktop app (Tauri 2 + React) that
lives in `v2/`. This page gets it onto your machine and shows you around.
The full feature tour is in `v2/README.md`; the notes for whoever works on it
next are in `v2/HANDOFF.md`.

## 1. Get the code

The current work is on the branch `claude/quire-mac-app`. It contains
everything: the journal redesign, the Mac port, and the burrow. (`main` is
still the pre-journal Spicerack; `claude/spicerack-journal-redesign-swzb1h`
is the journal without the Mac port.)

```bash
git clone https://github.com/CrabbTech/spicerack.git
cd spicerack
git checkout claude/quire-mac-app
```

Already cloned? Bring the branch down:

```bash
git fetch origin
git checkout claude/quire-mac-app
git pull
```

## 2. What you need installed

| For | Install |
| --- | --- |
| The web build (browser, tests) | Node 22 or newer and npm (it was built on Node 22.22, npm 10.9) |
| The Mac app | Xcode command line tools (`xcode-select --install`) and Rust via [rustup](https://rustup.rs) |

Everything else comes from `npm install`. Tauri's CLI is a dev dependency;
the Rust crates download on the first `tauri` build.

## 3. Run it

All commands run from `v2/`:

```bash
cd v2
npm install
```

**In a browser (fastest way to poke at it):**

```bash
npm run dev
```

Open <http://localhost:1430>. Hot reload is on. The whole app works here
except the native pieces: the audio interface input, CoreMIDI and the menu
bar. The microphone, Web MIDI and the keyboard still work.

**As the Mac app:**

```bash
npm run tauri dev
```

The first run compiles the Rust side and takes a few minutes; after that it
is quick. macOS asks for the microphone once; that permission also covers
audio interfaces.

**Checks:**

```bash
npm test               # 277 tests, a few seconds
npx tsc --noEmit       # types
npm run build          # production bundle into v2/dist
```

**A release build:**

```bash
npm run tauri build    # Quire.app and a .dmg in src-tauri/target/release/bundle/
```

Signing and notarization go through `bundle.macOS.signingIdentity` in
`src-tauri/tauri.conf.json`, as for any Tauri app. `src-tauri/Entitlements.plist`
already carries the audio-input entitlement.

## 4. Finding your way around

The app is an open notebook with three pages, as tabs at the top:

- **Write** is the bench. Pick a key and a genre, get a progression, then
  *Spice it up* (mild, medium, hot) or use *What next*. Every move is
  explained in the journal on the right page, with the time it was written.
  Song sections, the melody workbench and the crab canon are here too.
- **Jam** is instrument in hand. Cards shrink to a chord chart; the big
  diagram belongs to the Solo Lab, the Triad Lab or the Neck Drills. Press
  play and the app listens (mic, interface, MIDI or keyboard) and grades each
  pass.
- **Learn** is the contents page: eight short paths that stage the bench for
  you, the practice stamp card, drill records, and **the burrow**.

The inside cover (the crab in the corner, or ⌘I in the Mac app) lists every
keyboard shortcut. The ones you will use first: `space` plays and stops,
`s` spices, `u` undoes, `x` A/Bs the last spice, `j` flips between Jam and
Write, `1`–`4` switch instrument.

### The burrow

At the foot of Learn. Press **Dig**. The crab plays the genre's loop once,
then digs: each floor down, one chord of the loop is changed by one of the
spice rack's real moves, and you say which chord it was. Floors 1 to 3 play
both loops; from floor 4 only the new one, and you hold the old one in your
ear. Genres with the truck driver turn a whole step up at floor 4. From
floor 8 two chords change. You get one **Again** per descent; spend it late.
A miss, bedrock (nothing left on the rack that fits) or **Come up** lands
the loop on the Write bench and writes the whole descent into the journal.

### Playing through an amp sim

Plug the guitar into your interface and run AmpliTube (or any amp sim) on it
as usual. In Quire open **Sound…** (⌘,), pick the same interface and input,
press Listen, and set Jam's Listen source to **Interface**. Core Audio lets
both apps read the input, so Quire hears the dry string while the amp sim
makes the tone. To grade the amp's sound instead, route it into BlackHole or
Loopback and pick that under Sound.

## 5. Where things live

```
v2/
  src/
    theory/     keys, chords, progressions, the spice rack (pure functions)
    practice/   lessons' measuring: grading, drills, the burrow engine, progress
    audio/      the Web Audio engine: instruments, groove, drums, dig ticks
    input/      mic (YIN), Web MIDI, the native bridge for the Mac app
    state/      reducer (the bench), controller (transport, lessons, burrow), journal, storage
    ui/         React: the spread, pages, panels, the crab
    data/       genres, templates, lessons
  src-tauri/    the Mac shell: Core Audio input, CoreMIDI, menu, entitlements
    crates/quire-dsp   the pitch tracker in Rust
```

Tests sit next to what they test (`*.test.ts`). Your progress, journal,
library and settings are in the browser's localStorage under the `quire.`
prefix, so they survive rebuilds; a fresh clone starts empty.

## 6. Deploying the web build

`VITE_BASE=/spicerack/ npm run build` produces a bundle that serves from a
sub-path such as GitHub Pages. Without the variable it serves from `/`.
