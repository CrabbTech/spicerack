// Preset progressions: the classics, written in conventional numerals
// (case = quality, read against the tonic major scale).

import { ModeId } from '../theory/harmony';

export interface PresetToken {
  t: string;
  bars?: number; // default 1
}

export interface Preset {
  id: string;
  name: string;
  vibe: string[];
  mode: ModeId;
  bpm: number;
  blurb: string;
  tokens: PresetToken[];
}

const T = (t: string, bars?: number): PresetToken => (bars ? { t, bars } : { t });

export const PRESETS: Preset[] = [
  {
    id: 'axis', name: 'Axis of Awesome', vibe: ['pop'], mode: 'major', bpm: 100,
    blurb: 'The four chords behind a hundred hit singles.',
    tokens: [T('I'), T('V'), T('vi'), T('IV')],
  },
  {
    id: 'axis-sad', name: 'Sensitive Axis', vibe: ['pop', 'sad'], mode: 'major', bpm: 88,
    blurb: 'Same four chords, started on the sad one.',
    tokens: [T('vi'), T('IV'), T('I'), T('V')],
  },
  {
    id: 'doowop', name: 'Doo-Wop', vibe: ['pop', 'retro'], mode: 'major', bpm: 96,
    blurb: 'The 50s prom-slow-dance changes.',
    tokens: [T('I'), T('vi'), T('IV'), T('V')],
  },
  {
    id: 'jazz-turn', name: 'Jazz Turnaround', vibe: ['jazz'], mode: 'major', bpm: 120,
    blurb: 'I–vi–ii–V, the loop that never lands.',
    tokens: [T('Imaj7'), T('vi7'), T('ii7'), T('V7')],
  },
  {
    id: 'two-five-one', name: 'ii–V–I', vibe: ['jazz'], mode: 'major', bpm: 132,
    blurb: 'The atom of jazz harmony, resolved twice.',
    tokens: [T('ii7'), T('V7'), T('Imaj7', 2)],
  },
  {
    id: 'blues12', name: '12-Bar Blues', vibe: ['blues', 'rock'], mode: 'major', bpm: 104,
    blurb: 'Twelve bars, three chords, infinite mileage.',
    tokens: [
      T('I7'), T('I7'), T('I7'), T('I7'),
      T('IV7'), T('IV7'), T('I7'), T('I7'),
      T('V7'), T('IV7'), T('I7'), T('V7'),
    ],
  },
  {
    id: 'pachelbel', name: 'Pachelbel Wedding Loop', vibe: ['pop', 'classical'], mode: 'major', bpm: 84,
    blurb: 'The canon: a stately walk down the scale.',
    tokens: [T('I'), T('V'), T('vi'), T('iii'), T('IV'), T('I'), T('IV'), T('V')],
  },
  {
    id: 'andalusian', name: 'Andalusian Cadence', vibe: ['dark', 'flamenco'], mode: 'minor', bpm: 112,
    blurb: 'Four steps downhill into a Spanish sunset.',
    tokens: [T('i'), T('bVII'), T('bVI'), T('V7')],
  },
  {
    id: 'creep', name: 'Creep Ache', vibe: ['rock', 'sad'], mode: 'major', bpm: 76,
    blurb: 'I–III–IV–iv: hope, alarm, and the saddest borrow in rock.',
    tokens: [T('I', 2), T('III', 2), T('IV', 2), T('iv', 2)],
  },
  {
    id: 'royal-road', name: 'Royal Road', vibe: ['pop', 'dreamy'], mode: 'major', bpm: 108,
    blurb: 'IVmaj7–V7–iii7–vi: the J-pop chord highway.',
    tokens: [T('IVmaj7'), T('V7'), T('iii7'), T('vi7')],
  },
  {
    id: 'minor-anthem', name: 'Minor Anthem', vibe: ['epic', 'dark'], mode: 'minor', bpm: 98,
    blurb: 'i–bVI–bIII–bVII, the trailer-music circuit.',
    tokens: [T('i'), T('bVI'), T('bIII'), T('bVII')],
  },
  {
    id: 'aeolian-drift', name: 'Aeolian Drift', vibe: ['dark', 'synth'], mode: 'minor', bpm: 90,
    blurb: 'Two flat chords rocking under a minor sky.',
    tokens: [T('i'), T('bVII'), T('bVI'), T('bVII')],
  },
  {
    id: 'backdoor', name: 'Backdoor Cadence', vibe: ['soul', 'jazz'], mode: 'major', bpm: 88,
    blurb: 'iv7–bVII7 sneaks home without ringing the V doorbell.',
    tokens: [T('Imaj7'), T('iv7'), T('bVII7'), T('Imaj7')],
  },
  {
    id: 'line-cliche', name: 'Line Cliché', vibe: ['noir', 'jazz'], mode: 'minor', bpm: 80,
    blurb: 'The top note walks down a half step at a time: i–imaj7–i7–i6.',
    tokens: [T('i'), T('imaj7'), T('i7'), T('i6')],
  },
  {
    id: 'dorian-vamp', name: 'Dorian Vamp', vibe: ['funk', 'modal'], mode: 'dorian', bpm: 104,
    blurb: 'Two chords, one mode, endless groove (Santana approved).',
    tokens: [T('i7', 2), T('IV7', 2)],
  },
  {
    id: 'mixo-jam', name: 'Mixolydian Jam', vibe: ['rock', 'modal'], mode: 'mixolydian', bpm: 116,
    blurb: 'I–bVII–IV: the classic-rock backdoor shuffle.',
    tokens: [T('I'), T('bVII'), T('IV'), T('I')],
  },
  {
    id: 'lydian-dream', name: 'Lydian Dream', vibe: ['dreamy', 'modal'], mode: 'lydian', bpm: 84,
    blurb: 'Imaj7–II floats on the sharp-four shimmer.',
    tokens: [T('Imaj7', 2), T('II', 2)],
  },
  {
    id: 'phrygian-gate', name: 'Phrygian Gate', vibe: ['dark', 'modal'], mode: 'phrygian', bpm: 100,
    blurb: 'i–bII: menace one half step above home.',
    tokens: [T('i', 2), T('bII', 2)],
  },
  {
    id: 'circle', name: 'Circle of Fifths', vibe: ['jazz', 'classical'], mode: 'major', bpm: 112,
    blurb: 'iii–vi–ii–V–I: falling fifths all the way home.',
    tokens: [T('iii7'), T('vi7'), T('ii7'), T('V7'), T('Imaj7', 2)],
  },
  {
    id: 'sunshine-stairs', name: 'Sunshine Stairs', vibe: ['pop', 'dreamy'], mode: 'major', bpm: 92,
    blurb: 'Diatonic sevenths climbing the first four steps.',
    tokens: [T('Imaj7'), T('ii7'), T('iii7'), T('IVmaj7')],
  },
];

export const ALL_VIBES: string[] = [...new Set(PRESETS.flatMap((p) => p.vibe))].sort();
