// Progressions are lists of slots holding roman numerals; chords are realized
// against the current key on render, so changing key re-spells everything.

import { noteLabel, simplify } from './notes';
import { Key, SCALES, scalePcs, spellScale } from './scales';
import { Chord, chordSymbol } from './chords';
import { resolveNumeral } from './roman';

export interface Slot {
  id: number;
  numeral: string;
  /** bars this chord lasts (display + playback) */
  bars: number;
  /** short stage direction, e.g. "let it hang…" */
  annotation?: string;
  /** id of the spice that created/altered this slot (for highlighting) */
  spiceId?: string;
  /** pedal-point spice: force the key's tonic as bass */
  pedalBass?: boolean;
}

let slotCounter = 1;
export const newSlot = (numeral: string, bars = 1, extra?: Partial<Slot>): Slot =>
  ({ id: slotCounter++, numeral, bars, ...extra });

export interface RealizedSlot {
  slot: Slot;
  chord: Chord;
}

export function realizeSlot(slot: Slot, key: Key): RealizedSlot {
  const chord = resolveNumeral(slot.numeral, key);
  if (slot.pedalBass) chord.bass = key.tonic;
  return { slot, chord };
}

export const realize = (slots: Slot[], key: Key): RealizedSlot[] =>
  slots.map((s) => realizeSlot(s, key));

/** "C — Am — F — G" */
export function progressionLabel(slots: Slot[], key: Key): string {
  return realize(slots, key).map((r) => chordSymbol(r.chord)).join(' — ');
}

// ---------------------------------------------------------------------------
// Diatonic palette: every chord that lives natively in the key's mode —
// the software version of the chord_files "main chords" window.

export interface PaletteEntry {
  numeral: string;
  chord: Chord;
  /** numeral with idiomatic 7th, e.g. "ii7", used when a genre prefers sevenths */
  seventhNumeral: string;
}

const TRIAD_NUMERAL: Record<string, string> = {
  // interval pattern of (third, fifth) above root -> chord case/suffix
  '4,7': 'maj', '3,7': 'min', '3,6': 'dim', '4,8': 'aug',
};

export function diatonicPalette(key: Key): PaletteEntry[] {
  const pcs = scalePcs(key.tonic, SCALES[key.mode]);
  const majorPcs = scalePcs(key.tonic, SCALES.major);
  const out: PaletteEntry[] = [];
  for (let d = 0; d < 7; d++) {
    const root = pcs[d];
    const third = (pcs[(d + 2) % 7] - root + 12) % 12;
    const fifth = (pcs[(d + 4) % 7] - root + 12) % 12;
    const seventh = (pcs[(d + 6) % 7] - root + 12) % 12;
    const kind = TRIAD_NUMERAL[`${third},${fifth}`];
    if (!kind) continue;
    let acc = root - majorPcs[d];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    const accStr = acc === -1 ? 'b' : acc === 1 ? '#' : '';
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d];
    const lower = kind === 'min' || kind === 'dim';
    let numeral = accStr + (lower ? roman.toLowerCase() : roman);
    if (kind === 'dim') numeral += 'o';
    if (kind === 'aug') numeral += '+';
    // idiomatic seventh: maj7 on 1/4 of major-ish, 7 on dominants, m7 on minors, ø7 on dim
    let seventhNumeral: string;
    if (kind === 'dim') seventhNumeral = accStr + roman.toLowerCase() + (seventh === 9 ? 'o7' : 'ø7');
    else if (kind === 'min') seventhNumeral = accStr + roman.toLowerCase() + '7';
    else if (seventh === 10) seventhNumeral = accStr + roman + '7';
    else seventhNumeral = accStr + roman + 'maj7';
    out.push({ numeral, chord: resolveNumeral(numeral, key), seventhNumeral });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Borrow shelf: idiomatic out-of-key chords per mode — the "modal interchange"
// window of the folder, with the why attached.

export interface ShelfEntry {
  numeral: string;
  hook: string;
}

const SHELVES: Record<Key['mode'], ShelfEntry[]> = {
  major: [
    { numeral: 'iv', hook: 'from the parallel minor — the bittersweet IV' },
    { numeral: 'bVII', hook: 'the rock & roll back door' },
    { numeral: 'bVI', hook: 'epic lift, borrowed darkness' },
    { numeral: 'bIII', hook: 'gritty sidestep, parallel minor' },
    { numeral: 'bVII7', hook: 'backdoor dominant — resolves home without the V' },
    { numeral: 'iiø7', hook: 'half-diminished ii, borrowed gloom before the V' },
  ],
  lydian: [
    { numeral: 'iv', hook: 'cancel the ♯4 and grieve a little' },
    { numeral: 'bVII', hook: 'ground the float with a plain-clothes chord' },
    { numeral: 'bVI', hook: 'borrowed darkness under the shimmer' },
    { numeral: 'bIII', hook: 'gritty sidestep, parallel minor' },
  ],
  mixolydian: [
    { numeral: 'V7', hook: 'borrow the leading tone back for a real cadence' },
    { numeral: 'iv', hook: 'parallel-minor rain' },
    { numeral: 'bVI', hook: 'epic lift, borrowed darkness' },
    { numeral: 'bIII', hook: 'one more flat than you own' },
  ],
  minor: [
    { numeral: 'V7', hook: 'raised leading tone (harmonic minor) — real gravity' },
    { numeral: 'IV', hook: 'major IV from Dorian — hopeful lift' },
    { numeral: 'bII', hook: 'Neapolitan / Phrygian menace, a half step above home' },
    { numeral: 'viio7/i', hook: 'leading-tone diminished — maximum pull to i' },
    { numeral: 'I', hook: 'Picardy third — end the gloom in sunshine' },
  ],
  dorian: [
    { numeral: 'V7', hook: 'real dominant gravity when the vamp needs an exit' },
    { numeral: 'bVI', hook: 'aeolian shadow when Dorian gets too sunny' },
    { numeral: 'bII', hook: 'a pinch of Phrygian menace' },
    { numeral: 'I', hook: 'Picardy third — leave them smiling' },
  ],
  phrygian: [
    { numeral: 'V7', hook: 'harmonic gravity smuggled into the dungeon' },
    { numeral: 'IV', hook: 'Dorian sunshine through the bars' },
    { numeral: 'I', hook: 'Picardy third — the dungeon door opens' },
  ],
};

export const borrowShelf = (key: Key): ShelfEntry[] => SHELVES[key.mode];

/** Key label like "A minor" / "E♭ major". */
export function keyLabel(key: Key): string {
  const modeName = { major: 'major', minor: 'minor', dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian' }[key.mode];
  return `${noteLabel(simplify(key.tonic))} ${modeName}`;
}

/** Notes of the key's scale as labels, for the header strip. */
export function keyScaleLabels(key: Key): string[] {
  return spellScale(key.tonic, SCALES[key.mode]).map((n) => noteLabel(n));
}
