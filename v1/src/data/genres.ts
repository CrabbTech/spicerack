// The genre book: progressions, allowed spices, scale recommendations,
// voicing style and groove per genre. This file is data, not logic — numerals
// get realized against whatever key the user picks.

import { ModeId, ScaleId } from '../theory/scales';
import { GenreFlavor, SpiceId } from '../theory/spices';

export type GenreId =
  | 'classic-rock' | 'eighties-rock' | 'thrash' | 'prog' | 'lofi'
  | 'neo-soul' | 'funk' | 'blues' | 'pop-punk';

export interface ProgressionTemplate {
  name: string;
  mode: ModeId;
  numerals: string[];
  /** bars per slot; defaults to 1 each */
  bars?: number[];
  note?: string;
  /** display-only meter suggestion (prog gets weird) */
  meter?: string;
}

export interface ScaleRec {
  scale: ScaleId;
  /** numeral the scale is rooted on — usually "I"/"i", "vi" = relative minor */
  root: string;
  why: string;
  /** only show for these modes (defaults to all of the genre's modes) */
  modes?: ModeId[];
}

export interface StrumHit {
  beat: number;
  durBeats: number;
  vel: number;
}

export interface Genre {
  id: GenreId;
  name: string;
  emoji: string;
  tagline: string;
  /** selectable modes; first is the default */
  modes: ModeId[];
  templates: ProgressionTemplate[];
  spices: SpiceId[];
  scaleRecs: ScaleRec[];
  flavor: GenreFlavor;
  /** render triads as power chords: 'all' chords or only 'plain' (un-spiced) ones */
  powerChords?: 'all' | 'plain';
  /** guitar voicing prefs */
  preferOpen?: boolean;
  position: 'low' | 'mid';
  /** groove for the play button */
  bpm: number;
  /** 0..1 — how far upbeat eighths get pushed toward a triplet shuffle */
  swing?: number;
  pattern: StrumHit[];
  tip: string;
}

const H = (beat: number, durBeats: number, vel: number): StrumHit => ({ beat, durBeats, vel });

const eighths = (vel = 0.9, ghost = 0.62, dur = 0.38): StrumHit[] =>
  Array.from({ length: 8 }, (_, i) => H(i / 2, dur, i % 2 === 0 ? vel : ghost));

