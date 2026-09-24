// The solo map: what every note of the chosen scale MEANS over the chord that
// is sounding right now. A scale chart says "these notes are allowed"; this
// says "this one is home, this one is color, this one rubs, and this chord
// tone isn't in your scale at all — grab it anyway".

import {
  NoteName, PitchClass, letterIndex, mod7, mod12, noteLabel, notePc, simplify,
} from './notes';
import { ScaleDef, spellScale } from './scales';
import { Chord, chordSymbol, chordTones, isDominantFamily } from './chords';

export type SoloRole = 'root' | 'chord' | 'color' | 'avoid' | 'rub';

export interface SoloNote {
  pc: PitchClass;
  label: string;
  role: SoloRole;
  /** false for chord tones the scale doesn't own — the spice notes */
  inScale: boolean;
  /** distance above the chord root the way a player says it: "♭3", "5", "2" */
  interval: string;
  /** written chord degree (1, 3, 5, 7, 9…) when this is a chord tone */
  chordDegree?: number;
}

export interface Landing {
  pc: PitchClass;
  label: string;
  text: string;
}

export interface SoloMap {
  chord: Chord;
  /** the chord this one hands off to, when there is one */
  next?: Chord;
  /** scale notes in scale order, then any chord tones the scale is missing */
  notes: SoloNote[];
  byPc: Map<PitchClass, SoloNote>;
  /** the one-line lesson for this chord */
  headline: string;
  /** where to aim when the next chord arrives */
  landing?: Landing;
}

export interface SoloScale {
  root: NoteName;
  def: ScaleDef;
}

const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const NATURAL: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 };
const SIMPLE = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];

const accidental = (diff: number): string | undefined =>
  diff === 0 ? '' : diff === -1 ? '♭' : diff === 1 ? '♯' : diff === -2 ? '𝄫' : undefined;

/** "♭3"-style name for a chord tone, from the quality's own degree. */
function toneInterval(degree: number, semitones: number): string {
  const acc = accidental(semitones - NATURAL[degree]);
  if (acc === undefined) return SIMPLE[mod12(semitones)];
  return acc === '𝄫' && degree === 7 ? '°7' : acc + degree;
}

/** Every chord tone's pitch class → what a guitarist calls it: R, ♭3, 5, ♭7, 9… */
export function chordIntervalLabels(chord: Chord): Map<PitchClass, string> {
  const rootPc = notePc(chord.root);
  return new Map(chord.quality.tones.map((t) => [mod12(rootPc + t.semitones), t.degree === 1 ? 'R' : toneInterval(t.degree, t.semitones)] as const));
}

/** Plain semitone distance as a degree name — for notes with no spelling to go on. */
export const simpleInterval = (semitones: number, sharpFour = false): string =>
  (mod12(semitones) === 0 ? 'R' : mod12(semitones) === 6 && !sharpFour ? '♭5' : SIMPLE[mod12(semitones)]);

/** Interval name for a non-chord tone, read from how the two notes are spelled. */
function spelledInterval(root: NoteName, note: NoteName): string {
  const deg = mod7(letterIndex(note.letter) - letterIndex(root.letter));
  const semis = mod12(notePc(note) - notePc(root));
  let diff = semis - MAJOR_SEMIS[deg];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  const acc = accidental(diff);
  // spellings nobody says out loud (♭1, ♯3, ♭4, ♯6, ♯7) go by their plain name instead
  const odd = (deg === 0 && diff !== 0) || (deg === 3 && diff === -1) || ((deg === 2 || deg === 5 || deg === 6) && diff === 1);
  return acc === undefined || acc === '𝄫' || odd ? SIMPLE[semis] : acc + (deg + 1);
}

const show = (n: NoteName): string => noteLabel(simplify(n));

