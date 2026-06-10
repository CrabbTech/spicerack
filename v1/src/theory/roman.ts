// Roman numeral chords. Numerals are read relative to the MAJOR scale of the
// tonic (the common-practice convention), so "bVII" in A is G regardless of
// mode, "V7" in A minor is E7, and "V7/vi" is a secondary dominant of vi.

import {
  LETTERS, NoteName, letterIndex, mod7, mod12, notePc, spellWithLetter,
} from './notes';
import { Key, SCALES, isMinorish, scalePcs } from './scales';
import { Chord, ChordQuality, FuncTag, QUALITIES, QualityId } from './chords';

const MAJOR_PCS = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface NumeralCore {
  /** accidental on the degree: -1 = ♭, 0, +1 = ♯ */
  acc: number;
  /** scale degree 1..7 */
  degree: number;
  lower: boolean;
}

export interface NumeralParts extends NumeralCore {
  suffix: string;
  target?: NumeralCore;
}

const NUMERAL_RE =
  /^([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)([^/]*)(?:\/([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i))?$/;

const normalize = (s: string): string =>
  s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/°/g, 'o').replace(/Δ/g, 'maj7').trim();

function degreeOf(roman: string): { degree: number; lower: boolean } {
  const lower = roman === roman.toLowerCase();
  return { degree: ROMAN.indexOf(roman.toUpperCase()) + 1, lower };
}

function qualityFor(suffix: string, lower: boolean): ChordQuality {
  const table: Record<string, QualityId | [QualityId, QualityId]> = {
    // value = quality, or [upper-case quality, lower-case quality]
    '': ['maj', 'min'],
    '5': 'pow',
    '6': ['six', 'm6'],
    '7': ['dom7', 'm7'],
    '9': ['dom9', 'm9'],
    '11': 'm11',
    '13': 'dom13',
    'maj7': ['maj7', 'mMaj7'],
    'maj9': 'maj9',
    'add9': 'add9',
    'sus2': 'sus2',
    'sus4': 'sus4',
    '7sus4': 'dom7sus4',
    'o': 'dim', 'dim': 'dim',
    'o7': 'dim7', 'dim7': 'dim7',
    'ø': 'm7b5', 'ø7': 'm7b5',
    '+': 'aug', 'aug': 'aug',
    '7#9': 'dom7s9',
    '7b9': 'dom7b9',
    'maj7#11': 'maj7s11',
  };
  const hit = table[suffix];
  if (hit === undefined) throw new Error(`Unknown chord suffix "${suffix}"`);
  const id = Array.isArray(hit) ? hit[lower ? 1 : 0] : hit;
  return QUALITIES[id];
}

export function parseNumeralParts(input: string): NumeralParts {
  const m = NUMERAL_RE.exec(normalize(input));
  if (!m) throw new Error(`Cannot parse numeral "${input}"`);
  const [, accStr, roman, suffix, tAccStr, tRoman] = m;
  const acc = accStr === 'b' ? -1 : accStr === '#' ? 1 : 0;
  const { degree, lower } = degreeOf(roman);
  const parts: NumeralParts = { acc, degree, lower, suffix: suffix ?? '' };
  if (tRoman) {
    const t = degreeOf(tRoman);
    parts.target = { acc: tAccStr === 'b' ? -1 : tAccStr === '#' ? 1 : 0, degree: t.degree, lower: t.lower };
  }
  // validate suffix eagerly so bad template data fails fast
  qualityFor(parts.suffix, parts.lower);
  return parts;
}

export function coreToString(c: NumeralCore): string {
  const acc = c.acc === -1 ? 'b' : c.acc === 1 ? '#' : '';
  const roman = ROMAN[c.degree - 1];
  return acc + (c.lower ? roman.toLowerCase() : roman);
}

export function partsToString(p: NumeralParts): string {
  return coreToString(p) + p.suffix + (p.target ? '/' + coreToString(p.target) : '');
}

/** Pretty form for UI: ♭VII, V⁷ stays V7 (superscripts hurt legibility at small sizes). */
export const prettyNumeral = (numeral: string): string =>
  numeral.replace(/b(?=[IViv])/g, '♭').replace(/#(?=[IViv])/g, '♯').replace(/7b9/g, '7♭9').replace(/7#9/g, '7♯9').replace(/o(?=7|$)/g, '°');

/** Root of a numeral measured against `tonic`'s major scale. */
export function numeralRoot(core: NumeralCore, tonic: NoteName): NoteName {
  const letter = LETTERS[mod7(letterIndex(tonic.letter) + core.degree - 1)];
  const pc = mod12(notePc(tonic) + MAJOR_PCS[core.degree - 1] + core.acc);
  return spellWithLetter(letter, pc);
}

function classifyFunc(parts: NumeralParts, key: Key, quality: ChordQuality): FuncTag {
  if (parts.target) return 'secondary';
  const pcs = scalePcs(key.tonic, SCALES[key.mode]);
  const d = parts.degree - 1;
  const rootPc = mod12(notePc(key.tonic) + MAJOR_PCS[d] + parts.acc);
  if (pcs[d] !== rootPc) return 'borrowed';
  const third = quality.tones.find((t) => t.degree === 3);
  const fifth = quality.tones.find((t) => t.degree === 5);
  // a major-third chord on degree 5 of a minor-ish mode is THE dominant by convention
  if (parts.degree === 5 && third?.semitones === 4 && isMinorish(key.mode)) return 'dominant';
  const diaThird = mod12(pcs[(d + 2) % 7] - pcs[d]);
  const diaFifth = mod12(pcs[(d + 4) % 7] - pcs[d]);
  if (third && third.semitones !== diaThird) return 'borrowed';
  if (fifth && quality.id !== 'pow' && fifth.semitones !== diaFifth) return 'borrowed';
  if (parts.degree === 2 || parts.degree === 4) return 'subdominant';
  if (parts.degree === 5 || parts.degree === 7) return 'dominant';
  return 'tonic';
}

/** Turn a numeral string into a concrete chord in a key. */
export function resolveNumeral(numeral: string, key: Key): Chord {
  const parts = parseNumeralParts(numeral);
  const quality = qualityFor(parts.suffix, parts.lower);
  let root: NoteName;
  let secondaryOf: string | undefined;
  if (parts.target) {
    const targetRoot = numeralRoot(parts.target, key.tonic);
    root = numeralRoot(parts, targetRoot);
    secondaryOf = coreToString(parts.target);
  }
  else {
    root = numeralRoot(parts, key.tonic);
  }
  return { root, quality, numeral: partsToString(parts), func: classifyFunc(parts, key, quality), secondaryOf };
}

/** Swap the quality suffix on a numeral, keeping degree/case/target. */
export function withSuffix(numeral: string, suffix: string): string {
  const parts = parseNumeralParts(numeral);
  return partsToString({ ...parts, suffix });
}

/**
 * Numeral for the pitch one semitone above/below a given numeral's root,
 * keeping the same suffix — used for chromatic approach chords.
 * Prefers re-spelling on the neighbouring degree; falls back to altering in place.
 */
export function chromaticNeighborNumeral(numeral: string, dir: 1 | -1): string | undefined {
  const parts = parseNumeralParts(numeralStripTarget(numeral));
  const basePc = mod12(MAJOR_PCS[parts.degree - 1] + parts.acc + dir);
  const candidates: NumeralCore[] = [];
  const neighborDegree = mod7(parts.degree - 1 + dir) + 1;
  for (const degree of [neighborDegree, parts.degree]) {
    let acc = mod12(basePc - MAJOR_PCS[degree - 1]);
    if (acc > 6) acc -= 12;
    if (Math.abs(acc) <= 1) candidates.push({ acc, degree, lower: parts.lower });
  }
  if (!candidates.length) return undefined;
  return coreToString(candidates[0]) + parts.suffix;
}

const numeralStripTarget = (numeral: string): string => normalize(numeral).split('/')[0];

/** "V7" for a target numeral core, e.g. secondaryDominantOf("vi") -> "V7/vi". */
export function secondaryDominantOf(targetNumeral: string, flavor: '7' | '7b9' = '7'): string {
  const t = parseNumeralParts(targetNumeral);
  return `V${flavor}/` + coreToString(t);
}

/** Tritone sub of a dominant that resolves to `targetNumeral`: bII7 (of the target). */
export function tritoneSubOf(targetNumeral: string): string | undefined {
  const t = parseNumeralParts(targetNumeral);
  if (t.target) return undefined; // a chord pointing at a secondary chord — too deep to spell
  if (t.degree === 1 && t.acc === 0) return 'bII7';
  return 'bII7/' + coreToString(t);
}