export const GENRES: Record<GenreId, Genre> = {
  'classic-rock': {
    id: 'classic-rock', name: 'Classic Rock', emoji: '🎸',
    tagline: 'Open chords, borrowed ♭VII, tube amp optional.',
    modes: ['major', 'dorian'],
    templates: [
      { name: 'Garage stomp', mode: 'major', numerals: ['I', 'IV', 'V', 'IV'], note: '"Wild Thing" / "Louie Louie" — three chords and the truth.' },
      { name: 'Mixolydian highway', mode: 'major', numerals: ['I', 'bVII', 'IV', 'I'], note: 'The AC/DC–Skynyrd axis. That ♭VII is doing all the swagger.' },
      { name: 'Heartland 50s', mode: 'major', numerals: ['I', 'vi', 'IV', 'V'], note: 'The doo-wop turnaround that refuses to die.' },
      { name: 'Purple sidestep', mode: 'major', numerals: ['I', 'bIII', 'IV', 'I'], note: 'Hendrix DNA — the ♭III smears blues all over the major key.' },
      {
        name: '12-bar roadhouse', mode: 'major',
        numerals: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        note: 'The 12-bar blues, with the amp on 8.',
      },
      {
        name: 'Latin rock simmer', mode: 'dorian', numerals: ['i7', 'IV7'], bars: [2, 2],
        note: '"Oye Como Va" — Santana parked a whole career on these two chords.',
      },
    ],
    spices: ['secondary-dominant', 'flat-seven', 'borrowed-iv', 'sus-tension', 'mario', 'passing-dim', 'truck-driver', 'extensions'],
    scaleRecs: [
      { scale: 'minorPent', root: 'I', why: 'The rock & roll paradox: minor pentatonic over major chords = instant attitude. Every arena solo starts here.', modes: ['major'] },
      { scale: 'majorPent', root: 'I', why: 'Sweet and sunny — Allman Brothers territory. Mix it with the minor pent for the full vocabulary.', modes: ['major'] },
      { scale: 'blues', root: 'I', why: 'Minor pent plus the ♭5 — add it as a passing sneer, never a parking spot.', modes: ['major'] },
      { scale: 'dorian', root: 'i', why: 'Minor with a bright 6th — Santana’s entire toolkit over the i7–IV7 vamp.', modes: ['dorian'] },
      { scale: 'minorPent', root: 'i', why: 'Old reliable. Works over everything in the vamp.', modes: ['dorian'] },
    ],
    flavor: { ladder: { min: 'm7', dom7: 'dom9' }, dominantFlavor: '7' },
    preferOpen: true, position: 'low',
    bpm: 126,
    pattern: [H(0, 1, 0.95), H(1, 1, 0.7), H(2, 1, 0.85), H(3, 0.5, 0.7), H(3.5, 0.5, 0.75)],
    tip: 'Keep it loose: downstrokes, a little drive, let open strings ring. When V feels too polite, the ♭VII is waiting in the alley.',
  },

  'eighties-rock': {
    id: 'eighties-rock', name: "80's Rock", emoji: '📼',
    tagline: 'Big choruses, bigger hair, mandatory key change.',
    modes: ['minor', 'major'],
    templates: [
      { name: 'Leather anthem', mode: 'minor', numerals: ['i', 'bVI', 'bVII', 'i'], note: '"Livin’ on a Prayer" verse energy. Aeolian, fist optional but recommended.' },
      { name: 'Montage fuel', mode: 'minor', numerals: ['i', 'bVII', 'bVI', 'bVII'], note: 'The "Eye of the Tiger" stair-climb. Add gated reverb in your heart.' },
      { name: 'Final countdown', mode: 'minor', numerals: ['i', 'bVI', 'bIII', 'bVII'], note: 'The minor "axis" loop — epic by construction.' },
      { name: 'Arena ballad', mode: 'major', numerals: ['I', 'V', 'vi', 'IV'], note: 'Lighters up. The four chords that paid for every tour bus since 1983.' },
      { name: 'Keytar bounce', mode: 'major', numerals: ['I', 'IV', 'V', 'I'], note: '"Jump"-adjacent. Play it staccato and grin.' },
    ],
    spices: ['truck-driver', 'sus-tension', 'line-cliche', 'harmonic-minor-v', 'secondary-dominant', 'picardy', 'mario', 'extensions'],
    scaleRecs: [
      { scale: 'minor', root: 'i', why: 'The 80s shred default — every note is safe and melodramatic at the same time.', modes: ['minor'] },
      { scale: 'harmonicMinor', root: 'i', why: 'Switch to this the bar the V chord hits: instant neoclassical. Yngwie is watching approvingly.', modes: ['minor'] },
      { scale: 'minorPent', root: 'i', why: 'The bend-friendly skeleton of the same sound — for when the ballad needs feel, not flurries.', modes: ['minor'] },
      { scale: 'majorPent', root: 'I', why: 'Bright, hooky, sing-along leads. Doubles on keytar.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'Relative-minor pentatonic: solo like it’s minor, resolve like it’s major.', modes: ['major'] },
    ],
    flavor: { ladder: { maj: 'add9', min: 'm7' }, dominantFlavor: '7' },
    position: 'low',
    bpm: 118,
    pattern: [H(0, 1.5, 0.9), H(1.5, 0.5, 0.6), H(2, 1, 0.8), H(3, 0.5, 0.6), H(3.5, 0.5, 0.7)],
    tip: 'Chorus pedal on, barre chords wide, add9 for that glassy sparkle. And when in doubt — last chorus, up a whole step. It is the law.',
  },

  thrash: {
    id: 'thrash', name: 'Thrash Metal', emoji: '⚡',
    tagline: 'Power chords, palm mutes, Phrygian everything.',
    modes: ['minor', 'phrygian'],
    templates: [
      { name: 'Gallop anthem', mode: 'minor', numerals: ['i', 'bVI', 'bVII', 'i'], note: 'Palm-muted eighths on the low string between every hit. Gallop accordingly.' },
      { name: 'Mosh staircase', mode: 'minor', numerals: ['i', 'bVII', 'bVI', 'V'], note: 'The Andalusian cadence at 180 BPM — flamenco’s angriest grandchild.' },
      { name: 'Doom toll', mode: 'minor', numerals: ['i', 'iv', 'bII', 'i'], note: 'Slow it down, tune it down, let it ring like a bell in a condemned church.' },
      { name: 'Phrygian grinder', mode: 'phrygian', numerals: ['i', 'bII', 'i', 'bII'], note: 'The half-step lurch. This is the riff your neighbors filed the complaint about.' },
      { name: 'Pit opener', mode: 'phrygian', numerals: ['i', 'bIII', 'bII', 'i'], note: 'Descending Phrygian — circle widens with every pass.' },
    ],
    spices: ['phrygian-bite', 'tritone-riff', 'harmonic-minor-v', 'andalusian', 'truck-driver'],
    scaleRecs: [
      { scale: 'minor', root: 'i', why: 'Natural minor: the home base between acts of violence.' },
      { scale: 'phrygian', root: 'i', why: 'That ♭2 is the whole genre. Riff on the bottom two strings until something breaks.' },
      { scale: 'harmonicMinor', root: 'i', why: 'For the neoclassical flex when the V chord shows up — Marty Friedman approved.' },
      { scale: 'phrygianDominant', root: 'i', why: 'Phrygian with a major 3rd: flamenco-metal, "Egyptian" flavor, instant Kirk Hammett wah moment.', modes: ['phrygian'] },
      { scale: 'minorPent', root: 'i', why: 'When you just want to punch shapes and mean it.' },
    ],
    flavor: { ladder: {}, dominantFlavor: '7' },
    powerChords: 'all', position: 'low',
    bpm: 184,
    pattern: eighths(0.92, 0.6, 0.3),
    tip: 'All power chords, all downstrokes, until the forearm files a grievance. Palm-mute everything except the chord you’re currently angry at.',
  },

  prog: {
    id: 'prog', name: 'Prog', emoji: '🌀',
    tagline: 'Odd meters, Lydian shimmer, chords with middle names.',
    modes: ['lydian', 'dorian', 'minor', 'mixolydian'],
    templates: [
      {
        name: 'Lydian float', mode: 'lydian', numerals: ['I', 'II'], bars: [2, 2], meter: '4/4, but it floats',
        note: 'The II chord is the ♯4 talking — Satriani & Vai live here. Nothing resolves; that’s the point.',
      },
      {
        name: 'Sevens staircase', mode: 'lydian', numerals: ['Imaj7', 'II', 'iii', 'II'], meter: '7/8 (2+2+3)',
        note: 'Count it 1-2,1-2,1-2-3 until your foot stops fighting you.',
      },
      {
        name: 'Odyssey vamp', mode: 'dorian', numerals: ['i7', 'IV7'], bars: [2, 2], meter: '7/4',
        note: '"So What" changes wearing a Pink Floyd shirt.',
      },
      {
        name: 'Schism climber', mode: 'dorian', numerals: ['i', 'bVII', 'IV', 'i'], meter: '5/8 + 7/8',
        note: 'Tool-flavored: keep the bass droning and shift the accents every pass.',
      },
      {
        name: 'Harmonic labyrinth', mode: 'minor', numerals: ['i', 'bVI', 'V7', 'i'], meter: '9/8 (2+2+2+3)',
        note: 'Harmonic-minor gravity in a meter that limps beautifully.',
      },
      {
        name: 'Solsbury stomp', mode: 'mixolydian', numerals: ['I', 'bVII', 'IV', 'I'], meter: '7/4',
        note: 'Peter Gabriel energy: joyful, slightly off-balance, impossible to clap to.',
      },
    ],
    spices: ['extensions', 'secondary-dominant', 'tritone-sub', 'pedal-point', 'passing-dim', 'harmonic-minor-v', 'half-step-slide', 'sus-tension'],
    scaleRecs: [
      { scale: 'lydian', root: 'I', why: 'The ♯4 is the float. Hang on it; never apologize.', modes: ['lydian'] },
      { scale: 'majorPent', root: 'I', why: 'Safe stepping stones between the weird notes.', modes: ['lydian', 'mixolydian'] },
      { scale: 'dorian', root: 'i', why: 'The fusion default: minor with daylight in it.', modes: ['dorian'] },
      { scale: 'melodicMinor', root: 'i', why: 'Jazz gravity for fusion runs — especially over i(maj7) moments.', modes: ['dorian', 'minor'] },
      { scale: 'harmonicMinor', root: 'i', why: 'Over the V7 it stops being exotic and starts being correct.', modes: ['minor'] },
      { scale: 'phrygianDominant', root: 'i', why: 'The V7 of harmonic minor, isolated and weaponized — instant Symphony X.', modes: ['minor'] },
      { scale: 'mixolydian', root: 'I', why: '♭7 sunshine: major that quit its desk job.', modes: ['mixolydian'] },
    ],
    flavor: { ladder: { maj: 'maj7', maj7: 'maj7s11', min: 'm7', m7: 'm9', dom7: 'dom9' }, dominantFlavor: '7' },
    position: 'mid',
    bpm: 112,
    pattern: [H(0, 1, 0.9), H(1, 0.5, 0.6), H(1.5, 0.5, 0.7), H(2, 1, 0.8), H(3, 1, 0.7)],
    tip: 'Odd meters are just 4/4 with commitment issues — count subdivisions out loud. maj7♯11 is floating; pedal point is hovering. Use both.',
  },

  lofi: {
    id: 'lofi', name: 'Lofi Hip-Hop', emoji: '🌧',
    tagline: 'Jazz chords on a rainy loop. Beats to spice chords to.',
    modes: ['major', 'minor'],
    templates: [
      { name: 'Tape-loop turnaround', mode: 'major', numerals: ['ii7', 'V7', 'Imaj7', 'vi7'], note: 'The jazz-standard turnaround, slowed to a heartbeat and left looping.' },
      { name: 'Rainy window', mode: 'major', numerals: ['Imaj7', 'IVmaj7', 'iii7', 'vi7'], note: 'Nothing but soft landings. The iii7 is the melancholy pivot.' },
      { name: 'Wistful vamp', mode: 'major', numerals: ['Imaj7', 'iv7'], bars: [2, 2], note: 'Major home, minor rain — the borrowed iv does all the heavy lifting.' },
      { name: 'Backwards walk', mode: 'major', numerals: ['iii7', 'vi7', 'ii7', 'V7'], note: 'A circle-of-fifths stroll that starts away from home and never hurries back.' },
      { name: '3am study session', mode: 'minor', numerals: ['i7', 'iv7', 'bVImaj7', 'V7'], note: 'The V7 (harmonic minor’s gift) is what makes the loop feel like a question answered.' },
      { name: 'Aeolian drift', mode: 'minor', numerals: ['i7', 'bVImaj7', 'bVII7', 'i9'], note: 'Falling leaves, but make it a beat tape.' },
    ],
    spices: ['extensions', 'tritone-sub', 'backdoor', 'passing-dim', 'borrowed-iv', 'secondary-dominant', 'half-step-slide', 'line-cliche'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Hooks that float over maj7s without snagging.', modes: ['major'] },
      { scale: 'major', root: 'I', why: 'The full palette — aim to land on 3rds and 7ths, the notes that name the chord.', modes: ['major'] },
      { scale: 'dorian', root: 'ii', why: 'Over the ii7, Dorian is just the major scale wearing the right hat.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'Relative-minor melancholy without leaving the key signature.', modes: ['major'] },
      { scale: 'dorian', root: 'i', why: 'Softer than natural minor — the major 6th glows in the dark.', modes: ['minor'] },
      { scale: 'minorPent', root: 'i', why: 'Sketch melodies with it, then decorate with 9ths.', modes: ['minor'] },
      { scale: 'harmonicMinor', root: 'i', why: 'Only when the V7 shows up — one bar of drama, then back to the rain.', modes: ['minor'] },
    ],
    flavor: {
      ladder: { maj: 'maj7', maj7: 'maj9', min: 'm7', m7: 'm9', m9: 'm11', dom7: 'dom9', dom9: 'dom13' },
      dominantFlavor: '7b9',
    },
    position: 'mid',
    bpm: 74, swing: 0.66,
    pattern: [H(0, 2, 0.85), H(2, 1.5, 0.68), H(3.5, 0.5, 0.5)],
    tip: 'Quantize nothing. Sevenths minimum, ninths preferred, played like you’re trying not to wake anyone. If it sounds like a question — good. Loop it.',
  },

  'neo-soul': {
    id: 'neo-soul', name: 'Neo-Soul', emoji: '🍷',
    tagline: 'Gospel hands, Dilla time, chords that smell like incense.',
    modes: ['major', 'dorian', 'minor'],
    templates: [
      {
        name: 'Gospel staircase', mode: 'major', numerals: ['Imaj7', 'V7/vi', 'vi9', 'ii9', 'V13'],
        note: 'That second chord is a secondary dominant wearing church clothes — it shoves you onto vi like an usher.',
      },
      { name: 'Stairstep descent', mode: 'major', numerals: ['IVmaj9', 'iii7', 'ii9', 'Imaj9'], note: 'Four soft steps down to home. Lay back behind every one of them.' },
      { name: 'Slow-jam Sunday', mode: 'major', numerals: ['Imaj9', 'vi9', 'IVmaj9', 'V13'], note: 'The 50s progression after twenty years of voice-leading lessons.' },
      {
        name: 'Voodoo vamp', mode: 'dorian', numerals: ['i9', 'IV9'], bars: [2, 2],
        note: 'Two chords, infinite pocket — the D’Angelo special. The IV9 is Dorian’s bright 6th in chord form.',
      },
      { name: 'Dorian seesaw', mode: 'dorian', numerals: ['i7', 'ii7', 'i7', 'ii7'], note: 'Neighbor minor-sevenths rocking like a porch swing. Erykah-coded.' },
      { name: 'Velvet spiral', mode: 'minor', numerals: ['i9', 'iv9', 'bVImaj7', 'V7b9'], note: 'Minor, but luxurious about it. The 7♭9 is the candle going out.' },
    ],
    spices: ['half-step-slide', 'extensions', 'tritone-sub', 'passing-dim', 'secondary-dominant', 'backdoor', 'borrowed-iv', 'sus-tension'],
    scaleRecs: [
      { scale: 'dorian', root: 'i', why: 'THE neo-soul scale: minor with a sunlit 6th. Slide into everything.', modes: ['dorian', 'minor'] },
      { scale: 'minorPent', root: 'i', why: 'The skeleton key — hang 9ths off it for shimmer.', modes: ['dorian', 'minor'] },
      { scale: 'blues', root: 'i', why: 'For the dirt under the manicure.', modes: ['dorian'] },
      { scale: 'major', root: 'I', why: 'Target 3rds and 7ths through the changes; pass through everything else.', modes: ['major'] },
      { scale: 'majorPent', root: 'I', why: 'Sweet spots only — double a melody in 6ths and watch the room change.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'Relative-minor grit for the bridge, resolved with a smile.', modes: ['major'] },
      { scale: 'harmonicMinor', root: 'i', why: 'One bar of drama when the V7♭9 hits.', modes: ['minor'] },
    ],
    flavor: {
      ladder: { maj: 'maj7', maj7: 'maj9', min: 'm9', m7: 'm9', m9: 'm11', dom7: 'dom13', dom9: 'dom13' },
      dominantFlavor: '7b9',
    },
    position: 'mid',
    bpm: 86, swing: 0.58,
    pattern: [H(0, 1.5, 0.85), H(1.75, 0.25, 0.55), H(2, 1.5, 0.75), H(3.5, 0.5, 0.6)],
    tip: 'Lay back like rent was due yesterday. Every chord gets at least a 7th; slide into grips from a fret above; live on the 9 and let an imaginary bassist own the root.',
  },

  funk: {
    id: 'funk', name: 'Funk', emoji: '🕺',
    tagline: 'One chord, sixteen ways to hit it.',
    modes: ['dorian', 'mixolydian'],
    templates: [
      {
        name: 'One-chord sermon', mode: 'dorian', numerals: ['i9'], bars: [4],
        note: 'James Brown needed one chord. So do you. The groove IS the song — stay on it until somebody faints.',
      },
      { name: 'Dorian strut', mode: 'dorian', numerals: ['i7', 'IV9'], bars: [2, 2], note: '"Cissy Strut" / "Chameleon" DNA. The IV9 is the strut.' },
      { name: 'Grip slide', mode: 'dorian', numerals: ['i9', 'bVII9'], bars: [2, 2], note: 'Same 9th grip, slid down a whole step. Funk loves a lazy left hand.' },
      {
        name: 'The Hendrix chord', mode: 'mixolydian', numerals: ['I7#9'], bars: [4],
        note: '7♯9: major and minor at the same time, on purpose. Stank face is a chord tone.',
      },
      { name: 'Tower of funk', mode: 'mixolydian', numerals: ['I9', 'bVII9', 'IV9', 'I9'], note: 'Horn-section changes — every chord is a dominant because rules are for ballads.' },
    ],
    spices: ['extensions', 'pedal-point', 'half-step-slide', 'sus-tension', 'flat-seven', 'secondary-dominant'],
    scaleRecs: [
      { scale: 'dorian', root: 'i', why: 'Major 6 over minor 7 — that interval IS the strut.', modes: ['dorian'] },
      { scale: 'minorPent', root: 'i', why: 'Ol’ reliable. Sixteenth-note chicken-scratch approved.', modes: ['dorian'] },
      { scale: 'blues', root: 'i', why: 'The ♭5 is the stank-face note. Deploy responsibly.', modes: ['dorian'] },
      { scale: 'mixolydian', root: 'I', why: 'Major with the work boots on (♭7). Matches every dominant chord in the room.', modes: ['mixolydian'] },
      { scale: 'blues', root: 'I', why: 'Over 7♯9, mix major and minor 3rds shamelessly — that clash is the chord’s whole personality.', modes: ['mixolydian'] },
      { scale: 'majorPent', root: 'I', why: 'For the sweet single-note hooks between stabs.', modes: ['mixolydian'] },
    ],
    flavor: {
      ladder: { min: 'm7', m7: 'm9', m9: 'm11', dom7: 'dom9', dom9: 'dom13', maj: 'add9' },
      dominantFlavor: '7',
    },
    position: 'mid',
    bpm: 102,
    pattern: [H(0, 0.3, 0.95), H(0.75, 0.2, 0.6), H(1.5, 0.3, 0.8), H(2.25, 0.2, 0.6), H(2.5, 0.3, 0.85), H(3.25, 0.2, 0.6), H(3.5, 0.2, 0.7)],
    tip: 'The space between the hits is the funk. Strum sixteenths, mute most of them with the left hand, and park on one chord until the room sweats.',
  },

  blues: {
    id: 'blues', name: 'Blues', emoji: '🌙',
    tagline: 'Twelve bars, three chords, one lifetime.',
    modes: ['major', 'minor'],
    templates: [
      {
        name: '12-bar standard', mode: 'major',
        numerals: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        note: 'The constitution of popular music. Bar 12 (the V7) is the turnaround — it kicks you back to the top.',
      },
      {
        name: 'Quick change', mode: 'major',
        numerals: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        note: 'Same 12 bars, but the IV7 shows up early in bar 2 to keep listeners honest.',
      },
      {
        name: '8-bar mover', mode: 'major', numerals: ['I7', 'V7', 'IV7', 'IV7', 'I7', 'V7', 'I7', 'V7'],
        note: '"Key to the Highway" form — the short con.',
      },
      {
        name: 'Minor blues', mode: 'minor',
        numerals: ['i7', 'i7', 'i7', 'i7', 'iv7', 'iv7', 'i7', 'i7', 'bVI7', 'V7', 'i7', 'V7'],
        note: '"The Thrill Is Gone" territory. The ♭VI7→V7 in bars 9–10 is the saddest doorbell in music.',
      },
    ],
    spices: ['passing-dim', 'tritone-sub', 'extensions', 'secondary-dominant', 'sus-tension', 'backdoor'],
    scaleRecs: [
      { scale: 'blues', root: 'I', why: 'The whole truth: minor pent plus the ♭5. Bend the ♭3 up toward the major 3rd — that quarter-tone is where the blues actually lives.', modes: ['major'] },
      { scale: 'majorPent', root: 'I', why: 'The uptown move. Switch major pent on the I, minor pent on the IV — B.B., Albert and Freddie all played this switch.', modes: ['major'] },
      { scale: 'mixolydian', root: 'I', why: 'Chase the changes: chord-tone thinking for when pentatonic autopilot gets lazy.', modes: ['major'] },
      { scale: 'blues', root: 'i', why: 'Minor blues over a minor blues — double down.', modes: ['minor'] },
      { scale: 'minorPent', root: 'i', why: 'The vocabulary every other scale here is quoting.', modes: ['minor'] },
      { scale: 'dorian', root: 'i', why: 'Over the iv7, the 6th stops being spicy and starts being correct.', modes: ['minor'] },
    ],
    flavor: { ladder: { dom7: 'dom9', dom9: 'dom13', min: 'm7', m7: 'm9' }, dominantFlavor: '7' },
    preferOpen: true, position: 'low',
    bpm: 96, swing: 0.85,
    pattern: eighths(0.88, 0.6, 0.42),
    tip: 'It’s a conversation: I7 asks, IV7 wonders, V7 demands. Swing everything. And never play the same lick twice in a row — B.B.’s rule.',
  },

  'pop-punk': {
    id: 'pop-punk', name: 'Pop Punk', emoji: '🛹',
    tagline: 'Four chords, downstrokes, feelings.',
    modes: ['major'],
    templates: [
      { name: 'Four chords forever', mode: 'major', numerals: ['I', 'V', 'vi', 'IV'], note: 'The Axis progression — several thousand hits and counting. Yours next.' },
      { name: 'Sad banger', mode: 'major', numerals: ['vi', 'IV', 'I', 'V'], note: 'Same four chords, start on the sad one. Instant yearning.' },
      { name: 'Doo-wop sprint', mode: 'major', numerals: ['I', 'vi', 'IV', 'V'], note: 'The 50s progression at 172 BPM with worse posture.' },
      { name: 'Garage special', mode: 'major', numerals: ['I', 'IV', 'I', 'V'], note: 'Two-and-a-half chords of pure Saturday afternoon.' },
    ],
    spices: ['borrowed-iv', 'truck-driver', 'flat-seven', 'mario', 'secondary-dominant', 'sus-tension'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Happy little lead lines between vocal phrases — the Tom DeLonge zone.' },
      { scale: 'major', root: 'I', why: 'For the octave-melody bridge everyone secretly waits for.' },
      { scale: 'minorPent', root: 'vi', why: 'Relative-minor pent when the bridge gets moody about an ex.' },
    ],
    flavor: { ladder: {}, dominantFlavor: '7' },
    powerChords: 'plain', position: 'low',
    bpm: 172,
    pattern: eighths(0.88, 0.7, 0.4),
    tip: 'Downstrokes only — if your wrist isn’t burning, go faster. The borrowed iv in the final chorus is legally required to make teenagers feel things.',
  },
};

export const GENRE_LIST: Genre[] = Object.values(GENRES);

/** Random template for the genre+mode (avoiding an immediate repeat). */
export function pickTemplate(genre: Genre, mode: ModeId, avoidName?: string): ProgressionTemplate {
  const pool = genre.templates.filter((t) => t.mode === mode);
  const fresh = pool.filter((t) => t.name !== avoidName);
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function scaleRecsFor(genre: Genre, mode: ModeId): ScaleRec[] {
  return genre.scaleRecs.filter((r) => !r.modes || r.modes.includes(mode));
}
