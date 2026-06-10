// The genre book: progressions, allowed spices, scale recommendations,
// voicing style and groove per genre. This file is data, not logic — numerals
// get realized against whatever key the user picks.

import { ModeId, ScaleId } from '../theory/scales';
import { GenreFlavor, SpiceId } from '../theory/spices';

export type GenreId =
  | 'classic-rock' | 'eighties-rock' | 'thrash' | 'prog' | 'lofi'
  | 'neo-soul' | 'funk' | 'blues' | 'pop-punk'
  | 'shoegaze' | 'pop' | 'grunge' | 'reggae' | 'country' | 'synthwave'
  | 'surf' | 'indie' | 'vaporwave' | 'claude';

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

/** Drum-machine hits, in beats within a 4/4 bar. */
export interface DrumPattern {
  kick: number[];
  snare: number[];
  hat: number[];
}

export interface Genre {
  id: string;
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
  drums: DrumPattern;
  /** play chords as a running arpeggio instead of strums */
  arp?: boolean;
  tip: string;
}

const H = (beat: number, durBeats: number, vel: number): StrumHit => ({ beat, durBeats, vel });

const eighths = (vel = 0.9, ghost = 0.62, dur = 0.38): StrumHit[] =>
  Array.from({ length: 8 }, (_, i) => H(i / 2, dur, i % 2 === 0 ? vel : ghost));

