// Pitch fundamentals: pitch classes, spelled note names, midi math.
// Spelling is letter-based so keys come out correct (B♭ in F major, not A♯).

export type PitchClass = number; // 0..11, C = 0

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

export const LETTER_PC: Record<Letter, PitchClass> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export interface NoteName {
  letter: Letter;
  /** semitone offset from the natural letter: -2 (𝄫) .. +2 (𝄪) */
  alter: number;
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;
export const mod7 = (n: number): number => ((n % 7) + 7) % 7;

export const letterIndex = (letter: Letter): number => LETTERS.indexOf(letter);

export const notePc = (n: NoteName): PitchClass => mod12(LETTER_PC[n.letter] + n.alter);

/** Spell pitch class `pc` using a specific letter, wrapping the alteration to the nearest. */
export function spellWithLetter(letter: Letter, pc: PitchClass): NoteName {
  let alter = mod12(pc - LETTER_PC[letter]);
  if (alter > 6) alter -= 12;
  return { letter, alter };
}

const SHARP_TABLE: ReadonlyArray<NoteName> = [
  { letter: 'C', alter: 0 }, { letter: 'C', alter: 1 }, { letter: 'D', alter: 0 },
  { letter: 'D', alter: 1 }, { letter: 'E', alter: 0 }, { letter: 'F', alter: 0 },
  { letter: 'F', alter: 1 }, { letter: 'G', alter: 0 }, { letter: 'G', alter: 1 },
  { letter: 'A', alter: 0 }, { letter: 'A', alter: 1 }, { letter: 'B', alter: 0 },
];
const FLAT_TABLE: ReadonlyArray<NoteName> = [
  { letter: 'C', alter: 0 }, { letter: 'D', alter: -1 }, { letter: 'D', alter: 0 },
  { letter: 'E', alter: -1 }, { letter: 'E', alter: 0 }, { letter: 'F', alter: 0 },
  { letter: 'G', alter: -1 }, { letter: 'G', alter: 0 }, { letter: 'A', alter: -1 },
  { letter: 'A', alter: 0 }, { letter: 'B', alter: -1 }, { letter: 'B', alter: 0 },
];

export function spellPcSimple(pc: PitchClass, prefer: 'sharp' | 'flat' = 'sharp'): NoteName {
  return (prefer === 'flat' ? FLAT_TABLE : SHARP_TABLE)[mod12(pc)];
}

/** Re-spell double accidentals (and B♯/F♭-style oddities) as a friendlier enharmonic. */
export function simplify(n: NoteName, prefer: 'sharp' | 'flat' = 'flat'): NoteName {
  if (Math.abs(n.alter) <= 1) return n;
  return spellPcSimple(notePc(n), n.alter > 0 ? 'sharp' : prefer);
}

export function noteLabel(n: NoteName): string {
  const a = n.alter;
  const glyph =
    a === 0 ? '' :
    a === 1 ? '♯' : a === -1 ? '♭' :
    a === 2 ? '𝄪' : a === -2 ? '𝄫' :
    a > 0 ? '♯'.repeat(a) : '♭'.repeat(-a);
  return n.letter + glyph;
}

export function noteLabelAscii(n: NoteName): string {
  const a = n.alter;
  return n.letter + (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a));
}

/** Midi number for a spelled note. C4 = 60. */
export const midiOf = (n: NoteName, octave: number): number =>
  12 * (octave + 1) + LETTER_PC[n.letter] + n.alter;

export const midiPc = (midi: number): PitchClass => mod12(midi);

export const freqOfMidi = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Label a midi note within a key-ish context, e.g. 61 -> "C♯5" / "D♭5". */
export function midiLabel(midi: number, prefer: 'sharp' | 'flat' = 'sharp'): string {
  const name = spellPcSimple(mod12(midi), prefer);
  const octave = Math.floor(midi / 12) - 1;
  return noteLabel(name) + octave;
}
