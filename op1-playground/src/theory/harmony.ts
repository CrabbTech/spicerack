// Thin convention adapter over tonal. tonal supplies the primitives (intervals,
// transposition, chord dictionary, mode spelling); this file supplies the
// conventions this playground reads charts in:
//   - numerals are read against the TONIC MAJOR scale (bVII in A is G, always)
//   - case carries quality: ii7 = m7, II7 = dominant 7
//   - secondary chords: V7/vi = the V7 of vi's root
// (tonal's own Progression helper ignores case and can't do secondaries,
// which is why this adapter exists.)

import { Chord, Mode, Note, RomanNumeral } from 'tonal';

export type ModeId = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian';

export interface KeySig {
  tonic: string; // 'C', 'Eb', 'F#'
  mode: ModeId;
}

export const MODE_NAMES: Record<ModeId, string> = {
  major: 'Major', minor: 'Minor', dorian: 'Dorian',
  phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian',
};

export const TONIC_CHOICES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export type FuncTag = 'tonic' | 'subdominant' | 'dominant' | 'borrowed' | 'secondary';

export interface ChordInfo {
  /** token as entered/generated: 'ii7', 'V7/vi' or 'Am7' */
  token: string;
  /** normalized roman numeral, when one is known */
  numeral?: string;
  /** display symbol, e.g. 'B♭m7' */
  symbol: string;
  root: string;
  bass?: string;
  /** tonal quality name for teaching copy, e.g. 'minor seventh' */
  typeName: string;
  /** spelled tones root-first */
  notes: string[];
  intervals: string[];
  func: FuncTag;
  secondaryOf?: string;
  source: 'roman' | 'symbol';
}

// Chord vocabulary: numeral suffix -> canonical tonal alias, by numeral case.
const UPPER_TYPES: Record<string, string> = {
  '': 'M', '5': '5', '6': '6', '7': '7', '9': '9', '11': '11', '13': '13',
  maj7: 'maj7', maj9: 'maj9', add9: 'add9', sus2: 'sus2', sus4: 'sus4',
  '7sus4': '7sus4', aug: 'aug', '+': 'aug', '7b9': '7b9', '7#9': '7#9', 'maj7#11': 'maj7#11',
};
const LOWER_TYPES: Record<string, string> = {
  '': 'm', '5': '5', '6': 'm6', '7': 'm7', '9': 'm9', '11': 'm11',
  maj7: 'mMaj7', add9: 'madd9', o: 'dim', dim: 'dim', o7: 'dim7', dim7: 'dim7',
  'ø': 'm7b5', 'ø7': 'm7b5', '7b5': 'm7b5', sus2: 'sus2', sus4: 'sus4',
};

// Canonical alias -> how to write it (numeral suffix + printable chord suffix).
interface AliasInfo { lower: boolean; suffix: string; disp: string }
const ALIAS_INFO: Record<string, AliasInfo> = {
  M: { lower: false, suffix: '', disp: '' },
  m: { lower: true, suffix: '', disp: 'm' },
  '5': { lower: false, suffix: '5', disp: '5' },
  '6': { lower: false, suffix: '6', disp: '6' },
  m6: { lower: true, suffix: '6', disp: 'm6' },
  '7': { lower: false, suffix: '7', disp: '7' },
  maj7: { lower: false, suffix: 'maj7', disp: 'maj7' },
  m7: { lower: true, suffix: '7', disp: 'm7' },
  mMaj7: { lower: true, suffix: 'maj7', disp: 'm(maj7)' },
  dim: { lower: true, suffix: 'o', disp: 'dim' },
  dim7: { lower: true, suffix: 'o7', disp: 'dim7' },
  m7b5: { lower: true, suffix: 'ø7', disp: 'm7♭5' },
  '9': { lower: false, suffix: '9', disp: '9' },
  maj9: { lower: false, suffix: 'maj9', disp: 'maj9' },
  m9: { lower: true, suffix: '9', disp: 'm9' },
  add9: { lower: false, suffix: 'add9', disp: 'add9' },
  madd9: { lower: true, suffix: 'add9', disp: 'madd9' },
  '11': { lower: false, suffix: '11', disp: '11' },
  m11: { lower: true, suffix: '11', disp: 'm11' },
  '13': { lower: false, suffix: '13', disp: '13' },
  sus2: { lower: false, suffix: 'sus2', disp: 'sus2' },
  sus4: { lower: false, suffix: 'sus4', disp: 'sus4' },
  '7sus4': { lower: false, suffix: '7sus4', disp: '7sus4' },
  aug: { lower: false, suffix: 'aug', disp: 'aug' },
  '7b9': { lower: false, suffix: '7b9', disp: '7♭9' },
  '7#9': { lower: false, suffix: '7#9', disp: '7♯9' },
  'maj7#11': { lower: false, suffix: 'maj7#11', disp: 'maj7♯11' },
};

const normalize = (s: string): string =>
  s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/°/g, 'o').replace(/Δ/g, 'maj7').trim();

