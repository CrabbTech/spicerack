// What could come next — and what could go underneath. Two questions a chart
// of "allowed chords" never answers: (1) given the chord I'm on, which chords
// would SETTLE, build TENSION, BRIGHTEN, DARKEN or SURPRISE, and which notes
// do the work; (2) given a melody I already have, which chords support it,
// and what does each melody note become inside them (3rd? floating 9th? the
// avoid note grinding a half step above the 3rd?).

import {
  LETTERS, NoteName, PitchClass,
  letterIndex, mod7, mod12, noteLabel, notePc, simplify, spellWithLetter,
} from './notes';
import { Key, ModeId, isMinorish, keyScale } from './scales';
import { Chord, chordSymbol, chordTones, isDominantFamily } from './chords';
import { parseNumeralParts, resolveNumeral, secondaryDominantOf, withSuffix } from './roman';
import { PaletteEntry, borrowShelf, diatonicPalette, keyLabel } from './progression';
import { VoiceMove, voiceMoves } from './transitions';

// ---------------------------------------------------------------------------
// Shared helpers

interface Tone {
  pc: PitchClass;
  /** written chord degree: 1, 3, 5, 7, 9… */
  degree: number;
  semitones: number;
  name: NoteName;
  label: string;
}

const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const ORDINAL = ['root', '2nd', '3rd', '4th', '5th', '6th', '7th'];

const show = (n: NoteName): string => noteLabel(simplify(n));

/** "F" → "F♮" — only used where a natural is being contrasted with its altered twin. */
const nat = (label: string): string => (/[♯♭]/.test(label) ? label : `${label}♮`);

