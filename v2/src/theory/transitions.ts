// The space between two chords. For any change it works out which notes hold,
// which slide by a half or whole step, what the bass does, and what the move
// means — cadence, vamp, blues logic or borrowed color — so the gap between
// two cards can explain itself and be heard one voice at a time.

import { PitchClass, mod12, noteLabel, notePc, simplify } from './notes';
import { Key } from './scales';
import { Chord, chordSymbol, chordTones, isDominantFamily } from './chords';
import { parseNumeralParts } from './roman';

export type MoveKind = 'hold' | 'half' | 'whole';

export interface VoiceMove {
  kind: MoveKind;
  from: string;
  to: string;
  fromPc: PitchClass;
  toPc: PitchClass;
  /** signed semitones: negative = falls */
  semitones: number;
}

export interface ToneLabel {
  pc: PitchClass;
  label: string;
}

export interface TransitionInsight {
  from: Chord;
  to: Chord;
  title: string;
  fromTones: ToneLabel[];
  toTones: ToneLabel[];
  /** holds and stepwise moves; tones that must leap are left out */
  moves: VoiceMove[];
  bass: string;
  story: string;
  tryThis: string;
}

export interface TransitionContext {
  key: Key;
  /** how many different chords the whole progression uses */
  distinctChords: number;
  /** true for the seam from the last chord back to the first */
  wrap?: boolean;
}

const tonesOf = (chord: Chord): ToneLabel[] => {
  const seen = new Set<PitchClass>();
  const out: ToneLabel[] = [];
  for (const n of chordTones(chord)) {
    const pc = notePc(n);
    if (seen.has(pc)) continue;
    seen.add(pc);
    out.push({ pc, label: noteLabel(simplify(n)) });
  }
  return out;
};

/** Which voices hold, and which can get to the next chord by step. */
export function voiceMoves(from: Chord, to: Chord): VoiceMove[] {
  const a = tonesOf(from);
  const b = tonesOf(to);
  const moves: VoiceMove[] = [];
  const covered = new Set<PitchClass>();
  const settled = new Set<PitchClass>();
  const add = (f: ToneLabel, t: ToneLabel, semitones: number, kind: MoveKind) => {
    moves.push({ kind, from: f.label, to: t.label, fromPc: f.pc, toPc: t.pc, semitones });
    covered.add(t.pc);
    settled.add(f.pc);
  };
  for (const f of a) {
    const same = b.find((t) => t.pc === f.pc);
    if (same) add(f, same, 0, 'hold');
  }
  for (const f of a) {
    if (settled.has(f.pc)) continue;
    for (const dir of [-1, 1]) {
      const t = b.find((x) => x.pc === mod12(f.pc + dir));
      if (t) add(f, t, dir, 'half');
    }
  }
  for (const f of a) {
    if (settled.has(f.pc)) continue;
    const options = [-2, 2]
      .map((d) => ({ d, t: b.find((x) => x.pc === mod12(f.pc + d)) }))
      .filter((o): o is { d: number; t: ToneLabel } => !!o.t);
    if (!options.length) continue;
    const pick = options.find((o) => !covered.has(o.t.pc)) ?? options[0];
    add(f, pick.t, pick.d, 'whole');
  }
  return moves;
}

interface Deg {
  degree: number;
  acc: number;
  lower: boolean;
  secondary: boolean;
}

const degOf = (c: Chord): Deg => {
  const p = parseNumeralParts(c.numeral);
  return { degree: p.degree, acc: p.acc, lower: p.lower, secondary: !!p.target };
};

const at = (d: Deg, degree: number, acc = 0): boolean => !d.secondary && d.degree === degree && d.acc === acc;

function bassLine(from: Chord, to: Chord): string {
  const a = from.bass ?? from.root;
  const b = to.bass ?? to.root;
  const names = `${noteLabel(simplify(a))} → ${noteLabel(simplify(b))}`;
  switch (mod12(notePc(b) - notePc(a))) {
    case 0: return `The bass stays on ${noteLabel(simplify(a))} — same floor, new furniture on top.`;
    case 1: return `The bass creeps up a half step (${names}) — chromatic, slinky, impossible to ignore.`;
    case 11: return `The bass slides down a half step (${names}) — the smoothest landing there is.`;
    case 2: return `The bass walks up a whole step (${names}).`;
    case 10: return `The bass walks down a whole step (${names}).`;
    case 3: case 4: return `The bass climbs a third (${names}). Roots a third apart share most of their notes, so this is a change of light more than a change of place.`;
    case 8: case 9: return `The bass drops a third (${names}). Roots a third apart share most of their notes, so this is a change of light more than a change of place.`;
    case 5: return `The bass rises a 4th (${names}) — the strongest root motion there is; every link in the circle of fifths sounds like this.`;
    case 7: return `The bass rises a 5th (${names}) — the mirror image of a resolution: it opens a door and leaves it open.`;
    default: return `The bass leaps a tritone (${names}) — as far apart as two roots can get.`;
  }
}