export const looksRoman = (token: string): boolean => /^[b#]?[IViv]/.test(normalize(token));

export const prettyNote = (n: string): string => n.replace(/b/g, '♭').replace(/#/g, '♯');

export function prettyNumeral(numeral: string): string {
  return numeral
    .replace(/(^|\/)b/g, '$1♭').replace(/(^|\/)#/g, '$1♯')
    .replace(/7b9/g, '7♭9').replace(/7#9/g, '7♯9').replace(/maj7#11/g, 'maj7♯11')
    .replace(/o7/g, '°7').replace(/o(?=$|\/)/g, '°');
}

const isDimAlias = (alias: string): boolean => alias === 'dim' || alias === 'dim7' || alias === 'm7b5';
const minorish = (mode: ModeId): boolean => mode === 'minor' || mode === 'dorian' || mode === 'phrygian';

export const scaleNotes = (key: KeySig): string[] => Mode.notes(key.mode, key.tonic);

export const scaleChromas = (key: KeySig): number[] =>
  scaleNotes(key).map((n) => Note.chroma(n) ?? 0);

export function prefersFlats(key: KeySig): boolean {
  const joined = scaleNotes(key).join('');
  return (joined.match(/b/g)?.length ?? 0) >= (joined.match(/#/g)?.length ?? 0) &&
    joined.includes('b') || key.tonic.includes('b') || key.tonic === 'F';
}

export const keyLabel = (key: KeySig): string =>
  `${prettyNote(key.tonic)} ${key.mode === 'major' || key.mode === 'minor' ? key.mode : MODE_NAMES[key.mode]}`;

/** Midi -> display name spelled to suit the key, e.g. 61 -> 'D♭5' in Ab. */
export function midiName(midi: number, key: KeySig): string {
  const chroma = midi % 12;
  const inScale = scaleNotes(key).find((n) => Note.chroma(n) === chroma);
  const octave = Math.floor(midi / 12) - 1;
  if (inScale && Math.abs(Note.get(inScale).alt ?? 0) <= 1) {
    // letter-true octave: C-family letters flip octave at B/C boundary correctly
    const ref = Note.midi(inScale + octave);
    const oct = ref === midi ? octave : octave + Math.sign(midi - (ref ?? midi));
    return prettyNote(inScale) + oct;
  }
  const name = Note.fromMidi(midi);
  const sharp = Note.fromMidiSharps(midi);
  return prettyNote(prefersFlats(key) ? name : sharp);
}

function classify(step: number, acc: string, alias: string, chordNotes: string[], key: KeySig): FuncTag {
  const chord3M = Chord.getChord(alias, 'C').intervals.includes('3M');
  if (step === 4 && !acc && chord3M && minorish(key.mode)) return 'dominant';
  if (step === 6 && !acc && isDimAlias(alias)) return 'dominant';
  const inKey = new Set(scaleChromas(key));
  const diatonic = chordNotes.every((n) => inKey.has((Note.chroma(n) ?? 0) % 12));
  if (!diatonic) return 'borrowed';
  return ([, 'subdominant', 'tonic', 'subdominant', 'dominant', 'tonic', 'dominant'][step] ?? 'tonic') as FuncTag;
}

/** Core of a numeral without quality suffix: 'ii7' -> 'ii', 'bVII7' -> 'bVII'. */
export function numeralCore(numeral: string): string {
  const rn = RomanNumeral.get(normalize(numeral).split('/')[0]);
  return rn.empty ? numeral : rn.acc + rn.roman;
}

/** Resolve a roman token (possibly 'X/Y') to a concrete chord in the key. */
export function resolveRoman(token: string, key: KeySig): ChordInfo {
  const clean = normalize(token);
  const [head, target] = clean.split('/');
  let baseTonic = key.tonic;
  let secondaryOf: string | undefined;
  if (target !== undefined) {
    const rnT = RomanNumeral.get(target);
    if (rnT.empty) throw new Error(`Cannot read secondary target "${target}"`);
    baseTonic = Note.simplify(Note.transpose(key.tonic, rnT.interval));
    secondaryOf = rnT.acc + rnT.roman;
  }
  const rn = RomanNumeral.get(head);
  if (rn.empty) throw new Error(`Cannot read numeral "${head}"`);
  const alias = (rn.major ? UPPER_TYPES : LOWER_TYPES)[rn.chordType];
  if (alias === undefined) throw new Error(`Unknown chord suffix "${rn.chordType}" in "${token}"`);
  const root = Note.simplify(Note.transpose(baseTonic, rn.interval));
  const ch = Chord.getChord(alias, root);
  if (ch.empty) throw new Error(`No chord for "${token}"`);
  const info = ALIAS_INFO[alias];
  const numeral = rn.acc + rn.roman + info.suffix + (secondaryOf ? '/' + secondaryOf : '');
  return {
    token, numeral,
    symbol: prettyNote(root) + info.disp,
    root,
    typeName: ch.name.replace(`${root} `, '') || ch.type,
    notes: ch.notes,
    intervals: ch.intervals,
    func: secondaryOf ? 'secondary' : classify(rn.step, rn.acc, alias, ch.notes, key),
    secondaryOf,
    source: 'roman',
  };
}

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Infer the conventional numeral of an absolute chord within a key, if clean. */
export function inferNumeral(root: string, alias: string, key: KeySig): string | undefined {
  const info = ALIAS_INFO[alias];
  if (!info) return undefined;
  const rootN = Note.get(root);
  const tonicN = Note.get(key.tonic);
  if (rootN.empty || tonicN.empty) return undefined;
  const step = (LETTER_INDEX[rootN.letter] - LETTER_INDEX[tonicN.letter] + 7) % 7;
  let alt = ((rootN.chroma ?? 0) - (tonicN.chroma ?? 0) - MAJOR_SEMIS[step] + 24) % 12;
  if (alt > 6) alt -= 12;
  if (Math.abs(alt) > 1) return undefined;
  const acc = alt === -1 ? 'b' : alt === 1 ? '#' : '';
  const roman = info.lower ? ROMAN[step].toLowerCase() : ROMAN[step];
  return acc + roman + info.suffix;
}

/** Parse an absolute chord symbol like 'Am7', 'Bbmaj7', 'C/E'. */
export function parseSymbol(token: string, key: KeySig): ChordInfo | undefined {
  const clean = normalize(token);
  const ch = Chord.get(clean);
  if (ch.empty || !ch.tonic) return undefined;
  const alias = ch.aliases.find((a) => a in ALIAS_INFO);
  const rootFirst = alias ? Chord.getChord(alias, ch.tonic) : ch;
  const numeral = alias ? inferNumeral(ch.tonic, alias, key) : undefined;
  const info = alias ? ALIAS_INFO[alias] : undefined;
  let func: FuncTag = 'borrowed';
  if (numeral && alias) {
    const rn = RomanNumeral.get(numeral);
    if (!rn.empty) func = classify(rn.step, rn.acc, alias, rootFirst.notes, key);
  }
  return {
    token,
    numeral,
    symbol: info ? prettyNote(ch.tonic) + info.disp + (ch.bass ? '/' + prettyNote(ch.bass) : '') : prettyNote(ch.symbol),
    root: ch.tonic,
    bass: ch.bass || undefined,
    typeName: ch.type || 'chord',
    notes: rootFirst.notes,
    intervals: rootFirst.intervals,
    func,
    source: 'symbol',
  };
}

export interface ParsedToken {
  chord: ChordInfo;
  warning?: string;
}

/** Roman numerals first, chord symbols second, warning fallback last. */
export function parseToken(token: string, key: KeySig): ParsedToken {
  if (looksRoman(token)) {
    try {
      return { chord: resolveRoman(token, key) };
    }
    catch {
      // fall through to symbol parsing ('bass' note names never reach here)
    }
  }
  const sym = parseSymbol(token, key);
  if (sym) return { chord: sym };
  return { chord: resolveRoman('I', key), warning: `Could not read "${token}"` };
}

export const tokenize = (text: string): string[] =>
  text.replace(/[—–,;|]/g, ' ').split(/\s+/).map((t) => t.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Key palettes, via tonal's Mode chords.

export interface PaletteChord {
  numeral: string;
  symbol: string;
}

/** The seven diatonic chords of the key, as triads or idiomatic sevenths. */
export function diatonicPalette(key: KeySig, sevenths: boolean): PaletteChord[] {
  const symbols = sevenths
    ? Mode.seventhChords(key.mode, key.tonic)
    : Mode.triads(key.mode, key.tonic);
  return symbols.flatMap((symbol) => {
    const ch = Chord.get(symbol);
    if (ch.empty || !ch.tonic) return [];
    const alias = ch.aliases.find((a) => a in ALIAS_INFO);
    const numeral = alias ? inferNumeral(ch.tonic, alias, key) : undefined;
    if (!numeral || !alias) return [];
    return [{ numeral, symbol: prettyNote(ch.tonic) + ALIAS_INFO[alias].disp }];
  });
}

/** '1P 3m 5d 7m' -> '1 ♭3 ♭5 ♭7' — degree formula for the theory grid. */
export function formulaFromIntervals(intervals: string[]): string {
  return intervals.map((iv) => {
    const num = iv.replace(/[^0-9]/g, '');
    const q = iv.replace(/[0-9]/g, '');
    const acc = q === 'm' ? '♭' : q === 'A' ? '♯' : q === 'd' ? (num === '5' ? '♭' : '𝄫') : '';
    return acc + num;
  }).join(' ');
}

/** 'V7' aimed at a target numeral, e.g. secondaryDominantOf('vi') -> 'V7/vi'. */
export function secondaryDominantOf(targetNumeral: string): string | undefined {
  const core = numeralCore(targetNumeral);
  if (core === 'I' || targetNumeral.includes('/')) return undefined;
  return `V7/${core}`;
}

/** Tritone substitute aimed at a target: bII7 of the target's root. */
export function tritoneSubOf(targetNumeral: string): string | undefined {
  if (targetNumeral.includes('/')) return undefined;
  const core = numeralCore(targetNumeral);
  return core === 'I' || core === 'i' ? 'bII7' : `bII7/${core}`;
}