const listOf = (items: string[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function tonesOf(chord: Chord): Tone[] {
  const names = chordTones(chord);
  const rootPc = notePc(chord.root);
  const seen = new Set<PitchClass>();
  const out: Tone[] = [];
  chord.quality.tones.forEach((t, i) => {
    const pc = mod12(rootPc + t.semitones);
    if (seen.has(pc)) return;
    seen.add(pc);
    out.push({ pc, degree: t.degree, semitones: t.semitones, name: names[i], label: show(names[i]) });
  });
  return out;
}

const spell = (chord: Chord): string => tonesOf(chord).map((t) => t.label).join('–');

const toneAt = (chord: Chord, degree: number): Tone | undefined =>
  tonesOf(chord).find((t) => t.degree === degree);

const thirdSemis = (chord: Chord): number | undefined =>
  chord.quality.tones.find((t) => t.degree === 3)?.semitones;

const hasMajorThird = (chord: Chord): boolean => thirdSemis(chord) === 4;

/** Root + triad shape: C, Cmaj7 and C7 are all "a C chord"; C and Cm are not. Used to keep `prev` out. */
const triadId = (chord: Chord): string =>
  `${notePc(chord.root)}|${chord.quality.tones.filter((t) => t.degree <= 5).map((t) => t.semitones).join(',')}`;

/** A ♭7 over anything but a minor 3rd: the chord has stopped being a color and started pointing somewhere. */
const pointsSomewhere = (chord: Chord): boolean =>
  thirdSemis(chord) !== 3 && chord.quality.tones.some((t) => t.degree === 7 && t.semitones === 10);

/**
 * De-duplication key across intents. D and D7 stay separate on purpose — one is
 * a color (the Lydian II), the other is G's dominant, and they teach different things.
 */
const identity = (chord: Chord): string => `${triadId(chord)}${pointsSomewhere(chord) ? '|dom' : ''}`;

const pairs = (moves: VoiceMove[]): string => listOf(moves.map((m) => `${m.from}→${m.to}`));

const commonTones = (a: Chord, b: Chord): Tone[] => {
  const pcs = new Set(tonesOf(b).map((t) => t.pc));
  return tonesOf(a).filter((t) => pcs.has(t.pc));
};

// ---------------------------------------------------------------------------
// 1. Next chord by intention

export type Intent = 'settle' | 'tension' | 'brighten' | 'darken' | 'surprise';

export interface NextOption {
  numeral: string;
  chord: Chord;
  intent: Intent;
  /** one sentence, specific: names the notes or the motion that creates the effect */
  why: string;
}

export const INTENTS: { id: Intent; name: string; blurb: string }[] = [
  { id: 'settle', name: 'Settle', blurb: 'Head toward rest: home, its close relatives, or the soft "Amen" road back.' },
  { id: 'tension', name: 'Build tension', blurb: 'Chords with a leading tone or a tritone inside. They want to resolve, so the bar after them matters.' },
  { id: 'brighten', name: 'Brighten', blurb: 'Raise a note of the key or step onto a major chord — same landscape, more light.' },
  { id: 'darken', name: 'Darken', blurb: 'Lower a note of the key: borrowed minor color, a cloud crossing the sun.' },
  { id: 'surprise', name: 'Surprise', blurb: 'Deceptive turns, chromatic mediants and the Neapolitan — somewhere the ear was not expecting to go.' },
];

const PER_INTENT = 3;
/** spares only step in while an intent has fewer options than this */
const MIN_PER_INTENT = 2;

interface Ctx {
  key: Key;
  tonicPc: PitchClass;
  tonic: string;
  scale: NoteName[];
  scalePcs: Set<PitchClass>;
  palette: PaletteEntry[];
  /** the tonic TRIAD — voice-leading toward home is always described against this */
  home: Chord;
  prev?: Chord;
  sevenths: boolean;
}

interface Cand {
  numeral: string;
  why: (chord: Chord) => string;
  /** keep this exact numeral even when sevenths are preferred */
  fixed?: boolean;
  /** a stand-in: only offered when the intent's idiomatic options have run short */
  spare?: boolean;
}

const spare = (cand: Cand | undefined): Cand | undefined => cand && { ...cand, spare: true };

const offsetOf = (c: Ctx, chord: Chord): number => mod12(notePc(chord.root) - c.tonicPc);

const inKey = (c: Ctx, chord: Chord): boolean => tonesOf(chord).every((t) => c.scalePcs.has(t.pc));

const entryAt = (c: Ctx, degree: number): PaletteEntry | undefined =>
  c.palette.find((e) => parseNumeralParts(e.numeral).degree === degree);

const isPlainTriad = (chord: Chord): boolean => chord.quality.id === 'maj' || chord.quality.id === 'min';

/** A chord on the 5th degree that acts as THE dominant (major 3rd, or a sus waiting for one). */
const isFifthDominant = (c: Ctx, chord: Chord): boolean =>
  offsetOf(c, chord) === 7 && !chord.secondaryOf && thirdSemis(chord) !== 3;

/** Anything whose job is to fall into the tonic: V, the tritone sub, the leading-tone diminished. */
const isDominantish = (c: Ctx, chord: Chord): boolean =>
  isFifthDominant(c, chord) ||
  (offsetOf(c, chord) === 1 && isDominantFamily(chord.quality.id)) ||
  (offsetOf(c, chord) === 11 && thirdSemis(chord) === 3 && toneAt(chord, 5)?.semitones === 6);

/** Out-of-key chord tones, each paired with the scale note it replaces. */
interface Alteration {
  pc: PitchClass;
  from: string;
  to: string;
  dir: 1 | -1;
  /** index of the replaced note in the key's scale */
  scaleIndex: number;
}

function alterations(c: Ctx, chord: Chord): Alteration[] {
  const out: Alteration[] = [];
  for (const t of tonesOf(chord)) {
    if (c.scalePcs.has(t.pc)) continue;
    let scaleIndex = c.scale.findIndex((n) => n.letter === t.name.letter);
    let diff = scaleIndex < 0 ? 0 : mod12(t.pc - notePc(c.scale[scaleIndex]));
    if (diff !== 1 && diff !== 11) {
      // enharmonic oddity (C♭ against a key with B): pair it with the neighbour it displaced
      const below = c.scale.findIndex((n) => notePc(n) === mod12(t.pc - 1));
      const above = c.scale.findIndex((n) => notePc(n) === mod12(t.pc + 1));
      scaleIndex = above >= 0 ? above : below;
      diff = above >= 0 ? 11 : 1;
    }
    if (scaleIndex < 0) continue;
    out.push({ pc: t.pc, from: nat(show(c.scale[scaleIndex])), to: nat(t.label), dir: diff === 1 ? 1 : -1, scaleIndex });
  }
  return out;
}

const DEGREE_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];

/** "the ♭6 of the key" / "the key's natural 4th". */
function degreePhrase(c: Ctx, pc: PitchClass, dir: 1 | -1): string {
  const off = mod12(pc - c.tonicPc);
  const name = off === 6 && dir < 0 ? '♭5' : DEGREE_NAMES[off];
  if (/[♯♭]/.test(name)) return `the ${name} of the key`;
  return `the key's natural ${ORDINAL[Number(name) - 1]}`;
}

/** What a note does when the chord it lives in goes home. */
function resolution(c: Ctx, chord: Chord, pc: PitchClass): string {
  const m = voiceMoves(chord, c.home).find((x) => x.fromPc === pc);
  if (!m) return 'has nowhere close to land, so it hangs over the key like weather';
  if (m.kind === 'hold') return 'is shared with the home chord, so it stays put while the color around it changes';
  const step = m.kind === 'half' ? 'a half step' : 'a whole step';
  return m.semitones < 0
    ? `${m.kind === 'half' ? 'sighs' : 'steps'} down ${step} to ${m.to} when you go home`
    : `pushes up ${step} to ${m.to} when you go home`;
}

/** "; from Am the root climbs a 4th to get there" — only for the two motions that read as lift. */
function liftClause(c: Ctx, chord: Chord): string {
  if (!c.prev || !hasMajorThird(chord)) return '';
  const up = mod12(notePc(chord.root) - notePc(c.prev.root));
  if (up === 5) return `; from ${chordSymbol(c.prev)} the root climbs a 4th to get there, the strongest lift there is`;
  if (up === 2) return `; from ${chordSymbol(c.prev)} the root steps up a whole step to reach it`;
  return '';
}

// --- settle -----------------------------------------------------------------

function homeWhy(c: Ctx, chord: Chord): string {
  const H = chordSymbol(chord);
  const p = c.prev;
  if (!p) return `${H} — ${spell(chord)} — is home: start here and every other chord gets heard as a distance from ${c.tonic}.`;
  const P = chordSymbol(p);
  const moves = voiceMoves(p, c.home);
  const halves = moves.filter((m) => m.kind === 'half');
  const holds = moves.filter((m) => m.kind === 'hold').map((m) => m.from);
  const stepping = moves.filter((m) => m.kind !== 'hold');
  if (isDominantish(c, p)) {
    return halves.length
      ? `${P} → ${H} is the full stop: ${pairs(halves)} close${halves.length === 1 ? 's' : ''} by half step and the tension is spent.`
      : `${P} → ${H} lets the dominant go: ${spell(chord)} lands and the question is answered.`;
  }
  const off = offsetOf(c, p);
  if (off === 5 && stepping.length) {
    return `${P} → ${H} is the plagal "Amen": ${pairs(stepping)} settle${stepping.length === 1 ? 's' : ''}${holds.length ? ` while ${listOf(holds)} hold${holds.length === 1 ? 's' : ''}` : ''} — rest without needing a leading tone.`;
  }
  if (off === 10 && hasMajorThird(p)) {
    return `${P} → ${H}: the bass steps up a whole step, ${show(p.root)} → ${c.tonic}, with no leading tone anywhere — home arrives with swagger instead of ceremony.`;
  }
  if (off === 1) {
    return `${P} → ${H}: the bass drops a half step, ${show(p.root)} → ${c.tonic} — the Phrygian way home, gravity instead of a leading tone.`;
  }
  return holds.length
    ? `${H} — ${spell(chord)} — is home, and ${listOf(holds)} ${holds.length === 1 ? 'is' : 'are'} already ringing inside ${P}, so it lands softly.`
    : `${H} — ${spell(chord)} — is home; every note of ${P} has to move to get there, so the arrival is clean and obvious.`;
}

const home = (c: Ctx): Cand => ({ numeral: c.palette[0].numeral, why: (ch) => homeWhy(c, ch) });

/** vi in major-ish modes, ♭III in minor-ish ones: two notes of home, one swapped. */
const relative = (c: Ctx, numeral: string): Cand => ({
  numeral,
  why: (ch) => {
    const kept = commonTones(ch, c.home).map((t) => t.label);
    const added = tonesOf(ch).filter((t) => !tonesOf(c.home).some((h) => h.pc === t.pc)).map((t) => t.label);
    const dropped = tonesOf(c.home).filter((h) => !tonesOf(ch).some((t) => t.pc === h.pc)).map((t) => t.label);
    const swap = added.length && dropped.length
      ? ` and swaps ${listOf(dropped)} for ${listOf(added)}`
      : added.length ? ` and adds ${listOf(added)}` : '';
    return hasMajorThird(ch)
      ? `${chordSymbol(ch)} — ${spell(ch)} — keeps ${listOf(kept)} from the home chord${swap}: the relative major, the same rest with more light in it.`
      : `${chordSymbol(ch)} — ${spell(ch)} — keeps ${listOf(kept)} from the home chord${swap}: the relative minor, the same rest with a shadow on it.`;
  },
});

/** iii / ♭VI: still tonic territory, but the home note itself is missing (or buried). */
const mediant = (c: Ctx, numeral: string): Cand => ({
  numeral,
  why: (ch) => {
    const kept = commonTones(ch, c.home).map((t) => t.label);
    const missing = tonesOf(c.home).filter((h) => !tonesOf(ch).some((t) => t.pc === h.pc)).map((t) => t.label);
    return `${chordSymbol(ch)} — ${spell(ch)} — shares ${listOf(kept)} with the home chord ${chordSymbol(c.home)}${missing.length ? ` but leaves out ${listOf(missing)}` : ''}, so it rests without quite arriving.`;
  },
});

/** IV / iv when you are not home yet: one soft step away. */
const plagal = (c: Ctx, numeral: string): Cand => ({
  numeral,
  why: (ch) => {
    const moves = voiceMoves(ch, c.home);
    const stepping = moves.filter((m) => m.kind !== 'hold');
    const holds = moves.filter((m) => m.kind === 'hold').map((m) => m.from);
    return `${chordSymbol(ch)} — ${spell(ch)} — is one soft step from home: ${pairs(stepping)}${holds.length ? ` while ${listOf(holds)} hold${holds.length === 1 ? 's' : ''}` : ''}, the "Amen" motion, no leading tone required.`;
  },
});

/** ♭VII as a resting place in Dorian: the modal neighbour, not a dominant. */
const subtonic = (c: Ctx, numeral: string): Cand => ({
  numeral,
  why: (ch) => {
    const leading = toneAt(resolveNumeral('V', c.key), 3);
    return `${chordSymbol(ch)} — ${spell(ch)} — sits a whole step under home, and its ${nat(show(ch.root))} never sharpens into the leading tone ${leading?.label}: it rocks back to ${chordSymbol(c.home)} instead of pushing, the modal way to rest.`;
  },
});

// --- tension ----------------------------------------------------------------

function dominant(c: Ctx): Cand {
  const entry = entryAt(c, 5);
  const native = !!entry && hasMajorThird(entry.chord);
  // Lydian's own V7 is a maj7 — no tritone in it — so its V stays a triad
  const numeral = !native ? 'V7' : c.sevenths && entry.seventhNumeral === 'V7' ? 'V7' : 'V';
  return {
    numeral, fixed: true,
    why: (ch) => {
      const X = chordSymbol(ch);
      const H = chordSymbol(c.home);
      const lt = toneAt(ch, 3);
      const sev = toneAt(ch, 7);
      const homeThird = toneAt(c.home, 3);
      if (!lt) return `${X} — ${spell(ch)} — is the dominant: it leans on ${H} until ${H} arrives.`;
      const fall = sev && homeThird && mod12(sev.pc - homeThird.pc) === 1 ? 'a half step' : 'a whole step';
      if (c.scalePcs.has(lt.pc)) {
        return sev
          ? `${X} — ${spell(ch)} — holds ${lt.label}, the leading tone a half step under ${c.tonic}, and ${sev.label}, which leans ${fall} down onto ${homeThird?.label}: that ${lt.label}–${sev.label} tritone only relaxes when ${H} arrives.`
          : `${X} — ${spell(ch)} — holds ${lt.label}, the leading tone a half step under ${c.tonic}: it only relaxes when ${H} arrives.`;
      }
      const own = nat(show(c.scale[6]));
      return `${X} — ${spell(ch)} — borrows ${lt.label}, raised from the key's ${own}, because a leading tone a half step under ${c.tonic} pulls far harder than ${own} can${sev ? `; ${sev.label} on top leans ${fall} down onto ${homeThird?.label}` : ''}.`;
    },
  };
}

function secondary(c: Ctx, target: PaletteEntry): Cand | undefined {
  if (!isPlainTriad(target.chord) || offsetOf(c, target.chord) === 0) return undefined;
  const numeral = secondaryDominantOf(target.numeral);
  // a "secondary dominant" made only of key notes adds no new pull — it's just a chord of the key
  if (inKey(c, resolveNumeral(numeral, c.key))) return undefined;
  return {
    numeral, fixed: true,
    why: (ch) => {
      const X = chordSymbol(ch);
      const T = chordSymbol(target.chord);
      const lt = toneAt(ch, 3);
      const climbs = c.prev && mod12(notePc(ch.root) - notePc(c.prev.root)) === 5
        ? `; from ${chordSymbol(c.prev)} the root climbs a 4th to reach it` : '';
      if (lt && !c.scalePcs.has(lt.pc)) {
        return `${X} — ${spell(ch)} — is ${T}'s own private dominant: its 3rd, ${lt.label}, isn't in the key — it's a leading tone planted a half step under ${show(target.chord.root)}, so the ear now expects ${T}${climbs}.`;
      }
      const out = alterations(c, ch).map((a) => a.to);
      return `${X} — ${spell(ch)} — is ${T}'s own private dominant: ${listOf(out)} bends the key so that ${lt?.label} and ${toneAt(ch, 7)?.label} can squeeze toward ${T}${climbs}.`;
    },
  };
}

/** The dominant-ized version of where `prev` was heading anyway: vi → II7 (→ V), iii → VI7 (→ ii). */
function contextSecondary(c: Ctx): Cand | undefined {
  if (!c.prev) return undefined;
  const targetPc = mod12(notePc(c.prev.root) + 10);
  const target = c.palette.find((e) => notePc(e.chord.root) === targetPc);
  return target ? secondary(c, target) : undefined;
}

function suspended(c: Ctx): Cand {
  // Lydian has no ♮4 to put in a V7sus4's 7th, so its sus stays a triad
  const numeral = c.key.mode === 'lydian' ? 'Vsus4' : 'V7sus4';
  return {
    numeral, fixed: true,
    why: (ch) => {
      const fourth = toneAt(ch, 4);
      const leading = toneAt(resolveNumeral('V', c.key), 3);
      const carried = c.prev ? commonTones(ch, c.prev).map((t) => t.label) : [];
      const carry = c.prev && carried.length >= 2 ? `; ${listOf(carried)} carry straight over from ${chordSymbol(c.prev)}` : '';
      return `${chordSymbol(ch)} — ${spell(ch)} — is the dominant with ${fourth?.label}, the home note itself, sitting where the leading tone ${leading?.label} belongs: the pull is there, but the edge stays sanded off until ${fourth?.label} falls to ${leading?.label}${carry}.`;
    },
  };
}

const LEADING_DIM: Record<ModeId, string> = {
  major: 'viio', lydian: '#ivo', mixolydian: 'iiio',
  minor: 'viio7/i', dorian: 'viio7/i', phrygian: 'viio7/i',
};

function diminished(c: Ctx, numeral: string, dark = false): Cand {
  return {
    numeral,
    why: (ch) => {
      const X = chordSymbol(ch);
      const root = toneAt(ch, 1);
      const fifth = toneAt(ch, 5);
      if (dark) {
        return `${X} — ${spell(ch)} — is the key's own diminished chord: the tritone ${root?.label}–${fifth?.label} with nothing warm around it, the darkest corner of ${keyLabel(c.key)}.`;
      }
      const upPc = mod12(notePc(ch.root) + 1);
      const goal = upPc === c.tonicPc ? c.home : c.palette.find((e) => notePc(e.chord.root) === upPc)?.chord;
      const into = goal && chordSymbol(goal) !== show(goal.root) ? `into ${chordSymbol(goal)}` : 'there';
      const goalText = goal
        ? `${root?.label} sits a half step under ${show(goal.root)}${upPc === c.tonicPc ? ', home itself,' : ''} and wants to climb ${into}`
        : `${root?.label} wants to climb a half step`;
      const stack = ch.quality.id === 'dim7'
        ? `is nothing but minor 3rds, two tritones locked together (${root?.label}–${fifth?.label} is one)`
        : `is built on the tritone ${root?.label}–${fifth?.label}`;
      return `${X} — ${spell(ch)} — ${stack}; ${goalText}.`;
    },
  };
}

function tritoneSub(c: Ctx): Cand {
  return {
    numeral: 'bII7', fixed: true,
    why: (ch) => {
      const v7 = resolveNumeral('V7', c.key);
      const third = toneAt(ch, 3);
      const sev = toneAt(ch, 7);
      const lt = toneAt(v7, 3);
      const disguise = sev && lt && sev.label !== lt.label ? `, which is ${chordSymbol(v7)}'s ${lt.label} in disguise` : '';
      const slide = c.prev && offsetOf(c, c.prev) === 2
        ? `; from ${chordSymbol(c.prev)} the bass just keeps sliding, ${show(c.prev.root)} → ${show(ch.root)} → ${c.tonic}` : '';
      return `${chordSymbol(ch)} — ${spell(ch)} — hides the same tritone as ${chordSymbol(v7)} (${third?.label} and ${sev?.label}${disguise}) over a bass that slides a half step down into ${c.tonic} instead of leaping a 4th${slide}.`;
    },
  };
}

/** ♭II: the Phrygian cadence chord when the mode owns it, the Neapolitan when it doesn't. */
function neapolitan(c: Ctx): Cand {
  return {
    numeral: 'bII',
    why: (ch) => {
      const falls = voiceMoves(ch, c.home).filter((m) => m.kind === 'half' && m.semitones < 0);
      const tail = inKey(c, ch)
        ? 'the Phrygian cadence — no leading tone, just gravity'
        : 'the Neapolitan — a Phrygian shadow the key does not own';
      const motion = falls.length
        ? `so ${pairs(falls)} ${falls.length === 1 ? 'falls' : falls.length === 2 ? 'both fall' : 'all fall'} by half step when it resolves`
        : `so ${show(ch.root)} → ${c.tonic} falls by half step when it resolves`;
      return `${chordSymbol(ch)} — ${spell(ch)} — sits a half step above home, ${motion}: ${tail}.`;
    },
  };
}

function tensionList(c: Ctx): (Cand | undefined)[] {
  const dim = diminished(c, LEADING_DIM[c.key.mode]);
  const sus = suspended(c);
  const phrygian = c.key.mode === 'phrygian';
  const sub = phrygian ? undefined : tritoneSub(c);
  const prevOff = c.prev ? offsetOf(c, c.prev) : -1;
  // the third seat goes to whichever variant the previous chord sets up best
  const third = prevOff === 2 ? [sub, dim, sus] : prevOff === 5 ? [sus, dim, sub] : [dim, sus, sub];
  const fallbackDegrees = isMinorish(c.key.mode) ? [4, 6, 3, 7, 5] : [6, 2, 5, 4, 3];
  const fallbacks = fallbackDegrees.map((d) => {
    const entry = entryAt(c, d);
    return entry ? secondary(c, entry) : undefined;
  });
  return [phrygian ? neapolitan(c) : undefined, dominant(c), contextSecondary(c), ...third, ...fallbacks];
}

// --- brighten / darken ------------------------------------------------------

/** The note that makes each mode itself. */
const CHARACTER: Partial<Record<ModeId, { index: number; what: string; means: string }>> = {
  dorian: { index: 5, what: 'the natural 6th', means: 'the one note that separates Dorian from plain minor' },
  lydian: { index: 3, what: 'the ♯4', means: 'the note that makes Lydian float' },
  mixolydian: { index: 6, what: 'the ♭7', means: 'the note that makes Mixolydian swagger' },
  phrygian: { index: 1, what: 'the ♭2', means: 'the note that makes Phrygian loom' },
};

const BRIGHT_TAILS: Record<string, (c: Ctx) => string> = {
  IV: () => " — Dorian's hopeful lift dropped into the key",
  II: (c) => ` — the Lydian glow, and it leans toward ${chordSymbol(resolveNumeral('V', c.key))} a 4th above it`,
  I: () => ' — the Picardy third: the same home with the lights on',
  bVII: () => ', on a major chord a whole step under home',
};

/** A chord that raises notes of the key (or, failing that, simply is a major chord in the right place). */
function bright(c: Ctx, numeral: string): Cand {
  return {
    numeral,
    why: (ch) => {
      const X = chordSymbol(ch);
      const lift = liftClause(c, ch);
      const raised = alterations(c, ch).filter((a) => a.dir > 0);
      if (raised.length) {
        const which = listOf(raised.map((a) => ORDINAL[a.scaleIndex]));
        const tail = BRIGHT_TAILS[numeral]?.(c) ?? ' — a major chord where the key expected something plainer';
        return `${X} — ${spell(ch)} — swaps ${listOf(raised.map((a) => a.from))} for ${listOf(raised.map((a) => a.to))}, the key's ${which} raised a half step${tail}${lift}.`;
      }
      const lowered = alterations(c, ch);
      if (lowered.length) {
        // ♭VII in a major key: technically a lowered note, but it lands as a lift
        return `${X} — ${spell(ch)} — is a major chord the key doesn't own (${listOf(lowered.map((a) => a.to))} in place of ${listOf(lowered.map((a) => a.from))}), and every road out of it climbs: ${show(ch.root)} → ${c.tonic} steps up a whole step into home, the rock & roll back door${lift}.`;
      }
      const character = CHARACTER[c.key.mode];
      const charNote = character ? c.scale[character.index] : undefined;
      const charTone = charNote && tonesOf(ch).find((t) => t.pc === notePc(charNote));
      if (character && charTone && c.key.mode !== 'mixolydian' && c.key.mode !== 'phrygian') {
        const where = hasMajorThird(ch)
          ? `, here on a major chord a ${offsetOf(c, ch) === 5 ? '4th' : 'whole step'} above home`
          : '';
        return `${X} — ${spell(ch)} — carries ${charTone.label}, ${character.what}: ${character.means}${where}${lift}.`;
      }
      const off = offsetOf(c, ch);
      if (off === 10) {
        const relMajor = c.palette.find((e) => offsetOf(c, e.chord) === 3 && hasMajorThird(e.chord));
        return relMajor
          ? `${X} — ${spell(ch)} — is the brightest stop in the key: a major chord a whole step under home, and the dominant of the relative major ${chordSymbol(relMajor.chord)}${lift}.`
          : `${X} — ${spell(ch)} — is a major chord a whole step under home; stepping back up, ${show(ch.root)} → ${c.tonic}, is the lift rock bands live on${lift}.`;
      }
      if (off === 5) return `${X} — ${spell(ch)} — is a major chord a 4th above home: no tension added, just distance, like opening a window${lift}.`;
      return `${X} — ${spell(ch)} — is one of the key's own major chords: the same notes as ${keyLabel(c.key)}, heard from the sunny side${lift}.`;
    },
  };
}

/** A chord that lowers notes of the key — or, when it is diatonic, leans on the key's darkest degree. */
function dark(c: Ctx, numeral: string): Cand {
  return {
    numeral,
    why: (ch) => {
      const X = chordSymbol(ch);
      const lowered = alterations(c, ch).filter((a) => a.dir < 0);
      if (lowered.length) {
        const sighs = voiceMoves(ch, c.home).filter((m) => m.kind === 'half');
        const focus = lowered.find((a) => sighs.some((m) => m.fromPc === a.pc)) ?? lowered[0];
        return `${X} — ${spell(ch)} — swaps ${listOf(lowered.map((a) => a.from))} for ${listOf(lowered.map((a) => a.to))}: ${focus.to}, ${degreePhrase(c, focus.pc, -1)}, ${resolution(c, ch, focus.pc)}.`;
      }
      // diatonic: point at the flattest degree inside the chord
      const rank = [1, 8, 6, 3, 10];
      const tones = tonesOf(ch);
      const off = rank.find((r) => tones.some((t) => mod12(t.pc - c.tonicPc) === r));
      const tone = tones.find((t) => mod12(t.pc - c.tonicPc) === off);
      if (!tone) return `${X} — ${spell(ch)} — sits on the shadow side of ${keyLabel(c.key)}.`;
      return `${X} — ${spell(ch)} — leans on ${tone.label}, ${degreePhrase(c, tone.pc, -1)}, which ${resolution(c, ch, tone.pc)}.`;
    },
  };
}

/** Minor v: the dominant with its leading tone filed off. */
function minorFive(c: Ctx): Cand {
  return {
    numeral: 'v',
    why: (ch) => {
      const real = resolveNumeral('V', c.key);
      return `${chordSymbol(ch)} — ${spell(ch)} — has ${nat(toneAt(ch, 3)?.label ?? '')} where the true dominant ${chordSymbol(real)} has ${nat(toneAt(real, 3)?.label ?? '')}: no leading tone, so it drifts toward ${chordSymbol(c.home)} instead of pulling.`;
    },
  };
}

const SETTLE: Record<ModeId, (c: Ctx) => Cand[]> = {
  major: (c) => [home(c), relative(c, 'vi'), mediant(c, 'iii'), plagal(c, 'IV')],
  lydian: (c) => [home(c), relative(c, 'vi'), mediant(c, 'iii')],
  mixolydian: (c) => [home(c), relative(c, 'vi'), plagal(c, 'IV')],
  minor: (c) => [home(c), relative(c, 'bIII'), mediant(c, 'bVI'), plagal(c, 'iv')],
  dorian: (c) => [home(c), relative(c, 'bIII'), subtonic(c, 'bVII')],
  phrygian: (c) => [home(c), relative(c, 'bIII'), mediant(c, 'bVI'), plagal(c, 'iv')],
};

/** [idiomatic brighteners, spares] */
const BRIGHTEN: Record<ModeId, [string[], string[]]> = {
  major: [['II', 'bVII', 'IV'], ['VI', 'III']],
  lydian: [['II', 'vii'], ['VI', 'III']],
  mixolydian: [['bVII', 'IV', 'II'], ['VI']],
  minor: [['IV', 'bVII', 'I'], ['bIII', 'bVI']],
  dorian: [['IV', 'ii', 'I'], ['bVII', 'bIII']],
  phrygian: [['IV', 'bVII', 'I'], ['bIII', 'bVI']],
};

const DARKEN: Record<ModeId, (c: Ctx) => Cand[]> = {
  major: (c) => [dark(c, 'iv'), dark(c, 'bVI'), dark(c, 'bIII'), minorFive(c), dark(c, 'i')],
  lydian: (c) => [dark(c, 'IV'), dark(c, 'iv'), dark(c, 'bVII'), dark(c, 'bVI'), dark(c, 'bIII')],
  mixolydian: (c) => [minorFive(c), dark(c, 'iv'), dark(c, 'bVI'), dark(c, 'bIII'), dark(c, 'i')],
  minor: (c) => [minorFive(c), diminished(c, 'iio', true), dark(c, 'iv'), dark(c, 'bvii'), dark(c, 'bVI')],
  dorian: (c) => [dark(c, 'iv'), dark(c, 'bVI'), minorFive(c), diminished(c, 'vio', true)],
  phrygian: (c) => [dark(c, 'bvii'), diminished(c, 'vo', true), dark(c, 'iv'), dark(c, 'bVI'), dark(c, 'bIII')],
};

// --- surprise ---------------------------------------------------------------

/** Where V was NOT supposed to go: vi in major-ish modes, ♭VI in minor-ish ones. */
const deceptiveNumeral = (c: Ctx): string => (isMinorish(c.key.mode) ? 'bVI' : 'vi');

function deceptive(c: Ctx): Cand | undefined {
  const p = c.prev;
  if (!p || !isFifthDominant(c, p)) return undefined;
  return {
    numeral: deceptiveNumeral(c),
    why: (ch) => {
      const kept = commonTones(ch, c.home).map((t) => t.label);
      return `${chordSymbol(p)} promised ${chordSymbol(c.home)}; ${chordSymbol(ch)} — ${spell(ch)} — keeps ${listOf(kept)} from the home chord but puts ${show(ch.root)} in the bass instead: the deceptive cadence, a plot twist rather than a wrong turn.`;
    },
  };
}

const CONVENTIONAL = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const isWhiteKey = (pc: PitchClass): boolean => MAJOR_SEMIS.includes(pc);

/**
 * How awkward a spelled chord is to read next to `ref`: accidentals, extra for
 * E♯/C♭-style white keys in costume, and more for renaming a note `ref` holds
 * (C♯ in F♯m turning into D♭).
 */
function spellingCost(chord: Chord, ref: Chord): number {
  const held = chordTones(ref);
  return chordTones(chord).reduce((sum, n) => {
    const twin = held.find((h) => notePc(h) === notePc(n));
    return sum + Math.abs(n.alter) + (n.alter !== 0 && isWhiteKey(notePc(n)) ? 1 : 0) + (twin && twin.letter !== n.letter ? 2 : 0);
  }, 0);
}

/**
 * Numeral for a major/minor triad `offset` semitones above the tonic. Uses the
 * conventional name (♭VI, not ♯V) unless another spelling is much easier to read
 * in this key — A♯–C𝄪–E♯ in F♯ becomes ♭IV: B♭–D–F.
 */
function numeralAtOffset(c: Ctx, ref: Chord, offset: number, lower: boolean): string {
  const cased = (s: string): string => (lower ? s.toLowerCase() : s);
  const conventional = cased(CONVENTIONAL[offset]);
  let best = conventional;
  let bestCost = spellingCost(resolveNumeral(conventional, c.key), ref);
  for (let d = 0; d < 7; d++) {
    for (const acc of [-1, 0, 1]) {
      if (mod12(MAJOR_SEMIS[d] + acc) !== offset) continue;
      if (d === 0 && acc === -1) continue; // "♭I" helps nobody
      const numeral = (acc === -1 ? 'b' : acc === 1 ? '#' : '') + cased(ROMANS[d]);
      if (numeral === conventional) continue;
      const cost = spellingCost(resolveNumeral(numeral, c.key), ref);
      if (cost <= bestCost - 3) { best = numeral; bestCost = cost; }
    }
  }
  return best;
}

/** The chord chromatic moves are measured from: `prev` when it is a clean triad shape, else home. */
const surpriseRef = (c: Ctx): Chord => {
  const p = c.prev;
  return p && thirdSemis(p) !== undefined && toneAt(p, 5)?.semitones === 7 ? p : c.home;
};

function chromaticMediant(c: Ctx, ref: Chord, up: number): Cand | undefined {
  const lower = !hasMajorThird(ref);
  const numeral = numeralAtOffset(c, ref, mod12(offsetOf(c, ref) + up), lower);
  if (inKey(c, resolveNumeral(numeral, c.key))) return undefined; // diatonic thirds are relatives, not surprises
  return {
    numeral,
    why: (ch) => {
      const moves = voiceMoves(ref, ch);
      const held = moves.filter((m) => m.kind === 'hold').map((m) => m.from);
      const halves = moves.filter((m) => m.kind === 'half');
      const size = up === 3 || up === 9 ? 'minor 3rd' : 'major 3rd';
      const pinned = held.length ? `, pinned together by ${listOf(held)}` : '';
      const slide = halves.length ? ` while ${pairs(halves)} slide${halves.length === 1 ? 's' : ''} by half step` : '';
      return `${chordSymbol(ch)} — ${spell(ch)} — is a chromatic mediant of ${chordSymbol(ref)}: two ${lower ? 'minor' : 'major'} chords a ${size} apart${pinned}${slide} — it doesn't resolve anything, it changes the weather.`;
    },
  };
}

function tritoneAway(c: Ctx, ref: Chord): Cand {
  return {
    spare: true,
    numeral: numeralAtOffset(c, ref, mod12(offsetOf(c, ref) + 6), !hasMajorThird(ref)),
    why: (ch) =>
      `${chordSymbol(ch)} — ${spell(ch)} — sits a tritone from ${chordSymbol(ref)}, ${show(ref.root)} to ${show(ch.root)}, as far apart as two roots can get and without a single shared note: a jump cut, not a transition.`,
  };
}

function surpriseList(c: Ctx): (Cand | undefined)[] {
  const ref = surpriseRef(c);
  const [first, ...rest] = [4, 8, 9, 3].map((up) => chromaticMediant(c, ref, up));
  // when `prev` is already far from the key its own mediants can all be taken — measure from home instead
  const fromHome = ref === c.home ? [] : [4, 8, 9, 3].map((up) => spare(chromaticMediant(c, c.home, up)));
  return [deceptive(c), first, neapolitan(c), ...rest, ...fromHome, tritoneAway(c, ref), tritoneAway(c, c.home)];
}

// --- assembly ---------------------------------------------------------------

function candidatesFor(intent: Intent, c: Ctx): (Cand | undefined)[] {
  switch (intent) {
    case 'settle': return SETTLE[c.key.mode](c);
    case 'tension': return tensionList(c);
    case 'brighten': {
      const [core, spares] = BRIGHTEN[c.key.mode];
      return [...core.map((n) => bright(c, n)), ...spares.map((n) => spare(bright(c, n)))];
    }
    case 'darken': return DARKEN[c.key.mode](c);
    case 'surprise': return surpriseList(c);
  }
}

/**
 * Continuations after `prev` (a numeral already in the progression, or
 * undefined for an empty start), grouped by what they DO. Two or three per
 * intent, never `prev` itself, and no chord offered twice.
 */
export function nextChordOptions(prev: string | undefined, key: Key, opts: { sevenths?: boolean } = {}): NextOption[] {
  const palette = diatonicPalette(key);
  const scale = keyScale(key);
  const c: Ctx = {
    key, palette, scale,
    tonicPc: notePc(key.tonic),
    tonic: show(key.tonic),
    scalePcs: new Set(scale.map(notePc)),
    home: palette[0].chord,
    prev: prev === undefined ? undefined : resolveNumeral(prev, key),
    sevenths: !!opts.sevenths,
  };
  const prevId = c.prev && triadId(c.prev);
  // after a dominant, the deceptive target belongs to "surprise" and nowhere else
  const reserved = c.prev && isFifthDominant(c, c.prev)
    ? triadId(resolveNumeral(deceptiveNumeral(c), key)) : undefined;

  const out: NextOption[] = [];
  const used = new Set<string>();
  for (const { id: intent } of INTENTS) {
    let picked = 0;
    for (const cand of candidatesFor(intent, c)) {
      if (picked >= PER_INTENT) break;
      if (!cand || (cand.spare && picked >= MIN_PER_INTENT)) continue;
      const entry = c.sevenths && !cand.fixed ? palette.find((e) => e.numeral === cand.numeral) : undefined;
      const chord = resolveNumeral(entry ? entry.seventhNumeral : cand.numeral, key);
      const id = identity(chord);
      if (triadId(chord) === prevId || used.has(id)) continue;
      if (triadId(chord) === reserved && intent !== 'surprise') continue;
      used.add(id);
      out.push({ numeral: chord.numeral, chord, intent, why: cand.why(chord) });
      picked++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Chords under an existing melody

export interface WeightedPc {
  pc: PitchClass;
  /** importance: duration in beats, ×2 if it falls on a strong beat */
  weight: number;
}

export type HarmonyFlavor = 'simple' | 'sus' | 'rich' | 'borrowed';

export interface HarmonyOption {
  numeral: string;
  chord: Chord;
  flavor: HarmonyFlavor;
  /** 0..1 — how well the chord supports these melody notes */
  fit: number;
  /** how each important melody note functions in this chord, e.g. "A is the 3rd, C the 5th; E floats above as the 7th" */
  why: string;
}

const FLAVOR_ORDER: HarmonyFlavor[] = ['simple', 'sus', 'rich', 'borrowed'];
/** tie-break between equally good chords: primary chords first */
const DEGREE_RANK = [1, 4, 5, 6, 2, 3, 7];
const VIABLE = 0.4;

const SCORE = { tone: 1, tension: 0.35, avoid: -1, other: -0.25 } as const;
type NoteRole = keyof typeof SCORE;

/** How one melody pitch class sits against a chord. */
function roleOf(chord: Chord, tones: Tone[], pc: PitchClass): { role: NoteRole; against?: Tone } {
  const hit = tones.find((t) => t.pc === pc);
  if (hit) return { role: 'tone', against: hit };
  const below = tones.find((t) => mod12(t.pc + 1) === pc);
  // the ♭9 over a dominant is the one half-step-above that is a color, not a collision
  const flatNine = below && below.degree === 1 && isDominantFamily(chord.quality.id);
  if (below && !flatNine) return { role: 'avoid', against: below };
  if (flatNine) return { role: 'other' };
  if (tones.some((t) => mod12(t.pc + 2) === pc)) return { role: 'tension' };
  const interval = mod12(pc - notePc(chord.root));
  if (interval === 2 || interval === 9 || (interval === 5 && thirdSemis(chord) === 3)) return { role: 'tension' };
  return { role: 'other' };
}

function toneName(t: Tone): string {
  switch (t.degree) {
    case 1: return 'root';
    case 2: return 'sus 2nd';
    case 4: return 'sus 4th';
    case 5: return t.semitones === 6 ? '♭5' : t.semitones === 8 ? '♯5' : '5th';
    case 9: return t.semitones === 13 ? '♭9' : t.semitones === 15 ? '♯9' : '9th';
    case 11: return t.semitones === 18 ? '♯11' : '11th';
    case 3: return '3rd';
    default: return `${t.degree}th`;
  }
}

const INTERVAL_NAMES = ['root', '♭9', '9th', '♯9', 'major 3rd', '11th', '♯11', '5th', '♭13', '13th', '♭7', 'major 7th'];
const INTERVAL_LETTERS = [0, 1, 1, 1, 2, 3, 3, 4, 5, 5, 6, 6];

/** Name a non-chord melody note: the key's spelling when it has one, else spelled from the chord root. */
function outsideLabel(chord: Chord, scale: NoteName[], pc: PitchClass): string {
  const own = scale.find((n) => notePc(n) === pc);
  if (own) return show(own);
  const interval = mod12(pc - notePc(chord.root));
  const steps = interval === 3 && !hasMajorThird(chord) ? 2 : INTERVAL_LETTERS[interval];
  const letter = LETTERS[mod7(letterIndex(chord.root.letter) + steps)];
  return show(spellWithLetter(letter, pc));
}

/** "♯9" over a major 3rd (the blue note), "♭3" when the chord has no 3rd of its own (sus, power). */
const outsideName = (chord: Chord, interval: number): string =>
  interval === 3 && !hasMajorThird(chord) ? '♭3' : INTERVAL_NAMES[interval];

function harmonyWhy(chord: Chord, scale: NoteName[], notes: PitchClass[], hook?: string): string {
  const tones = tonesOf(chord);
  const inside: string[] = [];
  const floating: { label: string; name: string }[] = [];
  const clashes: string[] = [];
  const outside: string[] = [];
  for (const pc of notes) {
    const { role, against } = roleOf(chord, tones, pc);
    const interval = outsideName(chord, mod12(pc - notePc(chord.root)));
    if (role === 'tone' && against) {
      inside.push(`${against.label} ${inside.length ? '' : 'is '}the ${toneName(against)}`);
    }
    else if (role === 'tension') floating.push({ label: outsideLabel(chord, scale, pc), name: interval });
    else if (role === 'avoid' && against) {
      clashes.push(`${outsideLabel(chord, scale, pc)} grinds a half step above ${against.label}, the ${toneName(against)} — the avoid note`);
    }
    else outside.push(`${outsideLabel(chord, scale, pc)} sits outside the chord as the ${interval}`);
  }
  const parts: string[] = [];
  if (inside.length) parts.push(inside.join(', '));
  if (floating.length === 1) parts.push(`${floating[0].label} floats above as the ${floating[0].name}`);
  if (floating.length > 1) {
    parts.push(`${listOf(floating.map((f) => f.label))} float above as the ${listOf(floating.map((f) => f.name))}`);
  }
  parts.push(...clashes, ...outside);
  return `${parts.join('; ')}${hook ? ` (borrowed: ${hook})` : ''}.`;
}

interface HarmonyCand {
  numeral: string;
  chord: Chord;
  flavor: HarmonyFlavor;
  hook?: string;
}

function harmonyCandidates(key: Key, palette: PaletteEntry[]): HarmonyCand[] {
  const scalePcs = new Set(keyScale(key).map(notePc));
  const diatonic = (chord: Chord): boolean => tonesOf(chord).every((t) => scalePcs.has(t.pc));
  const out: HarmonyCand[] = [];
  const seen = new Set<string>();
  const add = (numeral: string, flavor: HarmonyFlavor, opts: { mustBeDiatonic?: boolean; hook?: string } = {}) => {
    const chord = resolveNumeral(numeral, key);
    const id = `${notePc(chord.root)}|${chord.quality.id}`;
    if (seen.has(id) || (opts.mustBeDiatonic && !diatonic(chord))) return;
    seen.add(id);
    out.push({ numeral: chord.numeral, chord, flavor, hook: opts.hook });
  };
  const at = (degree: number): PaletteEntry | undefined =>
    palette.find((e) => parseNumeralParts(e.numeral).degree === degree);
  const usable = (e: PaletteEntry | undefined): e is PaletteEntry => !!e && isPlainTriad(e.chord);

  for (const e of palette) add(e.numeral, 'simple');

  // I, IV, V — or, where the mode puts a diminished chord there, its stand-in (II in Lydian, ♭vii in Phrygian)
  const primaries = [at(1), usable(at(4)) ? at(4) : at(2), usable(at(5)) ? at(5) : at(7)].filter(usable);
  for (const e of primaries) {
    add(withSuffix(e.numeral, 'sus2'), 'sus', { mustBeDiatonic: true });
    add(withSuffix(e.numeral, 'sus4'), 'sus', { mustBeDiatonic: true });
  }

  for (const e of palette) add(e.seventhNumeral, 'rich');
  for (const e of primaries.slice(0, 2)) {
    // add9 only exists as a major chord here; minor chords get their 9th the m9 way
    add(withSuffix(e.numeral, hasMajorThird(e.chord) ? 'add9' : '9'), 'rich', { mustBeDiatonic: true });
  }

  for (const s of borrowShelf(key)) add(s.numeral, 'borrowed', { hook: s.hook });
  return out;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Chords that could sit under a melody fragment, best fit first, with at least
 * one of each flavor (simple / sus / rich / borrowed) whenever that flavor has
 * a chord that genuinely supports the notes.
 */
export function harmonizeOptions(melody: WeightedPc[], key: Key, opts: { limit?: number } = {}): HarmonyOption[] {
  const limit = Math.max(1, opts.limit ?? 8);
  const palette = diatonicPalette(key);
  const scale = keyScale(key);

  const weights = new Map<PitchClass, number>();
  for (const m of melody) {
    if (!Number.isFinite(m.weight) || m.weight <= 0 || !Number.isFinite(m.pc)) continue;
    const pc = mod12(Math.round(m.pc));
    weights.set(pc, (weights.get(pc) ?? 0) + m.weight);
  }
  if (!weights.size) {
    return palette.slice(0, limit).map((e) => ({
      numeral: e.chord.numeral, chord: e.chord, flavor: 'simple' as const, fit: 0.5,
      why: `There is no melody here yet — ${chordSymbol(e.chord)} (${spell(e.chord)}) belongs to ${keyLabel(key)}, so it will sit under whatever you write next.`,
    }));
  }

  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, w]) => sum + w, 0);
  const heaviest = ranked[0][0];
  const spoken = ranked.slice(0, 4).map(([pc]) => pc);

  const scored = harmonyCandidates(key, palette).map((cand) => {
    const tones = tonesOf(cand.chord);
    let sum = 0;
    for (const [pc, w] of ranked) sum += w * SCORE[roleOf(cand.chord, tones, pc).role];
    const anchor = tones.find((t) => t.pc === heaviest);
    const bonus = anchor && (anchor.degree === 1 || anchor.degree === 3 || anchor.degree === 5) ? 0.05 : 0;
    const score = sum / total + bonus;
    const fit = round3(Math.min(1, Math.max(0, score)));
    return { cand, score, fit };
  });

  const degreeRank = (ch: Chord): number => DEGREE_RANK.indexOf(parseNumeralParts(ch.numeral).degree);
  scored.sort((a, b) =>
    b.score - a.score ||
    FLAVOR_ORDER.indexOf(a.cand.flavor) - FLAVOR_ORDER.indexOf(b.cand.flavor) ||
    degreeRank(a.cand.chord) - degreeRank(b.cand.chord) ||
    a.cand.chord.quality.tones.length - b.cand.chord.quality.tones.length);

  // best `limit`, then trade the weakest surplus pick for the best of any viable flavor still missing
  const chosen = scored.slice(0, limit);
  for (const flavor of FLAVOR_ORDER) {
    if (chosen.some((s) => s.cand.flavor === flavor)) continue;
    const best = scored.find((s) => s.cand.flavor === flavor && s.fit >= VIABLE);
    if (!best) continue;
    for (let i = chosen.length - 1; i >= 0; i--) {
      if (chosen.filter((s) => s.cand.flavor === chosen[i].cand.flavor).length > 1) {
        chosen.splice(i, 1);
        chosen.push(best);
        break;
      }
    }
  }
  chosen.sort((a, b) => scored.indexOf(a) - scored.indexOf(b));

  return chosen.map(({ cand, fit }) => ({
    numeral: cand.numeral,
    chord: cand.chord,
    flavor: cand.flavor,
    fit,
    why: harmonyWhy(cand.chord, scale, spoken, cand.hook),
  }));
}