/** The characteristic-note vamps that define each mode. */
const MODAL_VAMPS: Partial<Record<Key['mode'], { degree: number; acc: number; note: 'third' | 'root'; name: string; what: string }>> = {
  dorian: { degree: 4, acc: 0, note: 'third', name: 'Dorian', what: 'the natural 6th' },
  lydian: { degree: 2, acc: 0, note: 'third', name: 'Lydian', what: 'the ♯4' },
  mixolydian: { degree: 7, acc: -1, note: 'root', name: 'Mixolydian', what: 'the ♭7' },
  phrygian: { degree: 2, acc: -1, note: 'root', name: 'Phrygian', what: 'the ♭2' },
};

function story(from: Chord, to: Chord, ctx: TransitionContext, moves: VoiceMove[]): string {
  const A = chordSymbol(from);
  const B = chordSymbol(to);
  const a = degOf(from);
  const b = degOf(to);
  const toTonic = at(b, 1);
  const fromDom = isDominantFamily(from.quality.id);
  const halves = moves.filter((m) => m.kind === 'half');
  const pairs = (list: VoiceMove[]) => list.map((m) => `${m.from}→${m.to}`).join(' and ');

  if (from.secondaryOf) {
    const target = parseNumeralParts(from.secondaryOf);
    if (!b.secondary && target.degree === b.degree && target.acc === b.acc) {
      if (from.numeral.startsWith('bII')) {
        return `${A} is a tritone substitute aimed at ${B}: it carries the same two restless notes as ${B}'s real V7, but the bass slides down a half step instead of leaping. Same tension, silkier exit.`;
      }
      const third = tonesOf(from)[1];
      return `${A} is ${B}'s own private dominant — borrowed from ${B}'s key and aimed straight at it. Its 3rd, ${third?.label}, is a leading tone the home key doesn't own, which is why the pull is stronger than anything around it.`;
    }
    return `${A} promised to resolve somewhere else and didn't — a dominant left hanging. The unresolved pull is the effect.`;
  }

  const vamp = MODAL_VAMPS[ctx.key.mode];
  if (vamp) {
    const other = at(a, 1) ? b : at(b, 1) ? a : undefined;
    const otherChord = at(a, 1) ? to : from;
    if (other && at(other, vamp.degree, vamp.acc)) {
      const tones = tonesOf(otherChord);
      const note = vamp.note === 'root' ? tones[0] : tones[1];
      return `A ${vamp.name} vamp, not a cadence — neither chord is trying to go anywhere. What makes it ${vamp.name} is ${note?.label}, ${vamp.what}, and it only appears in ${chordSymbol(otherChord)}. That's the note to lean on.`;
    }
  }
  if (ctx.distinctChords <= 2) {
    const differ = moves.filter((m) => m.kind !== 'hold');
    return `A two-chord vamp: nothing needs resolving, so the interest has to come from you — rhythm, register, and the notes that actually change${differ.length ? ` (${pairs(differ)})` : ''}.`;
  }

  if (from.numeral.startsWith('bII7') && toTonic) {
    return `${A} is the tritone substitute for V7: it hides the same tritone inside, but the bass slides home by a half step. Jazz's favorite way to arrive.`;
  }
  if (at(a, 5) && from.quality.tones.some((t) => t.degree === 3 && t.semitones === 4) && toTonic) {
    if (fromDom && halves.length >= 2) {
      return `The authentic cadence — tension, then release. The two restless notes inside ${A} collapse inward by half steps (${pairs(halves)}). That squeeze is the most conclusive sound in harmony.`;
    }
    return `V → I, the authentic cadence: ${A} leans, ${B} catches.${halves.length ? ` The leading tone does the work (${pairs(halves)}).` : ''}`;
  }
  if (at(a, 5) && (at(b, 6) || at(b, 6, -1))) {
    return `A deceptive cadence: ${A} promised home and delivered ${B} instead. ${B} shares two of the tonic's three notes — which is why it lands as a plot twist, not a mistake.`;
  }
  if (at(a, 4) && toTonic) {
    if (from.quality.tones.some((t) => t.degree === 3 && t.semitones === 3) && ctx.key.mode !== 'minor') {
      return `The minor plagal cadence: ${A}'s ♭6 sighs down a half step into ${B}${halves.length ? ` (${pairs(halves)})` : ''}. Bittersweet by construction — every wistful movie ending.`;
    }
    return `The plagal "Amen": no leading tone and no tension to discharge, just the 4th settling onto the 3rd. Softer than V → I, which is exactly why rock and gospel love it.`;
  }
  if (at(a, 7, -1) && toTonic) {
    return fromDom
      ? `The backdoor: ${A} resolves up a whole step into ${B}. It has dominant grit but no leading tone, so home arrives warm instead of inevitable.`
      : `The rock cadence: ♭VII steps up to home. No leading tone means no classical pull — it sounds like swagger instead of resolution.`;
  }
  if (at(a, 6, -1) && at(b, 7, -1)) {
    return `Two major chords a whole step apart, climbing — the first two stairs of the ♭VI–♭VII–I "Mario cadence." Same shape, moved up: the ear hears a lift, not a key.`;
  }
  if (at(a, 2, -1) && toTonic) {
    return `A half-step drop onto home from ${A}. That ♭2 hanging over the tonic is the Phrygian shadow — metal and flamenco run on it.`;
  }
  if (fromDom && isDominantFamily(to.quality.id)) {
    return `Blues logic: both chords are dominant 7ths and neither needs to resolve — here the ♭7 is a color, not a question.${halves.length ? ` Watch the inner voice, though: ${pairs(halves)}.` : ''}`;
  }

  const aDiatonic = from.func !== 'borrowed';
  const bDiatonic = to.func !== 'borrowed';
  const third = mod12(notePc(to.root) - notePc(from.root));
  const mediant = [3, 4, 8, 9].includes(third);
  const sameShape = from.quality.id === to.quality.id;
  if (mediant && sameShape && aDiatonic !== bDiatonic) {
    const held = moves.filter((m) => m.kind === 'hold');
    return `A chromatic mediant — film-score magic. Two ${from.quality.name} chords a third apart${held.length ? `, pinned together by ${held[0].from}` : ''} while everything else shifts. It doesn't resolve; it just changes the weather.`;
  }
  if (aDiatonic && !bDiatonic) {
    return `${B} is borrowed — it isn't in the key, so the key itself flickers for a bar. The notes that change (${pairs(moves.filter((m) => m.kind !== 'hold')) || 'listen for them'}) are the whole effect.`;
  }
  if (!aDiatonic && bDiatonic) {
    return `Back inside the key: ${B} restores the notes ${A} bent. The return is the payoff — the borrowed color only works because it gets handed back.`;
  }
  if (to.func === 'dominant') {
    return from.func === 'subdominant'
      ? `The classic wind-up: ${A} loads the spring, ${B} holds it. Whatever comes next, the ear now expects home.`
      : `Arriving on the dominant: tension goes up. Stop here and it's a half cadence — a sentence ending on a comma.`;
  }
  if (at(a, 1)) {
    if (to.func === 'subdominant') return `Leaving home the gentle way. ${B} doesn't create tension so much as distance — like opening a window.`;
    return `Tonic to a relative: the floor drops a little but the family stays the same — most of ${A} is still ringing inside ${B}.`;
  }
  if (toTonic) return `Home again — but without a dominant to announce it, ${B} arrives quietly rather than triumphantly.`;
  if (from.func === to.func) return `Same harmonic job, different chord: a change of color while the energy level stays put.`;
  return `${A} hands off to ${B}: ${from.func} to ${to.func}. Listen for which notes stay and which ones move — that is the whole story of the change.`;
}