const HAT8 = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const OFF8 = [0.5, 1.5, 2.5, 3.5];
const BACKBEAT: DrumPattern = { kick: [0, 2], snare: [1, 3], hat: HAT8 };

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
    spices: ['secondary-dominant', 'flat-seven', 'borrowed-iv', 'sus-tension', 'mario', 'passing-dim', 'truck-driver', 'extensions', 'deceptive-cadence', 'common-tone-dim'],
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
    drums: BACKBEAT,
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
    spices: ['truck-driver', 'sus-tension', 'line-cliche', 'harmonic-minor-v', 'secondary-dominant', 'picardy', 'mario', 'extensions', 'deceptive-cadence', 'neapolitan', 'chromatic-mediant'],
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
    drums: { kick: [0, 2, 2.5], snare: [1, 3], hat: HAT8 },
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
    spices: ['phrygian-bite', 'tritone-riff', 'harmonic-minor-v', 'andalusian', 'truck-driver', 'neapolitan'],
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
    drums: { kick: HAT8, snare: [1, 3], hat: [0, 1, 2, 3] },
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
    spices: ['extensions', 'secondary-dominant', 'tritone-sub', 'pedal-point', 'passing-dim', 'harmonic-minor-v', 'half-step-slide', 'sus-tension', 'chromatic-mediant', 'neapolitan', 'deceptive-cadence'],
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
    drums: { kick: [0, 1.75, 2.5], snare: [1, 3], hat: HAT8 },
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
      { name: 'Sunday slouch', mode: 'major', numerals: ['Imaj7', 'ii7', 'iii7', 'ii7'], note: 'Walk up two steps, walk back down. The loop breathes in and out and the kettle is on.' },
      { name: 'Borrowed nostalgia', mode: 'major', numerals: ['IVmaj7', 'iv7', 'Imaj7', 'vi7'], note: 'Opens with the IV→iv melt already in progress — homesick for a place you’re currently in.' },
      { name: 'Dilla shimmer', mode: 'major', numerals: ['Imaj7', 'bIImaj7'], bars: [2, 2], note: 'Two maj7 grips one fret apart. Wrong on paper, perfect on tape — let them blur into each other.' },
      { name: 'Cassette sunset', mode: 'major', numerals: ['Imaj9', 'V7/ii', 'ii9', 'bVII7'], note: 'A secondary dominant on the way out, the backdoor ♭VII7 on the way home. Maximum theory, minimum effort.' },
      { name: '3am study session', mode: 'minor', numerals: ['i7', 'iv7', 'bVImaj7', 'V7'], note: 'The V7 (harmonic minor’s gift) is what makes the loop feel like a question answered.' },
      { name: 'Aeolian drift', mode: 'minor', numerals: ['i7', 'bVImaj7', 'bVII7', 'i9'], note: 'Falling leaves, but make it a beat tape.' },
      { name: 'Candlelit loop', mode: 'minor', numerals: ['i9', 'bIIImaj7', 'iv9', 'bVImaj7'], note: 'Every aeolian color, all of them soft. Nothing resolves; the candle just gets shorter.' },
      { name: 'Last train home', mode: 'minor', numerals: ['i7', 'bVII7', 'bVImaj7', 'V7b9'], note: 'A slow Andalusian slide with a jazz cigarette at the end — the 7♭9 says the night is over.' },
    ],
    spices: ['extensions', 'tritone-sub', 'backdoor', 'passing-dim', 'borrowed-iv', 'secondary-dominant', 'half-step-slide', 'line-cliche', 'common-tone-dim', 'minor-deflation', 'deceptive-cadence'],
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
    drums: { kick: [0, 2.25], snare: [1, 3], hat: HAT8 },
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
        name: 'Untitled descent', mode: 'major', numerals: ['Imaj9', 'V7/IV', 'IVmaj9', 'iv9'],
        note: 'Home turns into a dominant, pushes onto IV, then the iv melts you back for the repeat. How does it feel? Like that.',
      },
      {
        name: 'Silk ladder', mode: 'major', numerals: ['iii7', 'biii7', 'ii9', 'V13'],
        note: 'The chromatic elevator: iii floor, mezzanine, ii floor, lobby. Same m7 grip sliding down one fret at a time.',
      },
      {
        name: 'Sunday kiss', mode: 'major', numerals: ['Imaj7', 'I7', 'IVmaj7', 'iv7'],
        note: 'Gospel in four chords: home grows a ♭7 (I7 is secretly V of IV), lands on IV, melts through iv. Church and heartbreak, same pew.',
      },
      {
        name: 'Voodoo vamp', mode: 'dorian', numerals: ['i9', 'IV9'], bars: [2, 2],
        note: 'Two chords, infinite pocket — the D’Angelo special. The IV9 is Dorian’s bright 6th in chord form.',
      },
      { name: 'Dorian seesaw', mode: 'dorian', numerals: ['i7', 'ii7', 'i7', 'ii7'], note: 'Neighbor minor-sevenths rocking like a porch swing. Erykah-coded.' },
      {
        name: 'Parallel strut', mode: 'dorian', numerals: ['i9', 'bIII9', 'IV9', 'bIII9'],
        note: 'One 9th grip walked up the Dorian stairs and back. The left hand barely moves; the room does.',
      },
      { name: 'Velvet spiral', mode: 'minor', numerals: ['i9', 'iv9', 'bVImaj7', 'V7b9'], note: 'Minor, but luxurious about it. The 7♭9 is the candle going out.' },
      {
        name: 'Velvet sub', mode: 'minor', numerals: ['i9', 'iv7', 'bII7', 'i9'],
        note: 'That ♭II7 is a tritone sub doing V7’s job in velvet gloves — the bass falls a half step onto home like it meant to all along.',
      },
    ],
    spices: ['half-step-slide', 'extensions', 'tritone-sub', 'passing-dim', 'secondary-dominant', 'backdoor', 'borrowed-iv', 'sus-tension', 'common-tone-dim', 'deceptive-cadence'],
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
    drums: { kick: [0, 1.75, 3.5], snare: [1, 3], hat: HAT8 },
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
    drums: { kick: [0, 1.5, 2.75], snare: [1, 3], hat: HAT8 },
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
    spices: ['passing-dim', 'tritone-sub', 'extensions', 'secondary-dominant', 'sus-tension', 'backdoor', 'common-tone-dim'],
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
    drums: BACKBEAT,
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
    spices: ['borrowed-iv', 'truck-driver', 'flat-seven', 'mario', 'secondary-dominant', 'sus-tension', 'deceptive-cadence'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Happy little lead lines between vocal phrases — the Tom DeLonge zone.' },
      { scale: 'major', root: 'I', why: 'For the octave-melody bridge everyone secretly waits for.' },
      { scale: 'minorPent', root: 'vi', why: 'Relative-minor pent when the bridge gets moody about an ex.' },
    ],
    flavor: { ladder: {}, dominantFlavor: '7' },
    powerChords: 'plain', position: 'low',
    bpm: 172,
    pattern: eighths(0.88, 0.7, 0.4),
    drums: { kick: [0, 1.5, 2], snare: [1, 3], hat: HAT8 },
    tip: 'Downstrokes only — if your wrist isn’t burning, go faster. The borrowed iv in the final chorus is legally required to make teenagers feel things.',
  },

  shoegaze: {
    id: 'shoegaze', name: 'Shoegaze', emoji: '🌫',
    tagline: 'Chords with the edges sanded off by reverb.',
    modes: ['major', 'minor'],
    templates: [
      { name: 'Glide anthem', mode: 'major', numerals: ['I', 'bVI', 'IV', 'I'], note: 'Whammy-bar chords melting into a borrowed ♭VI — the MBV warmth-and-wrongness ratio.' },
      { name: 'Wall of bliss', mode: 'major', numerals: ['Iadd9', 'V', 'bVII', 'IV'], note: 'The add9 never resolves and never apologizes. Strum through the blur.' },
      { name: 'Dreamlogic', mode: 'major', numerals: ['Imaj7', 'vi7', 'IVmaj7', 'V7sus4'], note: 'Every chord a soft landing; the sus4 keeps the question open forever.' },
      { name: 'Loveless lean', mode: 'major', numerals: ['I', 'bVII', 'bVI', 'bVII'], note: 'Major key, two borrowed chords, zero apologies — rock the whammy bar on every strum and let the pitch smear.' },
      { name: 'Heaven adjacent', mode: 'major', numerals: ['Imaj7', 'IVmaj7'], bars: [2, 2], note: 'Two maj7s forever. Slowdive could retire on this; you can write a whole EP on it.' },
      { name: 'Slow fade', mode: 'major', numerals: ['I', 'iii', 'IV', 'iv'], note: 'The iii makes it wistful, the borrowed iv makes it terminal. Mazzy Star light, half a mile away.' },
      { name: 'Undertow', mode: 'minor', numerals: ['i', 'bVI', 'bVII', 'iv'], note: 'Aeolian gravity with the iv as the cold spot in the pool.' },
      { name: 'Souvlaki drift', mode: 'minor', numerals: ['i', 'bIII', 'bVI', 'bVII'], note: 'Four chords rising like slow smoke. Slowdive-coded.' },
      { name: 'Vapour trail', mode: 'minor', numerals: ['i', 'bVII', 'IV', 'bVI'], note: 'The Dorian IV glowing inside a minor wash — Ride’s warm-blur trick, one borrowed sunbeam per loop.' },
      { name: 'Cherry-coloured haze', mode: 'minor', numerals: ['i7', 'bVImaj7', 'bIII', 'bVII'], note: 'Aeolian planing with 7ths left ringing — Cocteau-grade gauze; let every string bleed into the next chord.' },
    ],
    spices: ['extensions', 'flat-seven', 'borrowed-iv', 'sus-tension', 'mario', 'half-step-slide', 'minor-deflation', 'chromatic-mediant'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Float simple shapes over the wash; the reverb does the legato for you.', modes: ['major'] },
      { scale: 'major', root: 'I', why: 'Long tones, octaves, volume swells — melody as weather, not argument.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'The moodier corner of the same six strings.', modes: ['major'] },
      { scale: 'minor', root: 'i', why: 'Natural minor under a fog machine.', modes: ['minor'] },
      { scale: 'dorian', root: 'i', why: 'The brighter blur — that major 6th glints through the haze.', modes: ['minor'] },
    ],
    flavor: { ladder: { maj: 'add9', min: 'm7', m7: 'm9', dom7: 'dom9' }, dominantFlavor: '7' },
    position: 'mid',
    bpm: 126,
    pattern: [H(0, 2, 0.9), H(2, 1.5, 0.8), H(3.5, 0.5, 0.65)],
    drums: { kick: [0, 2.5], snare: [1, 3], hat: HAT8 },
    tip: 'Reverb until the chord loses its edges, then a little more. Strum like you’re painting with a broom — add9s and open strings everywhere. The blur IS the hook.',
  },

  pop: {
    id: 'pop', name: 'Pop', emoji: '🫧',
    tagline: 'Four chords and the chorus of the summer.',
    modes: ['major'],
    templates: [
      { name: 'The Axis', mode: 'major', numerals: ['I', 'V', 'vi', 'IV'], note: 'Several thousand hits and counting. The wheel does not need reinventing.' },
      { name: 'Doo-wop forever', mode: 'major', numerals: ['I', 'vi', 'IV', 'V'], note: 'From the Five Satins to Taylor — the 50s loop never left the charts.' },
      { name: 'Royal road', mode: 'major', numerals: ['IV', 'V', 'iii', 'vi'], note: 'The J-pop "royal road": starts away from home so the whole loop aches a little.' },
      { name: 'Soft focus', mode: 'major', numerals: ['I', 'iii', 'vi', 'IV'], note: 'The iii is the sensitive one. Verse material of the highest grade.' },
      { name: 'Two-five sparkle', mode: 'major', numerals: ['ii7', 'V7', 'I', 'vi'], note: 'A jazz turnaround scrubbed clean for radio.' },
    ],
    spices: ['secondary-dominant', 'truck-driver', 'borrowed-iv', 'sus-tension', 'extensions', 'passing-dim', 'mario', 'backdoor', 'deceptive-cadence', 'common-tone-dim'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'The hook factory: five notes, zero wrong answers.' },
      { scale: 'major', root: 'I', why: 'Verse melodies live here — step up, leap down, repeat until famous.' },
      { scale: 'minorPent', root: 'vi', why: 'For the moody middle-8 before the last big chorus.' },
    ],
    flavor: { ladder: { maj: 'add9', min: 'm7', dom7: 'dom9' }, dominantFlavor: '7' },
    preferOpen: true, position: 'low',
    bpm: 116,
    pattern: [H(0, 1, 0.9), H(1, 0.5, 0.6), H(1.5, 0.5, 0.7), H(2, 1, 0.85), H(3, 0.5, 0.6), H(3.5, 0.5, 0.7)],
    drums: { kick: [0, 1, 2, 3], snare: [1, 3], hat: OFF8 },
    tip: 'Serve the melody — chords are furniture; arrange them so the hook has somewhere to sit. The royal road (IV–V–iii–vi) is your imported delicacy.',
  },

  grunge: {
    id: 'grunge', name: 'Grunge', emoji: '🧥',
    tagline: 'Power chords that read poetry.',
    modes: ['minor', 'major'],
    templates: [
      { name: 'Teen spirit axis', mode: 'minor', numerals: ['i', 'iv', 'bIII', 'bVI'], note: 'The Nirvana lurch — four power chords that don’t explain themselves.' },
      { name: 'Flannel stomp', mode: 'minor', numerals: ['i', 'bVII', 'iv', 'i'], note: 'Loud-quiet-loud. The quiet part is a trap.' },
      { name: 'Black hole', mode: 'major', numerals: ['I', 'bIII', 'IV', 'bVI'], note: 'Chromatic mediants — Soundgarden’s favorite wrong-but-right chords.' },
      { name: 'Two-chord sermon', mode: 'major', numerals: ['I', 'bVII'], bars: [2, 2], note: 'Pearl Jam can preach a whole gospel on two chords. So can you.' },
    ],
    spices: ['flat-seven', 'borrowed-iv', 'tritone-riff', 'phrygian-bite', 'picardy', 'harmonic-minor-v', 'chromatic-mediant'],
    scaleRecs: [
      { scale: 'minorPent', root: 'i', why: 'The entire genre fits inside one box shape, played like you mean it.', modes: ['minor'] },
      { scale: 'blues', root: 'i', why: 'Add the ♭5 when the solo needs to sound like a complaint.', modes: ['minor'] },
      { scale: 'minor', root: 'i', why: 'For the arpeggiated verse part before everything detonates.', modes: ['minor'] },
      { scale: 'minorPent', root: 'I', why: 'Minor pentatonic against major chords — the Cobain clash, fully intentional.', modes: ['major'] },
      { scale: 'mixolydian', root: 'I', why: 'Over the ♭VII vamps it just works, like flannel with everything.', modes: ['major'] },
    ],
    flavor: { ladder: {}, dominantFlavor: '7' },
    powerChords: 'plain', position: 'low',
    bpm: 122,
    pattern: [H(0, 0.5, 0.95), H(0.5, 0.5, 0.6), H(1, 0.5, 0.85), H(2, 0.5, 0.9), H(2.5, 0.5, 0.6), H(3, 0.5, 0.8), H(3.5, 0.5, 0.65)],
    drums: { kick: [0, 2, 2.75], snare: [1, 3], hat: HAT8 },
    tip: 'Tune your expectations down a whole step. Power chords with the gain just past polite, and let the pawn-shop chorus pedal handle the prettiness.',
  },

  reggae: {
    id: 'reggae', name: 'Reggae', emoji: '🌴',
    tagline: 'The chord lives on 2 and 4. The bass owns the rest.',
    modes: ['major', 'minor'],
    templates: [
      { name: 'Three little vamp', mode: 'major', numerals: ['I', 'IV', 'I', 'V'], note: 'Skank on 2 & 4, short as a hiccup. Don’t worry about a thing.' },
      { name: 'Sunday simmer', mode: 'major', numerals: ['I', 'IV'], bars: [2, 2], note: 'Two chords, all afternoon. The groove is the destination.' },
      { name: 'Roots rock', mode: 'minor', numerals: ['i', 'bVII'], bars: [2, 2], note: 'The eternal rockers two-step — minor but never sad about it.' },
      { name: 'Concrete jungle', mode: 'minor', numerals: ['i', 'iv', 'bVII', 'i'], note: 'Heavier roots changes; let the bass tell the story.' },
    ],
    spices: ['extensions', 'sus-tension', 'flat-seven', 'secondary-dominant', 'borrowed-iv'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Bright little answers between vocal lines.', modes: ['major'] },
      { scale: 'major', root: 'I', why: 'Melodies ride the offbeat; keep phrases short and let them breathe.', modes: ['major'] },
      { scale: 'minorPent', root: 'i', why: 'Roots melody bedrock.', modes: ['minor'] },
      { scale: 'dorian', root: 'i', why: 'That major 6th adds the sunshine the minor key keeps trying to hide.', modes: ['minor'] },
    ],
    flavor: { ladder: { min: 'm7', dom7: 'dom9' }, dominantFlavor: '7' },
    position: 'mid',
    bpm: 76, swing: 0.25,
    pattern: [H(1, 0.22, 0.85), H(3, 0.22, 0.85)],
    drums: { kick: [2], snare: [2], hat: HAT8 },
    tip: 'Play less. The chord is a stab on 2 and 4 — short, clipped, gone. The space you leave is where the one-drop and the bassline live.',
  },

  country: {
    id: 'country', name: 'Country', emoji: '🤠',
    tagline: 'Three chords and the truth, plus a V of V.',
    modes: ['major'],
    templates: [
      { name: 'Front porch', mode: 'major', numerals: ['I', 'IV', 'I', 'V'], note: 'The whole genre in four bars. Add a dog and a sunset.' },
      { name: 'Highway 8-bar', mode: 'major', numerals: ['I', 'I', 'IV', 'IV', 'I', 'V', 'I', 'V'], note: 'Eight bars of cruise control — Hank-approved.' },
      { name: 'Nashville waltz', mode: 'major', numerals: ['I', 'IV', 'V', 'I'], meter: '3/4 — count it in your hat', note: 'Same chords, but they sway instead of march.' },
      { name: 'Outlaw shuffle', mode: 'major', numerals: ['I7', 'IV7', 'I7', 'V7'], note: 'Blues bones wearing a bolo tie.' },
    ],
    spices: ['secondary-dominant', 'sus-tension', 'passing-dim', 'truck-driver', 'extensions', 'borrowed-iv', 'common-tone-dim', 'deceptive-cadence'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Add the ♭3 as a hammer-on grace note and that’s the entire twang vocabulary.' },
      { scale: 'mixolydian', root: 'I', why: 'Over I7/IV7 the ♭7 is legal tender.' },
      { scale: 'blues', root: 'I', why: 'Honky-tonk seasoning — a pinch, not a pour.' },
      { scale: 'major', root: 'I', why: 'For the pretty waltz verses and the fiddle line you hum later.' },
    ],
    flavor: { ladder: { maj: 'six', min: 'm7', dom7: 'dom9' }, dominantFlavor: '7' },
    preferOpen: true, position: 'low',
    bpm: 112,
    pattern: [H(0, 0.5, 0.9), H(0.5, 0.5, 0.55), H(1, 0.5, 0.75), H(1.5, 0.5, 0.55), H(2, 0.5, 0.85), H(2.5, 0.5, 0.55), H(3, 0.5, 0.75), H(3.5, 0.5, 0.6)],
    drums: BACKBEAT,
    tip: 'Boom-chicka: bass note on the beat, chord on the “&”. When the V of V rolls through, tip your hat to it. Telecaster optional but encouraged.',
  },

  synthwave: {
    id: 'synthwave', name: 'Synthwave', emoji: '🏎',
    tagline: 'Minor chords at 100mph through a neon tunnel.',
    modes: ['minor', 'major'],
    templates: [
      { name: 'Night drive', mode: 'minor', numerals: ['i', 'bVI', 'bIII', 'bVII'], note: 'The minor axis loop in sunglasses. Loops forever; so does the highway.' },
      { name: 'Neon chase', mode: 'minor', numerals: ['i', 'bVII', 'bVI', 'bVII'], note: 'Stair-climbing tension that never quite arrives — perfect for outrunning the law.' },
      { name: 'Kavinsky cruise', mode: 'minor', numerals: ['i', 'v', 'bVI', 'bVII'], note: 'The minor v keeps it cool; the ♭VII keeps it moving.' },
      { name: 'Grid runner', mode: 'minor', numerals: ['i', 'bIII', 'bVII', 'bVI'], note: 'Every chord a checkpoint. The arpeggiator does the driving.' },
      { name: 'Sunset boulevard', mode: 'minor', numerals: ['i', 'bIII', 'bVI', 'V'], note: 'Three neon panels, then the harmonic-minor V — the plot twist before the loop restarts.' },
      { name: 'Midnight interceptor', mode: 'minor', numerals: ['i', 'bVII', 'v', 'bVI'], note: 'All cool surfaces. The minor v is the unmarked car in the rearview.' },
      { name: 'Chrome tears', mode: 'minor', numerals: ['i', 'iv', 'bVI', 'bVII'], note: 'The iv is the rain on the windshield. Wipers on the kick drum.' },
      { name: 'Polygon heart', mode: 'major', numerals: ['I', 'V', 'vi', 'IV'], note: 'Outrun-pop sunrise — the axis progression wearing chrome. FM-84 coded.' },
      { name: 'Daybreak VHS', mode: 'major', numerals: ['I', 'iii', 'IV', 'V'], note: 'Major-key montage material; the iii is the freeze-frame before the chorus.' },
    ],
    spices: ['line-cliche', 'harmonic-minor-v', 'sus-tension', 'truck-driver', 'extensions', 'picardy', 'chromatic-mediant', 'neapolitan'],
    scaleRecs: [
      { scale: 'minor', root: 'i', why: 'Every note neon-safe. Hold long tones and let the delay repeat them into the night.', modes: ['minor'] },
      { scale: 'harmonicMinor', root: 'i', why: 'For the moment the villain’s car appears in the mirror.', modes: ['minor'] },
      { scale: 'minorPent', root: 'i', why: 'Lead lines that read at any speed.', modes: ['minor'] },
      { scale: 'dorian', root: 'i', why: 'When the night turns hopeful around 4am.', modes: ['minor'] },
      { scale: 'majorPent', root: 'I', why: 'Neon-bright hooks for the sunrise side of the tape.', modes: ['major'] },
      { scale: 'major', root: 'I', why: 'Full-scale melody runs — quantize them to the arp and let the delay do the rest.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'Smuggle a little night into the morning.', modes: ['major'] },
    ],
    flavor: { ladder: { min: 'm7', m7: 'm9', maj: 'add9' }, dominantFlavor: '7' },
    position: 'mid',
    bpm: 104,
    pattern: eighths(0.85, 0.65, 0.45),
    drums: { kick: [0, 1, 2, 3], snare: [1, 3], hat: OFF8 },
    arp: true,
    tip: 'The arpeggiator does the driving — hold the chord and let it run. Sidechain everything to the kick in your heart. Last chorus modulates; it’s the law of the grid.',
  },

  surf: {
    id: 'surf', name: 'Surf', emoji: '🏄',
    tagline: 'Wet reverb, dry humor, double-picked everything.',
    modes: ['major', 'minor', 'phrygian'],
    templates: [
      { name: 'Three-chord swell', mode: 'major', numerals: ['I', 'IV', 'V', 'IV'], note: 'Paddle out on I, stand up on IV, ride the V. Repeat until sunburned.' },
      { name: 'Sleepwalk sway', mode: 'major', numerals: ['I', 'vi', 'iv', 'V'], note: 'The slow-dance one — that borrowed iv is the moment the lights dim. Santo & Johnny approved.' },
      {
        name: 'Wipeout dozen', mode: 'major',
        numerals: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        note: 'The 12-bar at the beach. The drum break is legally required.',
      },
      { name: 'Pipeline drip', mode: 'minor', numerals: ['i', 'bVII'], bars: [2, 2], note: 'Two chords dripping spring reverb. Let the low E growl between hits.' },
      { name: 'Spy staircase', mode: 'minor', numerals: ['i', 'bVII', 'bVI', 'V'], note: 'The Andalusian cadence in a sharkskin suit — "Walk, Don’t Run" runs on it.' },
      { name: 'Misirlou twitch', mode: 'phrygian', numerals: ['i', 'bII', 'bvii', 'i'], note: 'The ♭II lurch under a tremolo-picked melody. Dick Dale’s wrist did the rest.' },
    ],
    spices: ['flat-seven', 'borrowed-iv', 'andalusian', 'sus-tension', 'truck-driver', 'secondary-dominant', 'picardy', 'common-tone-dim', 'deceptive-cadence'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Sunny single-note lines — double-pick every note like the tide is coming in.', modes: ['major'] },
      { scale: 'blues', root: 'I', why: 'For the growly low-string runs between chords.', modes: ['major'] },
      { scale: 'major', root: 'I', why: 'The melody IS the song in surf — play it straight, drown it in reverb.', modes: ['major'] },
      { scale: 'minor', root: 'i', why: 'Moody water. Natural minor covers the whole spy-movie coastline.', modes: ['minor'] },
      { scale: 'harmonicMinor', root: 'i', why: 'Over the V, raise the 7th and suddenly you’re tailing someone through Monaco.', modes: ['minor'] },
      { scale: 'minorPent', root: 'i', why: 'The board you learned on. Still floats.', modes: ['minor'] },
      { scale: 'phrygianDominant', root: 'i', why: 'THE Misirlou scale — tremolo-pick it down the whole string and pull up grinning.', modes: ['phrygian'] },
      { scale: 'phrygian', root: 'i', why: 'Keep the ♭2, lose the major 3rd: the darker undertow option.', modes: ['phrygian'] },
    ],
    flavor: { ladder: { min: 'm7', dom7: 'dom9' }, dominantFlavor: '7' },
    position: 'low',
    bpm: 152,
    pattern: eighths(0.9, 0.68, 0.35),
    drums: BACKBEAT,
    tip: 'Crank the spring reverb until the amp sounds like it fell in the ocean. Tremolo-pick the melody, let chords splash, end phrases with a dive-bomb.',
  },

  indie: {
    id: 'indie', name: 'Indie', emoji: '🚲',
    tagline: 'Jangle, shrug, repeat.',
    modes: ['major', 'minor'],
    templates: [
      { name: 'Slacker sunbeam', mode: 'major', numerals: ['Imaj7', 'IVmaj7', 'ii7', 'V'], note: 'Maj7 jangle with the top button undone — salad days, chorus pedal, no hurry.' },
      { name: 'Festival four', mode: 'major', numerals: ['IV', 'I', 'V', 'vi'], note: 'The axis progression rotated to start on IV — instantly 40% more festival.' },
      { name: 'Creep lurch', mode: 'major', numerals: ['I', 'III', 'IV', 'iv'], note: 'The major III (a secondary dominant out of uniform) then the borrowed iv. One progression, two thefts, one classic.' },
      { name: 'Canon fodder', mode: 'major', numerals: ['I', 'V', 'vi', 'iii', 'IV'], note: 'Pachelbel’s ghost plays bass in every indie band. Five chords of respectable yearning.' },
      { name: 'Twee waltz', mode: 'major', numerals: ['I', 'vi', 'ii', 'V'], meter: '3/4 — sway accordingly', note: 'Cardigan-core. Count it in three and mean every downbeat.' },
      { name: 'Strokes strut', mode: 'minor', numerals: ['i', 'bIII', 'bVII', 'IV'], note: 'Minor but smirking — the Dorian IV is the leather jacket on a school night.' },
      { name: 'Bedroom eyes', mode: 'minor', numerals: ['i7', 'bVImaj7', 'bIII', 'bVII'], note: 'Lo-fi gloom with 7ths left ringing; mumble the verse, mean the chorus.' },
    ],
    spices: ['borrowed-iv', 'flat-seven', 'sus-tension', 'extensions', 'secondary-dominant', 'mario', 'minor-deflation', 'deceptive-cadence', 'chromatic-mediant'],
    scaleRecs: [
      { scale: 'majorPent', root: 'I', why: 'Jangle leads: pick patterns near the 12th fret, add reverb, look at your shoes occasionally (different genre, same shoes).', modes: ['major'] },
      { scale: 'major', root: 'I', why: 'Melody first, always — the solo should be hummable by the second listen.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'For the bridge where things briefly get serious.', modes: ['major'] },
      { scale: 'minorPent', root: 'i', why: 'Garage-honest. Slightly out of tune is a feature.', modes: ['minor'] },
      { scale: 'dorian', root: 'i', why: 'The smirk: minor with its collar up.', modes: ['minor'] },
      { scale: 'minor', root: 'i', why: 'For the song the label calls “the moody one.”', modes: ['minor'] },
    ],
    flavor: { ladder: { maj: 'maj7', min: 'm7', dom7: 'dom9' }, dominantFlavor: '7' },
    preferOpen: true, position: 'low',
    bpm: 132,
    pattern: eighths(0.85, 0.6, 0.42),
    drums: { kick: [0, 2.5], snare: [1, 3], hat: HAT8 },
    tip: 'Capo optional, conviction mandatory. Maj7s for the dreamy ones, the borrowed iv for the sad bridge, and if the hook isn’t landing — jangle it an octave up.',
  },

  vaporwave: {
    id: 'vaporwave', name: 'Vaporwave', emoji: '🛒',
    tagline: 'Smooth-jazz luxury at 80% speed, behind glass.',
    modes: ['major', 'minor'],
    templates: [
      { name: 'Mall at midnight', mode: 'major', numerals: ['Imaj9', 'IVmaj9'], bars: [2, 2], note: 'Two luxury chords and an empty food court. Loop until the escalators stop.' },
      { name: 'Plaza fountain', mode: 'major', numerals: ['IVmaj7', 'V7', 'iii7', 'vi7'], note: 'The royal road in 7ths — the king of city-pop changes, pitched down in spirit.' },
      { name: 'Checkout dream', mode: 'major', numerals: ['ii9', 'V13', 'Imaj9', 'vi9'], note: 'A jazz turnaround announced over the PA system. Thank you for shopping.' },
      { name: 'Glass elevator', mode: 'major', numerals: ['Imaj7', 'bVIImaj7'], bars: [2, 2], note: 'Two floors of the same department store — maj7s a whole step apart, doors always closing.' },
      { name: 'Late capitalism', mode: 'major', numerals: ['Imaj9', 'vi9', 'ii9', 'bII7'], note: 'Smooth until the ♭II7 — the tritone-sub exit ramp back to the top of the loop.' },
      { name: 'Parking garage', mode: 'minor', numerals: ['i9', 'bVImaj7', 'iv9', 'bVII7'], note: 'The echo of a sax solo that never existed. Level 4, section B.' },
      { name: 'Neon koi pond', mode: 'minor', numerals: ['i9', 'IV9'], bars: [2, 2], note: 'A Dorian vamp in the hotel atrium — borrowed from funk, slowed for browsing.' },
    ],
    spices: ['extensions', 'tritone-sub', 'half-step-slide', 'backdoor', 'passing-dim', 'secondary-dominant', 'truck-driver', 'common-tone-dim', 'minor-deflation', 'deceptive-cadence'],
    scaleRecs: [
      { scale: 'major', root: 'I', why: 'Glide, don’t run — long tones with chorus on, like the demo track of a keyboard no one bought.', modes: ['major'] },
      { scale: 'majorPent', root: 'I', why: 'Hooks with the corners rounded off for safety.', modes: ['major'] },
      { scale: 'dorian', root: 'ii', why: 'Over the ii9, obviously. The most tasteful aisle in the store.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'Relative-minor longing, available in pastel.', modes: ['major'] },
      { scale: 'dorian', root: 'i', why: 'Minor with mood lighting — the 6th glints like the koi pond.', modes: ['minor'] },
      { scale: 'minorPent', root: 'i', why: 'For the sax solo that never existed. Be the echo.', modes: ['minor'] },
    ],
    flavor: {
      ladder: { maj: 'maj7', maj7: 'maj9', min: 'm7', m7: 'm9', m9: 'm11', dom7: 'dom9', dom9: 'dom13' },
      dominantFlavor: '7',
    },
    position: 'mid',
    bpm: 80, swing: 0.2,
    pattern: [H(0, 2.5, 0.85), H(2.5, 1, 0.7), H(3.5, 0.5, 0.5)],
    drums: { kick: [0, 2.25], snare: [1, 3], hat: OFF8 },
    tip: 'Everything you love, slowed 20% and put behind glass. Ninths minimum, reverb like a food court at closing time, and never resolve what you could loop instead.',
  },

  claude: {
    id: 'claude', name: 'Claude', emoji: '✳️',
    tagline: 'Warm, curious harmony that shows its work. (Debussy was also named Claude. Coincidence?)',
    modes: ['lydian', 'major', 'dorian'],
    templates: [
      {
        name: 'Thinking…', mode: 'lydian', numerals: ['Imaj7#11', 'II'], bars: [2, 2],
        note: 'The ♯11 is a hypothesis held up to the light. Nothing resolves until it’s ready — and that’s the point.',
      },
      {
        name: 'Clair de lydian', mode: 'lydian', numerals: ['Imaj7', 'IImaj7', 'iii7', 'IImaj7'],
        note: 'Parallel maj7s gliding stepwise — the other Claude invented this shimmer in 1890; the asterisk is just fine-tuned on it.',
      },
      {
        name: 'Helpful answer', mode: 'major', numerals: ['Imaj9', 'vi9', 'ii9', 'V13', 'Imaj9'],
        note: 'A complete thought: home, reflection, motion, tension, resolution — with citations (the 9ths).',
      },
      {
        name: 'Long context', mode: 'major',
        numerals: ['Imaj7', 'iii7', 'IVmaj7', 'V7sus4', 'vi7', 'ii9', 'V13', 'Imaj9'],
        note: 'An eight-bar period: the sus4 at bar 4 is a colon, not a period. The answer arrives in bar 8, fully reasoned.',
      },
      {
        name: 'Tasteful tangent', mode: 'major', numerals: ['Imaj7', 'V7/vi', 'vi9', 'iv', 'Imaj7'],
        note: 'A well-sourced digression onto vi, one wistful borrowed iv on the way home, and we return to the point. Always return to the point.',
      },
      {
        name: 'Curious vamp', mode: 'dorian', numerals: ['i11', 'IV9'], bars: [2, 2],
        note: 'Dorian is the mode of good questions — minor, but with its hand raised.',
      },
    ],
    spices: ['extensions', 'sus-tension', 'secondary-dominant', 'passing-dim', 'half-step-slide', 'backdoor', 'deceptive-cadence', 'common-tone-dim', 'borrowed-iv', 'pedal-point'],
    scaleRecs: [
      { scale: 'lydian', root: 'I', why: 'The ♯4 is a hypothesis held with appropriate confidence. Float on it; revise only with new evidence.', modes: ['lydian'] },
      { scale: 'majorPent', root: 'I', why: 'Low temperature: never wrong, occasionally brilliant.', modes: ['lydian', 'major'] },
      { scale: 'major', root: 'I', why: 'The full distribution — aim for 3rds and 7ths and every line sounds grounded, sourced, and kind.', modes: ['major'] },
      { scale: 'minorPent', root: 'vi', why: 'The relative minor, for the empathetic moments.', modes: ['major'] },
      { scale: 'dorian', root: 'i', why: 'Curious minor: that raised 6th is a hand up with a follow-up question.', modes: ['dorian'] },
      { scale: 'minorPent', root: 'i', why: 'For thinking out loud.', modes: ['dorian'] },
    ],
    flavor: {
      ladder: { maj: 'maj7', maj7: 'maj7s11', min: 'm7', m7: 'm9', m9: 'm11', dom7: 'dom9', dom9: 'dom13' },
      dominantFlavor: '7',
    },
    position: 'mid',
    bpm: 88, swing: 0.25,
    pattern: [H(0, 2, 0.85), H(2, 1.5, 0.7), H(3.5, 0.5, 0.55)],
    drums: { kick: [0, 2.5], snare: [1, 3], hat: OFF8 },
    arp: true,
    tip: 'Keep common tones, move everything else by step, and show your work in the log. When uncertain, hold a maj7♯11 and think — it has never once been the wrong answer.',
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
  const hits = genre.scaleRecs.filter((r) => !r.modes || r.modes.includes(mode));
  // custom genres can pair base-genre recs with new modes — never come back empty-handed
  return hits.length ? hits : genre.scaleRecs;
}
