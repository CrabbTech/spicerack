// Drills: flashcards for the hands. A card names something — a chord, a
// physical key, a note — and you press it (QWERTY piano or the hardware).
// Pure generation + judging; the view only feeds presses in.

import { Note } from 'tonal';
import { KeySig, diatonicPalette, parseToken, prettyNote, scaleNotes } from '../theory/harmony';
import { OP1_BASE_MIDI, OP1_KEY_COUNT, Voicing, fitChord, keyTag } from '../op1/op1';
import { Rng } from '../lib/rng';

export type DrillKind = 'chord' | 'keytag' | 'note';

export const DRILL_KINDS: { id: DrillKind; label: string; blurb: string }[] = [
  { id: 'chord', label: 'chord grabs', blurb: 'a chord name — press every tone, any octave, any order' },
  { id: 'keytag', label: 'key tags', blurb: 'a B/T key tag — press exactly that physical key' },
  { id: 'note', label: 'note names', blurb: 'a note name — press it on either octave' },
];

export interface DrillCard {
  kind: DrillKind;
  /** big text on the card */
  prompt: string;
  /** small line under it */
  sub: string;
  /** pitch classes to collect (chord & note cards) */
  targetChromas?: number[];
  /** exact key to press (keytag cards) */
  targetIndex?: number;
  /** what to light up when the card is done */
  reveal: { index: number; label: string; isRoot: boolean }[];
}

const revealFromVoicing = (voicing: Voicing, notes: string[], rootChroma: number) =>
  voicing.midis.map((m) => {
    const chroma = m % 12;
    const name = notes.find((n) => Note.chroma(n) === chroma) ?? '';
    return { index: m - OP1_BASE_MIDI, label: prettyNote(name), isRoot: chroma === rootChroma };
  });

export function makeCard(kind: DrillKind, key: KeySig, sevenths: boolean, rng: Rng): DrillCard {
  if (kind === 'keytag') {
    const index = Math.floor(rng() * OP1_KEY_COUNT);
    return {
      kind,
      prompt: keyTag(index),
      sub: 'press that physical key',
      targetIndex: index,
      reveal: [{ index, label: keyTag(index), isRoot: true }],
    };
  }
  if (kind === 'note') {
    const names = scaleNotes(key);
    const name = names[Math.floor(rng() * names.length)];
    const chroma = Note.chroma(name) ?? 0;
    const reveal: DrillCard['reveal'] = [];
    for (let i = 0; i < OP1_KEY_COUNT; i++) {
      if ((OP1_BASE_MIDI + i) % 12 === chroma) reveal.push({ index: i, label: prettyNote(name), isRoot: true });
    }
    return {
      kind,
      prompt: prettyNote(name),
      sub: 'press it — either octave counts',
      targetChromas: [chroma],
      reveal,
    };
  }
  const palette = diatonicPalette(key, sevenths);
  const pick = palette[Math.floor(rng() * palette.length)];
  const chord = parseToken(pick.numeral, key).chord;
  const chromas = [...new Set(chord.notes.map((n) => Note.chroma(n) ?? 0))];
  const voicing = fitChord(chord.notes, chord.intervals);
  return {
    kind,
    prompt: chord.symbol,
    sub: `${pick.numeral} in ${prettyNote(key.tonic)} — every tone, any octave`,
    targetChromas: chromas,
    reveal: revealFromVoicing(voicing, chord.notes, Note.chroma(chord.root) ?? 0),
  };
}

export type PressResult =
  | { verdict: 'good'; done: boolean; collected: number[] }
  | { verdict: 'already'; done: false; collected: number[] }
  | { verdict: 'wrong'; done: false; collected: number[] };

/** Judge one key press against a card, given the chromas collected so far. */
export function judgePress(card: DrillCard, index: number, collected: number[]): PressResult {
  if (card.targetIndex !== undefined) {
    return index === card.targetIndex
      ? { verdict: 'good', done: true, collected }
      : { verdict: 'wrong', done: false, collected };
  }
  const chroma = (OP1_BASE_MIDI + index) % 12;
  const targets = card.targetChromas ?? [];
  if (!targets.includes(chroma)) return { verdict: 'wrong', done: false, collected };
  if (collected.includes(chroma)) return { verdict: 'already', done: false, collected };
  const next = [...collected, chroma];
  return { verdict: 'good', done: next.length === targets.length, collected: next };
}

/** Run score: seconds plus a 2s penalty per wrong press — lower is better. */
export const runScore = (elapsedMs: number, mistakes: number): number =>
  Math.round((elapsedMs / 1000 + mistakes * 2) * 10) / 10;