function suggestion(from: Chord, to: Chord, moves: VoiceMove[]): string {
  const A = chordSymbol(from);
  const B = chordSymbol(to);
  const half = moves.find((m) => m.kind === 'half');
  if (half) return `Play ${half.from} on the last beat of ${A} and land on ${half.to} as ${B} arrives. One half step and you've outlined the whole change.`;
  const hold = moves.find((m) => m.kind === 'hold');
  if (hold) return `Hold ${hold.from} straight through the change — it lives in both chords, and harmony moving under a still note is its own kind of drama.`;
  const whole = moves.find((m) => m.kind === 'whole');
  if (whole) return `Step from ${whole.from} to ${whole.to} across the barline.`;
  return `Nothing connects by step here, so treat ${B} as a fresh start: leave a gap, then hit its 3rd.`;
}

export function explainTransition(from: Chord, to: Chord, ctx: TransitionContext): TransitionInsight {
  const moves = voiceMoves(from, to);
  const seam = ctx.wrap ? 'The loop seam — the change you hear most, because it comes around every time. ' : '';
  return {
    from, to,
    title: `${chordSymbol(from)} → ${chordSymbol(to)}`,
    fromTones: tonesOf(from),
    toTones: tonesOf(to),
    moves,
    bass: bassLine(from, to),
    story: seam + story(from, to, ctx, moves),
    tryThis: suggestion(from, to, moves),
  };
}
