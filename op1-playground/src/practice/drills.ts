// Drills: flashcards for the hands. A card names something — a chord, a
// physical key, a note — and you press it (QWERTY piano or the hardware).
// Pure generation + judging; the view only feeds presses in.

import { Note } from 'tonal';
import { KeySig, diatonicPalette, parseToken, prettyNote, scaleNotes } from '../theory/harmony';
import { OP1_BASE_MIDI, OP1_KEY_COUNT, Voicing, fitChord, keyTag } from '../op1/op1';
import { CompiledBar } from '../songs/compile';
import { Rng } from '../lib/rng';

export type DrillKind = 'chord' | 'keytag' | 'note' | 'ear';

export const DRILL_KINDS: { id: DrillKind; label: string; blurb: string }[] = [
  { id: 'chord', label: 'chord grabs', blurb: 'a chord name — press every tone, any octave, any order' },
  { id: 'keytag', label: 'key tags', blurb: 'a B/T key tag — press exactly that physical key' },
  { id: 'note', label: 'note names', blurb: 'a note name — press it on either octave' },
  { id: 'ear', label: 'by ear', blurb: 'hear a chord — grab its tones before you see its name' },
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
  /** exact keys to collect (song-grab cards) */
  targetIndexes?: number[];
  /** what to light up when the card is done */
  reveal: { index: number; label: string; isRoot: boolean }[];
  /** midis to sound when the card is dealt (ear cards) */
  audio?: number[];
  /** the name kept hidden until the card is done (ear cards) */
  answer?: string;
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
  const reveal = revealFromVoicing(voicing, chord.notes, Note.chroma(chord.root) ?? 0);
  if (kind === 'ear') {
    return {
      kind,
      prompt: '🔊 listen',
      sub: 'grab what you hear — any octave, any order',
      targetChromas: chromas,
      reveal,
      audio: voicing.midis,
      answer: chord.symbol,
    };
  }
  return {
    kind,
    prompt: chord.symbol,
    sub: `${pick.numeral} in ${prettyNote(key.tonic)} — every tone, any octave`,
    targetChromas: chromas,
    reveal,
  };
}

export interface SongDrillBar {
  bar: CompiledBar;
  sectionName: string;
}

/** A grab from the repertoire: this bar's chord, exactly as the tab voices it. */
export function makeSongCard(bars: SongDrillBar[], rng: Rng): DrillCard {
  const pick = bars[Math.floor(rng() * bars.length)];
  const { bar } = pick;
  const rootChroma = Note.chroma(bar.chord.bass ?? bar.chord.root) ?? -1;
  return {
    kind: 'chord',
    prompt: bar.chord.symbol,
    sub: `bar ${bar.number} · ${pick.sectionName} — grab it exactly as the tab voices it`,
    targetIndexes: bar.voicing.midis.map((m) => m - OP1_BASE_MIDI),
    reveal: bar.voicing.midis.map((m, i) => ({
      index: m - OP1_BASE_MIDI,
      label: bar.keyTags[i],
      isRoot: m % 12 === rootChroma,
    })),
  };
}

export type PressResult =
  | { verdict: 'good'; done: boolean; collected: number[] }
  | { verdict: 'already'; done: false; collected: number[] }
  | { verdict: 'wrong'; done: false; collected: number[] };

/** Judge one key press against a card, given what is collected so far. */
export function judgePress(card: DrillCard, index: number, collected: number[]): PressResult {
  if (card.targetIndexes) {
    if (!card.targetIndexes.includes(index)) return { verdict: 'wrong', done: false, collected };
    if (collected.includes(index)) return { verdict: 'already', done: false, collected };
    const next = [...collected, index];
    return { verdict: 'good', done: next.length === card.targetIndexes.length, collected: next };
  }
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