const listOf = (items: string[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * The note that says which chord just arrived: its 3rd — or, for power and sus
 * chords, the 3rd the scale implies, then the sus note, then the root.
 */
export function targetPc(chord: Chord, scalePcs: PitchClass[]): PitchClass {
  const rootPc = notePc(chord.root);
  const third = chord.quality.tones.find((t) => t.degree === 3);
  if (third) return mod12(rootPc + third.semitones);
  for (const semis of [4, 3]) {
    if (scalePcs.includes(mod12(rootPc + semis))) return mod12(rootPc + semis);
  }
  const sus = chord.quality.tones.find((t) => t.degree === 4 || t.degree === 2);
  return sus ? mod12(rootPc + sus.semitones) : rootPc;
}

export function soloMap(scale: SoloScale, chord: Chord, next?: Chord): SoloMap {
  const scaleNotes = spellScale(scale.root, scale.def);
  const scalePcSet = new Set(scaleNotes.map(notePc));
  const rootPc = notePc(chord.root);
  const spelledTones = chordTones(chord);
  const tones = chord.quality.tones.map((t, i) => ({
    pc: mod12(rootPc + t.semitones), degree: t.degree, semitones: t.semitones, name: spelledTones[i],
  }));
  const tonePcs = new Set(tones.map((t) => t.pc));
  const outside = tones.filter((t) => !scalePcSet.has(t.pc));

  // a scale note "rubs" when an outside chord tone has taken over its letter:
  // F♯ under Dm's F♮, G under E7's G♯, the blues ♭3 under a major chord's 3rd
  const rubOf = new Map<PitchClass, (typeof tones)[number]>();
  for (const t of outside) {
    const twin = scaleNotes.find((n) => {
      const gap = mod12(notePc(n) - t.pc);
      return n.letter === t.name.letter && (gap === 1 || gap === 11) && !tonePcs.has(notePc(n));
    });
    if (twin) rubOf.set(notePc(twin), t);
  }

  const notes: SoloNote[] = [];
  const seen = new Set<PitchClass>();
  const pushTone = (t: (typeof tones)[number], inScale: boolean, label: string) => {
    notes.push({
      pc: t.pc, label, inScale,
      role: t.pc === rootPc ? 'root' : 'chord',
      interval: toneInterval(t.degree, t.semitones),
      chordDegree: t.degree,
    });
  };
  for (const n of scaleNotes) {
    const pc = notePc(n);
    if (seen.has(pc)) continue;
    seen.add(pc);
    const tone = tones.find((t) => t.pc === pc);
    if (tone) { pushTone(tone, true, show(n)); continue; }
    // a half step above a chord tone fights it — except the ♭9 of a dominant, which is the point
    const above = tones.find((t) => mod12(t.pc + 1) === pc);
    const clashes = above && !(isDominantFamily(chord.quality.id) && above.pc === rootPc);
    notes.push({
      pc, label: show(n), inScale: true,
      role: rubOf.has(pc) ? 'rub' : clashes ? 'avoid' : 'color',
      interval: spelledInterval(chord.root, n),
    });
  }
  for (const t of outside) {
    if (seen.has(t.pc)) continue;
    seen.add(t.pc);
    pushTone(t, false, show(t.name));
  }

  const byPc = new Map(notes.map((n) => [n.pc, n] as const));
  const map: SoloMap = { chord, next, notes, byPc, headline: '' };
  map.headline = headlineFor(map, rubOf, scale.def.id === 'minorPent' || scale.def.id === 'blues');
  if (next) map.landing = landingFor(map, next, [...scalePcSet]);
  return map;
}

function headlineFor(map: SoloMap, rubOf: Map<PitchClass, { pc: PitchClass }>, bluesy: boolean): string {
  const sym = chordSymbol(map.chord);
  const home = map.notes.filter((n) => n.chordDegree !== undefined && n.inScale).map((n) => n.label);
  const outside = map.notes.filter((n) => !n.inScale);
  const avoid = map.notes.filter((n) => n.role === 'avoid');

  if (outside.length) {
    const parts = outside.map((o) => {
      const rub = map.notes.find((n) => n.role === 'rub' && rubOf.get(n.pc)?.pc === o.pc);
      const what = o.interval === '1' ? 'root' : o.interval;
      if (!rub) return `add ${o.label} (its ${what}) — your scale doesn't have it, and it's what makes ${sym} sound like ${sym}`;
      if (bluesy && rub.interval === '♭3' && o.interval === '3') {
        return `${rub.label} rubs against the chord's ${o.label} — bend or slide ${rub.label} up into ${o.label}. That rub is the blues`;
      }
      return `trade ${rub.label} for ${o.label} (its ${what}) while it lasts`;
    });
    return `Over ${sym}: ${parts.join('; ')}.`;
  }
  if (avoid.length) {
    const a = avoid[0];
    const below = map.byPc.get(mod12(a.pc - 1));
    return `Everything fits ${sym}. Home base is ${listOf(home)}; ${a.label} sits a half step over ${below?.label ?? 'a chord tone'} — pass through it, don't park.`;
  }
  return `Every note is friendly over ${sym}. Home base is ${listOf(home)}; the rest is color.`;
}

function landingFor(map: SoloMap, next: Chord, scalePcs: PitchClass[]): Landing {
  const nextSym = chordSymbol(next);
  const pc = targetPc(next, scalePcs);
  const nextRoot = notePc(next.root);
  const spelled = chordTones(next);
  const idx = next.quality.tones.findIndex((t) => mod12(nextRoot + t.semitones) === pc);
  const label = idx >= 0 ? show(spelled[idx]) : (map.byPc.get(pc)?.label ?? '');
  const tone = idx >= 0 ? next.quality.tones[idx] : undefined;
  const what = !tone ? 'implied 3rd' : tone.degree === 3 ? '3rd' : tone.degree === 1 ? 'root' : `${tone.degree}th`;

  const here = map.byPc.get(pc);
  if (here && here.chordDegree !== undefined) {
    return { pc, label, text: `Next is ${nextSym}: ${label} belongs to both chords — hold it across the change and let the harmony move underneath you.` };
  }
  // the smoothest way in: a chord tone of THIS chord a half or whole step away
  const tones = map.notes.filter((n) => n.chordDegree !== undefined);
  for (const gap of [1, 2]) {
    for (const dir of [-1, 1]) {
      const from = tones.find((n) => mod12(n.pc + dir * gap) === pc);
      if (!from) continue;
      const step = gap === 1 ? 'a half step' : 'a whole step';
      return { pc, label, text: `Next is ${nextSym}: aim for ${label}, its ${what} — ${step} ${dir === 1 ? 'up' : 'down'} from ${from.label}.` };
    }
  }
  return { pc, label, text: `Next is ${nextSym}: aim for ${label}, its ${what} — the note that tells the ear which chord just arrived.` };
}

// ---------------------------------------------------------------------------
// Exercise lenses: the same map with most of it switched off. Constraints are
// the fastest way from "a screen full of allowed notes" to an actual phrase.

export type LensId = 'map' | 'roots' | 'rhythm' | 'thirds' | 'arps' | 'guide' | 'three';

export interface Lens {
  id: LensId;
  name: string;
  /** rung on the ladder; 0 = the unconstrained map */
  level: number;
  goal: string;
}

export const LENSES: Lens[] = [
  { id: 'map', name: 'Full map', level: 0, goal: 'Everything at once: land on the bright notes, travel through the rest, and leave some air between phrases.' },
  { id: 'roots', name: 'Roots only', level: 1, goal: 'One note per chord: its root, right as the chord changes. Any rhythm you like. If you can find every root in time, you can never get lost.' },
  { id: 'rhythm', name: 'One note, all rhythm', level: 2, goal: 'A single note for the whole loop. With pitch off the table, the only thing left to play with is WHEN — push it, delay it, repeat it, leave holes.' },
  { id: 'thirds', name: 'Land on the 3rd', level: 3, goal: 'Play whatever you want during the bar, but beat 1 of every chord is its 3rd (ringed). The 3rd is the note that tells the ear which chord just arrived.' },
  { id: 'arps', name: 'Chord tones only', level: 4, goal: 'Only the notes of the chord that is sounding. It feels like a cage for a minute — then you notice the solo is spelling the harmony by itself.' },
  { id: 'guide', name: 'Guide tones', level: 5, goal: 'Just 3rds and 7ths, held long, moving to the nearest one when the chord changes. The thinnest line that still carries the whole progression.' },
  { id: 'three', name: 'Three-note answer', level: 6, goal: 'Call and response with only three notes. The demo plays a call in one bar and goes silent in the next — that silence is yours. Steal its rhythm, change its ending.' },
];

export interface LensView {
  /** pitch classes the exercise lets you play over this chord */
  lit: Set<PitchClass>;
  /** the notes to land on when the chord arrives */
  targets: Set<PitchClass>;
}

export interface LoopContext {
  /** one note that works across the whole loop (for 'rhythm') */
  anchorPc: PitchClass;
  /** three neighbouring notes that work across the loop (for 'three') */
  trio: PitchClass[];
}

/** Pick the loop-wide notes the single-note and three-note exercises use. */
export function loopContext(scale: SoloScale, chords: Chord[]): LoopContext {
  const scalePcs = spellScale(scale.root, scale.def).map(notePc).filter((pc, i, all) => all.indexOf(pc) === i);
  const tonic = notePc(scale.root);
  const fifth = mod12(tonic + 7);
  const score = (pc: PitchClass): number => {
    let s = pc === tonic ? 0.6 : pc === fifth ? 0.3 : 0;
    for (const c of chords) {
      const root = notePc(c.root);
      const tones = c.quality.tones.map((t) => mod12(root + t.semitones));
      if (tones.includes(pc)) s += 2;
      else if (tones.some((t) => mod12(t + 1) === pc)) s -= 1.5;
    }
    return s;
  };
  const anchorPc = scalePcs.reduce((best, pc) => (score(pc) > score(best) ? pc : best), scalePcs[0] ?? tonic);

  // walk up from the anchor through the pentatonic skeleton of the scale
  const hasMajorThird = scalePcs.includes(mod12(tonic + 4));
  const skeleton = (hasMajorThird ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10]).map((s) => mod12(tonic + s));
  const friendly = scalePcs.filter((pc) => skeleton.includes(pc));
  const ladder = (friendly.includes(anchorPc) && friendly.length >= 3 ? friendly : scalePcs)
    .map((pc) => ({ pc, up: mod12(pc - anchorPc) }))
    .sort((a, b) => a.up - b.up);
  return { anchorPc, trio: ladder.slice(0, 3).map((x) => x.pc) };
}

export function lensView(lens: LensId, map: SoloMap, scalePcs: PitchClass[], loop: LoopContext): LensView {
  const target = targetPc(map.chord, scalePcs);
  const chordPcs = map.notes.filter((n) => n.chordDegree !== undefined).map((n) => n.pc);
  const rootPc = notePc(map.chord.root);
  switch (lens) {
    case 'roots':
      return { lit: new Set([rootPc]), targets: new Set([rootPc]) };
    case 'rhythm':
      return { lit: new Set([loop.anchorPc]), targets: new Set([loop.anchorPc]) };
    case 'arps':
      return { lit: new Set(chordPcs), targets: new Set([target]) };
    case 'guide': {
      const seventh = map.notes.find((n) => n.chordDegree === 7);
      const fifth = map.notes.find((n) => n.chordDegree === 5);
      const pair = [target, (seventh ?? fifth)?.pc ?? rootPc];
      return { lit: new Set(pair), targets: new Set(pair) };
    }
    case 'three':
      return { lit: new Set(loop.trio), targets: new Set(loop.trio) };
    case 'thirds':
    case 'map':
      return { lit: new Set(map.notes.map((n) => n.pc)), targets: new Set([target]) };
  }
}
