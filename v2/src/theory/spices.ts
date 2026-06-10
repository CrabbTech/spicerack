// Spices: transformations that take a plain progression and teach you a trick.
// Each spice can find zero or more concrete applications in the current
// progression; every application carries the full "why it works" story.

import { noteLabel, notePc, mod12, simplify, spellPcSimple, NoteName } from './notes';
import { Key, isMinorish, flatLeaning, keyScale } from './scales';
import { Chord, QualityId, chordSymbol, chordTones, isDominantFamily } from './chords';
import {
  chromaticNeighborNumeral, coreToString, parseNumeralParts,
  resolveNumeral, secondaryDominantOf, tritoneSubOf, withSuffix,
} from './roman';
import { Slot, newSlot, realize } from './progression';

export type SpiceId =
  | 'secondary-dominant' | 'borrowed-iv' | 'flat-seven' | 'mario' | 'tritone-sub'
  | 'extensions' | 'sus-tension' | 'passing-dim' | 'picardy' | 'andalusian'
  | 'truck-driver' | 'backdoor' | 'half-step-slide' | 'line-cliche' | 'pedal-point'
  | 'phrygian-bite' | 'tritone-riff' | 'harmonic-minor-v'
  | 'deceptive-cadence' | 'chromatic-mediant' | 'common-tone-dim' | 'neapolitan' | 'minor-deflation';

/** Genre-dependent seasoning preferences, injected into spice finders. */
export interface GenreFlavor {
  /** quality upgrade ladders for the "extensions" spice */
  ladder: Partial<Record<QualityId, QualityId>>;
  /** secondary dominants come out as plain 7 or spooky 7♭9 */
  dominantFlavor: '7' | '7b9';
}

export interface SpiceContext {
  key: Key;
  flavor: GenreFlavor;
}

export interface ProgressionPatch {
  slots?: Slot[];
  /** semitones to take the whole progression up on the repeat (truck driver) */
  modulate?: number;
}

export interface SpiceApplication {
  spiceId: SpiceId;
  spiceName: string;
  /** short menu label, e.g. "E7 → Am" */
  label: string;
  /** the teaching text shown in the log */
  explanation: string;
  /** slot this application is anchored on, for per-card menus */
  targetSlotId?: number;
  apply(): ProgressionPatch;
}

export interface Spice {
  id: SpiceId;
  name: string;
  icon: string;
  blurb: string;
  find(slots: Slot[], ctx: SpiceContext): SpiceApplication[];
}

// --- helpers ---------------------------------------------------------------

const L = (n: NoteName): string => noteLabel(simplify(n));

const sym = (c: Chord): string => chordSymbol(c);

/** label of a chord tone by written degree (3 = third, 7 = seventh...) */
function toneLabel(c: Chord, degree: number): string {
  const i = c.quality.tones.findIndex((t) => t.degree === degree);
  return i >= 0 ? L(chordTones(c)[i]) : '?';
}

const isTonicDegree = (numeral: string): boolean => {
  const p = parseNumeralParts(numeral);
  return p.degree === 1 && p.acc === 0 && !p.target;
};

const isPlainDegree = (numeral: string, degree: number): boolean => {
  const p = parseNumeralParts(numeral);
  return p.degree === degree && p.acc === 0 && !p.target;
};

const replaceAt = (slots: Slot[], i: number, ...replacement: Slot[]): Slot[] =>
  [...slots.slice(0, i), ...replacement, ...slots.slice(i + 1)];

const insertAt = (slots: Slot[], i: number, ...inserted: Slot[]): Slot[] =>
  [...slots.slice(0, i), ...inserted, ...slots.slice(i)];

// --- the rack --------------------------------------------------------------

const secondaryDominant: Spice = {
  id: 'secondary-dominant',
  name: 'Secondary dominant',
  icon: '🎯',
  blurb: 'Borrow the V7 of any chord to yank the ear toward it.',
  find(slots, { key, flavor }) {
    const real = realize(slots, key);
    const apps: SpiceApplication[] = [];
    real.forEach((r, i) => {
      const parts = parseNumeralParts(r.slot.numeral);
      if (parts.target) return;                       // already secondary
      if (parts.degree === 1 && parts.acc === 0) return; // V7/I is just V7
      if (r.chord.quality.id === 'dim' || r.chord.quality.id === 'dim7' || r.chord.quality.id === 'm7b5') return;
      const domNumeral = secondaryDominantOf(r.slot.numeral, flavor.dominantFlavor);
      const dom = resolveNumeral(domNumeral, key);
      const prev = i > 0 ? real[i - 1].chord : undefined;
      if (prev && notePc(prev.root) === notePc(dom.root) && isDominantFamily(prev.quality.id)) return;
      apps.push({
        spiceId: 'secondary-dominant',
        spiceName: 'Secondary dominant',
        label: `${sym(dom)} → ${sym(r.chord)}`,
        targetSlotId: r.slot.id,
        explanation:
          `${sym(dom)} doesn't live in this key — it's the V7 of ${sym(r.chord)}. ` +
          `For one bar your ear accepts ${sym(r.chord)} as home, which makes landing on it feel inevitable. ` +
          `The giveaway is ${toneLabel(dom, 3)}, the 3rd of ${sym(dom)}: it sits a half step under ${L(r.chord.root)} and pushes straight into it.`,
        apply: () => ({
          slots: insertAt(slots, i, newSlot(domNumeral, 1, { spiceId: 'secondary-dominant' })),
        }),
      });
    });
    return apps;
  },
};

const borrowedIv: Spice = {
  id: 'borrowed-iv',
  name: 'Borrowed iv',
  icon: '🌧',
  blurb: 'Steal the minor iv from the parallel minor key.',
  find(slots, { key }) {
    if (isMinorish(key.mode)) return [];
    const iv = resolveNumeral('iv', key);
    const six = keyScale({ tonic: key.tonic, mode: 'major' })[5];
    const five = keyScale({ tonic: key.tonic, mode: 'major' })[4];
    const explanation =
      `${sym(iv)} is borrowed from ${L(key.tonic)} minor. Its middle note ${toneLabel(iv, 3)} is the ` +
      `flattened ${L(six)} of your key, and hearing it sink ${L(six)}→${toneLabel(iv, 3)}→${L(five)} ` +
      `is the most bittersweet move in pop — doo-wop, The Beatles and Radiohead all run on it.`;
    const apps: SpiceApplication[] = [];
    slots.forEach((s, i) => {
      if (parseNumeralParts(s.numeral).target) return;
      if (!isPlainDegree(s.numeral, 4) || s.numeral.startsWith('iv')) return;
      const next = slots[i + 1];
      if (next && isTonicDegree(next.numeral)) {
        apps.push({
          spiceId: 'borrowed-iv', spiceName: 'Borrowed iv',
          label: `IV → iv → I melt`, targetSlotId: s.id, explanation,
          apply: () => ({ slots: insertAt(slots, i + 1, newSlot('iv', 1, { spiceId: 'borrowed-iv' })) }),
        });
      }
      else {
        apps.push({
          spiceId: 'borrowed-iv', spiceName: 'Borrowed iv',
          label: `${sym(resolveNumeral(s.numeral, key))} → ${sym(iv)}`, targetSlotId: s.id, explanation,
          apply: () => ({ slots: replaceAt(slots, i, newSlot('iv', s.bars, { spiceId: 'borrowed-iv' })) }),
        });
      }
    });
    return apps.slice(0, 1);
  },
};

const flatSeven: Spice = {
  id: 'flat-seven',
  name: '♭VII stomp',
  icon: '🍺',
  blurb: 'The rock & roll back door, one whole step below home.',
  find(slots, { key }) {
    if (isMinorish(key.mode)) return [];
    if (slots.some((s) => parseNumeralParts(s.numeral).degree === 7 && parseNumeralParts(s.numeral).acc === -1)) return [];
    const bvii = resolveNumeral('bVII', key);
    const tonicChord = resolveNumeral('I', key);
    const explanation =
      `${sym(bvii)} sits a whole step below ${sym(tonicChord)}, borrowed from ${L(key.tonic)} Mixolydian. ` +
      `It has none of V's schoolbook manners but still falls back onto ${sym(tonicChord)} perfectly — ` +
      `AC/DC, the Stones and half of classic rock run on I–♭VII–IV.`;
    const apps: SpiceApplication[] = [];
    const vIdx = slots.findIndex((s) => isPlainDegree(s.numeral, 5) && !parseNumeralParts(s.numeral).lower);
    if (vIdx >= 0) {
      apps.push({
        spiceId: 'flat-seven', spiceName: '♭VII stomp',
        label: `swap V for ${sym(bvii)}`, targetSlotId: slots[vIdx].id, explanation,
        apply: () => ({ slots: replaceAt(slots, vIdx, newSlot('bVII', slots[vIdx].bars, { spiceId: 'flat-seven' })) }),
      });
    }
    for (let i = slots.length - 1; i > 0; i--) {
      if (isTonicDegree(slots[i].numeral)) {
        apps.push({
          spiceId: 'flat-seven', spiceName: '♭VII stomp',
          label: `${sym(bvii)} before the final ${sym(tonicChord)}`, targetSlotId: slots[i].id, explanation,
          apply: () => ({ slots: insertAt(slots, i, newSlot('bVII', 1, { spiceId: 'flat-seven' })) }),
        });
        break;
      }
    }
    return apps;
  },
};

const mario: Spice = {
  id: 'mario',
  name: 'Mario cadence',
  icon: '🍄',
  blurb: '♭VI–♭VII–I: two borrowed chords climbing into victory.',
  find(slots, { key }) {
    if (isMinorish(key.mode)) return [];
    const last = slots.length - 1;
    if (last < 1 || !isTonicDegree(slots[last].numeral)) return [];
    const prev = parseNumeralParts(slots[last - 1].numeral);
    if (prev.acc === -1 && (prev.degree === 7 || prev.degree === 6)) return [];
    const bvi = resolveNumeral('bVI', key);
    const bvii = resolveNumeral('bVII', key);
    const tonicChord = resolveNumeral(slots[last].numeral, key);
    return [{
      spiceId: 'mario', spiceName: 'Mario cadence',
      label: `${sym(bvi)}–${sym(bvii)}–${sym(tonicChord)}`,
      targetSlotId: slots[last].id,
      explanation:
        `${sym(bvi)} and ${sym(bvii)} are both borrowed from the parallel minor, stacked into a whole-step ` +
        `staircase up to ${sym(tonicChord)}. It's the "stage clear!" cadence — Koji Kondo used it in Super Mario, ` +
        `and every power ballad outro since has kept it employed.`,
      apply: () => ({
        slots: insertAt(slots, last,
          newSlot('bVI', 1, { spiceId: 'mario' }),
          newSlot('bVII', 1, { spiceId: 'mario' })),
      }),
    }];
  },
};

const tritoneSub: Spice = {
  id: 'tritone-sub',
  name: 'Tritone sub',
  icon: '🃏',
  blurb: 'Swap any dominant for the one six frets away.',
  find(slots, { key }) {
    const real = realize(slots, key);
    const apps: SpiceApplication[] = [];
    real.forEach((r, i) => {
      if (!isDominantFamily(r.chord.quality.id)) return;
      const next = real[i + 1];
      if (!next) return;
      const subNumeral = tritoneSubOf(next.slot.numeral);
      if (!subNumeral) return;
      const sub = resolveNumeral(subNumeral, key);
      if (notePc(sub.root) === notePc(r.chord.root)) return; // already subbed
      // only sub dominants that actually resolve down a fifth
      if (mod12(notePc(r.chord.root) - notePc(next.chord.root)) !== 7) return;
      apps.push({
        spiceId: 'tritone-sub', spiceName: 'Tritone sub',
        label: `${sym(r.chord)} → ${sym(sub)}`,
        targetSlotId: r.slot.id,
        explanation:
          `${sym(r.chord)} and ${sym(sub)} share the same two load-bearing notes — ${toneLabel(r.chord, 3)} and ` +
          `${toneLabel(r.chord, 7)}, the tritone that actually does the pulling — so jazz swaps one for the other. ` +
          `Bonus: the bass now slides ${L(sub.root)}→${L(next.chord.root)} by half step instead of jumping a fifth.`,
        apply: () => ({ slots: replaceAt(slots, i, newSlot(subNumeral, r.slot.bars, { spiceId: 'tritone-sub' })) }),
      });
    });
    return apps;
  },
};

const extensions: Spice = {
  id: 'extensions',
  name: 'Color tones',
  icon: '🎨',
  blurb: 'Same chords, more vowels: 7ths and 9ths.',
  find(slots, { key, flavor }) {
    const upgrades: { i: number; numeral: string }[] = [];
    slots.forEach((s, i) => {
      const parts = parseNumeralParts(s.numeral);
      const q = resolveNumeral(s.numeral, key).quality.id;
      const next = flavor.ladder[q];
      if (!next) return;
      const suffix = SUFFIX_OF[next];
      if (suffix === undefined) return;
      upgrades.push({ i, numeral: withSuffix(coreToString(parts) + (parts.target ? '/' + coreToString(parts.target) : ''), suffix) });
    });
    if (!upgrades.length) return [];
    const preview = upgrades.slice(0, 3)
      .map((u) => `${sym(resolveNumeral(slots[u.i].numeral, key))}→${sym(resolveNumeral(u.numeral, key))}`)
      .join(', ');
    return [{
      spiceId: 'extensions', spiceName: 'Color tones',
      label: `add 7ths & 9ths (${preview}…)`,
      explanation:
        `Extensions don't change what a chord does, they change what it wears: the 7th blurs the edges, the 9th ` +
        `adds air. ${preview} — same harmonic skeleton, velvet jacket. If a melody note clashes, drop back one notch on that chord only.`,
      apply: () => ({
        slots: slots.map((s) => {
          const up = upgrades.find((u) => slots[u.i].id === s.id);
          return up ? { ...s, numeral: up.numeral, spiceId: 'extensions' } : s;
        }),
      }),
    }];
  },
};

/** numeral suffix that produces each quality (for ladder rewrites) */
export const SUFFIX_OF: Partial<Record<QualityId, string>> = {
  maj7: 'maj7', maj9: 'maj9', m7: '7', m9: '9', dom7: '7', dom9: '9', dom13: '13',
  six: '6', m6: '6', add9: 'add9', m11: '11', mMaj7: 'maj7', maj7s11: 'maj7#11',
};

const susTension: Spice = {
  id: 'sus-tension',
  name: 'Sus & release',
  icon: '⏳',
  blurb: 'Hold the 4th where the 3rd should be, then let go.',
  find(slots, { key }) {
    const apps: SpiceApplication[] = [];
    slots.forEach((s, i) => {
      const p = parseNumeralParts(s.numeral);
      if (p.degree !== 5 || p.lower || p.target || p.acc !== 0) return;
      if (p.suffix.includes('sus')) return;
      if (i > 0 && parseNumeralParts(slots[i - 1].numeral).suffix.includes('sus')) return;
      const v = resolveNumeral(s.numeral, key);
      const sus = resolveNumeral('Vsus4', key);
      apps.push({
        spiceId: 'sus-tension', spiceName: 'Sus & release',
        label: `${sym(sus)} → ${sym(v)}`,
        targetSlotId: s.id,
        explanation:
          `${sym(sus)} parks the 4th (${toneLabel(sus, 4)}) exactly where ${sym(v)} wants its leading tone, ` +
          `so the chord hangs in mid-air — then resolves down a half step and the lights come back on. ` +
          `Tension you can schedule. The Who and U2 built anthems out of this one move.`,
        apply: () => ({
          slots: insertAt(slots, i, newSlot('Vsus4', 1, { spiceId: 'sus-tension', annotation: 'let it hang…' })),
        }),
      });
    });
    return apps.slice(0, 1);
  },
};

const passingDim: Spice = {
  id: 'passing-dim',
  name: 'Passing dim7',
  icon: '🪜',
  blurb: 'A chromatic stepping stone between two chords.',
  find(slots, { key }) {
    const real = realize(slots, key);
    const apps: SpiceApplication[] = [];
    for (let i = 0; i < real.length - 1; i++) {
      const a = parseNumeralParts(real[i].slot.numeral);
      const b = parseNumeralParts(real[i + 1].slot.numeral);
      if (a.target || b.target || a.acc === 1) continue;
      const gap = mod12(notePc(real[i + 1].chord.root) - notePc(real[i].chord.root));
      if (gap !== 2) continue;
      const dimNumeral = coreToString({ acc: a.acc + 1, degree: a.degree, lower: true }) + 'o7';
      const dim = resolveNumeral(dimNumeral, key);
      apps.push({
        spiceId: 'passing-dim', spiceName: 'Passing dim7',
        label: `${sym(real[i].chord)} → ${sym(dim)} → ${sym(real[i + 1].chord)}`,
        targetSlotId: real[i].slot.id,
        explanation:
          `${sym(dim)} fills the whole-step gap between ${sym(real[i].chord)} and ${sym(real[i + 1].chord)} with a ` +
          `chromatic stepping stone: the bass walks ${L(real[i].chord.root)}→${L(dim.root)}→${L(real[i + 1].chord.root)}. ` +
          `A dim7 is tension in all four directions at once, which is why it can connect almost anything to anything.`,
        apply: () => ({ slots: insertAt(slots, i + 1, newSlot(dimNumeral, 1, { spiceId: 'passing-dim' })) }),
      });
    }
    return apps;
  },
};

const picardy: Spice = {
  id: 'picardy',
  name: 'Picardy third',
  icon: '🌅',
  blurb: 'End the gloom on a surprise major chord.',
  find(slots, { key }) {
    if (!isMinorish(key.mode)) return [];
    const last = slots.length - 1;
    const p = parseNumeralParts(slots[last].numeral);
    if (!(p.degree === 1 && p.acc === 0 && p.lower && !p.target)) return [];
    const iChord = resolveNumeral(slots[last].numeral, key);
    const major = resolveNumeral('I', key);
    return [{
      spiceId: 'picardy', spiceName: 'Picardy third',
      label: `final ${sym(iChord)} → ${sym(major)}`,
      targetSlotId: slots[last].id,
      explanation:
        `After all that minor, the last chord flips its ♭3 (${toneLabel(iChord, 3)}) up a half step to ` +
        `${toneLabel(major, 3)} and ends in sunshine. Bach signed off this way even in his darkest keys — ` +
        `the Picardy third is music's "...but it's going to be okay."`,
      apply: () => ({
        slots: replaceAt(slots, last, newSlot('I', slots[last].bars, { spiceId: 'picardy', annotation: 'Picardy!' })),
      }),
    }];
  },
};

const andalusian: Spice = {
  id: 'andalusian',
  name: 'Andalusian slide',
  icon: '💃',
  blurb: 'The flamenco staircase: i–♭VII–♭VI–V.',
  find(slots, { key }) {
    if (!isMinorish(key.mode)) return [];
    for (let i = 0; i < slots.length - 1; i++) {
      const a = parseNumeralParts(slots[i].numeral);
      const b = parseNumeralParts(slots[i + 1].numeral);
      if (a.degree === 7 && a.acc === -1 && b.degree === 6 && b.acc === -1) return [];
    }
    const idx = slots.map((s) => s.numeral).lastIndexOf(
      slots.filter((s) => isTonicDegree(s.numeral)).map((s) => s.numeral).pop() ?? '',
    );
    if (idx < 0) return [];
    const names = ['i', 'bVII', 'bVI', 'V'].map((n) => sym(resolveNumeral(n, key)));
    return [{
      spiceId: 'andalusian', spiceName: 'Andalusian slide',
      label: names.join('–'),
      targetSlotId: slots[idx].id,
      explanation:
        `${names.join('–')}: the Andalusian cadence. The bass marches straight down the scale like a flamenco ` +
        `dancer leaving the stage, and the final ${names[3]} (major, borrowed from harmonic minor) snaps you back to ` +
        `${names[0]}. Del Shannon's "Runaway," "Hit the Road Jack," "Sultans of Swing" — same staircase.`,
      apply: () => ({
        slots: insertAt(slots, idx + 1,
          newSlot('bVII', 1, { spiceId: 'andalusian' }),
          newSlot('bVI', 1, { spiceId: 'andalusian' }),
          newSlot('V', 1, { spiceId: 'andalusian' })),
      }),
    }];
  },
};

const truckDriver: Spice = {
  id: 'truck-driver',
  name: "Truck driver's gear change",
  icon: '🚚',
  blurb: 'Last chorus? Take the whole thing up a step.',
  find(slots, { key }) {
    const prefer = flatLeaning(key) ? 'flat' : 'sharp';
    const newTonic = spellPcSimple(mod12(notePc(key.tonic) + 2), prefer);
    const oldChords = realize(slots, key).map((r) => sym(r.chord));
    const newChords = realize(slots, { ...key, tonic: newTonic }).map((r) => sym(r.chord));
    const mapping = oldChords.slice(0, 4).map((c, i) => `${c}→${newChords[i]}`).join(', ');
    return [{
      spiceId: 'truck-driver', spiceName: "Truck driver's gear change",
      label: `repeat it in ${L(newTonic)}`,
      explanation:
        `When the last chorus needs 11% more glory, shove everything up a whole step: ${mapping}. ` +
        `Same shapes, two frets higher (guitarists just slide; OP-1 players hit the transpose). ` +
        `Bon Jovi, Whitney, Beyoncé — everybody rides the truck driver's gear change eventually.`,
      apply: () => ({ modulate: 2 }),
    }];
  },
};

const backdoor: Spice = {
  id: 'backdoor',
  name: 'Backdoor dominant',
  icon: '🚪',
  blurb: '♭VII7 resolves home without the drama of V.',
  find(slots, { key }) {
    if (isMinorish(key.mode)) return [];
    for (let i = slots.length - 1; i > 0; i--) {
      if (!isTonicDegree(slots[i].numeral)) continue;
      const prev = parseNumeralParts(slots[i - 1].numeral);
      if (prev.degree === 7 && prev.acc === -1) return [];
      const bvii7 = resolveNumeral('bVII7', key);
      const tonicChord = resolveNumeral(slots[i].numeral, key);
      const fifth = keyScale({ tonic: key.tonic, mode: 'major' })[4];
      return [{
        spiceId: 'backdoor', spiceName: 'Backdoor dominant',
        label: `${sym(bvii7)} → ${sym(tonicChord)}`,
        targetSlotId: slots[i].id,
        explanation:
          `${sym(bvii7)} sneaks into ${sym(tonicChord)} from a whole step below — the "backdoor dominant," ` +
          `borrowed from the parallel minor. Its 7th (${toneLabel(bvii7, 7)}) melts down into ${L(fifth)} instead of ` +
          `snapping like a V7 would. Jazz standards and Stevie Wonder use this door constantly.`,
        apply: () => ({ slots: insertAt(slots, i, newSlot('bVII7', 1, { spiceId: 'backdoor' })) }),
      }];
    }
    return [];
  },
};

const halfStepSlide: Spice = {
  id: 'half-step-slide',
  name: 'Half-step slide',
  icon: '🛝',
  blurb: 'Approach any chord from one fret above.',
  find(slots, { key }) {
    const real = realize(slots, key);
    const apps: SpiceApplication[] = [];
    real.forEach((r, i) => {
      if (r.chord.quality.tones.length < 4) return; // needs a 7th-chord grip to sound right
      const p = parseNumeralParts(r.slot.numeral);
      if (p.target) return;
      const approachNumeral = chromaticNeighborNumeral(r.slot.numeral, 1);
      if (!approachNumeral) return;
      const approach = resolveNumeral(approachNumeral, key);
      const prev = i > 0 ? real[i - 1].chord : undefined;
      if (prev && notePc(prev.root) === notePc(approach.root)) return;
      apps.push({
        spiceId: 'half-step-slide', spiceName: 'Half-step slide',
        label: `${sym(approach)} ↘ ${sym(r.chord)}`,
        targetSlotId: r.slot.id,
        explanation:
          `Play the exact same ${r.chord.quality.symbol || 'major'} shape one fret above ${sym(r.chord)}, then slide ` +
          `down into it: ${sym(approach)} → ${sym(r.chord)}. Parallel chords ignore the key on purpose — the ear ` +
          `forgives anything that resolves by half step. That grease is half of what makes neo-soul sound like neo-soul.`,
        apply: () => ({
          slots: insertAt(slots, i, newSlot(approachNumeral, 1, { spiceId: 'half-step-slide', annotation: 'slide!' })),
        }),
      });
    });
    return apps.slice(0, 2);
  },
};

const lineCliche: Spice = {
  id: 'line-cliche',
  name: 'Line cliché',
  icon: '🕵️',
  blurb: 'One minor chord, one inner voice walking down.',
  find(slots, { key }) {
    if (!isMinorish(key.mode)) return [];
    const i = slots.findIndex((s) => s.numeral === 'i' || s.numeral === 'i7');
    if (i < 0) return [];
    const tones = ['i', 'imaj7', 'i7', 'i6'].map((n) => resolveNumeral(n, key));
    const walk = [toneLabel(tones[0], 1), toneLabel(tones[1], 7), toneLabel(tones[2], 7), toneLabel(tones[3], 6)];
    return [{
      spiceId: 'line-cliche', spiceName: 'Line cliché',
      label: `${sym(tones[0])} → ${sym(tones[1])} → ${sym(tones[2])} → ${sym(tones[3])}`,
      targetSlotId: slots[i].id,
      explanation:
        `The chord never changes — one inner voice walks down chromatically: ${walk.join('→')}. ` +
        `"Stairway to Heaven," "Michelle," "My Funny Valentine," every Bond theme: a one-finger soap opera ` +
        `happening inside a single minor chord.`,
      apply: () => ({
        slots: replaceAt(slots, i,
          newSlot('i', 1, { spiceId: 'line-cliche', annotation: `bass ${walk[0]}` }),
          newSlot('imaj7', 1, { spiceId: 'line-cliche', annotation: walk[1] }),
          newSlot('i7', 1, { spiceId: 'line-cliche', annotation: walk[2] }),
          newSlot('i6', 1, { spiceId: 'line-cliche', annotation: walk[3] })),
      }),
    }];
  },
};

const pedalPoint: Spice = {
  id: 'pedal-point',
  name: 'Pedal point',
  icon: '⚓',
  blurb: 'Park the bass on the tonic and let chords float over it.',
  find(slots, { key }) {
    if (slots.every((s) => s.pedalBass || isTonicDegree(s.numeral))) return [];
    return [{
      spiceId: 'pedal-point', spiceName: 'Pedal point',
      label: `everything over ${L(key.tonic)}`,
      explanation:
        `The bass refuses to move: every chord now floats over a ${L(key.tonic)} pedal. Harmony stops being a ` +
        `journey and becomes weather — funk vamps and prog intros both love how hypnotic it is. ` +
        `When you finally release the pedal, the next section lands twice as hard.`,
      apply: () => ({
        slots: slots.map((s) => isTonicDegree(s.numeral) ? s : { ...s, pedalBass: true, spiceId: 'pedal-point' as const }),
      }),
    }];
  },
};

const phrygianBite: Spice = {
  id: 'phrygian-bite',
  name: 'Phrygian ♭II',
  icon: '🦈',
  blurb: 'The chord one half step above home. Menace included.',
  find(slots, { key }) {
    if (!isMinorish(key.mode)) return [];
    if (slots.some((s) => { const p = parseNumeralParts(s.numeral); return p.degree === 2 && p.acc === -1; })) return [];
    const i = slots.findIndex((s) => isTonicDegree(s.numeral));
    if (i < 0) return [];
    const bii = resolveNumeral('bII', key);
    const iChord = resolveNumeral(slots[i].numeral, key);
    return [{
      spiceId: 'phrygian-bite', spiceName: 'Phrygian ♭II',
      label: `${sym(iChord)} → ${sym(bii)} riff`,
      targetSlotId: slots[i].id,
      explanation:
        `${sym(bii)} sits one half step above home — the Jaws interval, stretched into a chord. That's Phrygian: ` +
        `instant menace, zero effort. Slayer, Sepultura and every soundtrack composer scoring a shark all live here. ` +
        `Chug ${sym(iChord)}, lurch up to ${sym(bii)}, fall back. Repeat until the pit opens.`,
      apply: () => ({ slots: insertAt(slots, i + 1, newSlot('bII', 1, { spiceId: 'phrygian-bite' })) }),
    }];
  },
};

const tritoneRiff: Spice = {
  id: 'tritone-riff',
  name: "Devil's interval",
  icon: '😈',
  blurb: 'Root to ♭5 — diabolus in musica.',
  find(slots, { key }) {
    if (!isMinorish(key.mode)) return [];
    if (slots.some((s) => { const p = parseNumeralParts(s.numeral); return p.degree === 5 && p.acc === -1; })) return [];
    const i = slots.findIndex((s) => isTonicDegree(s.numeral));
    if (i < 0) return [];
    const bv = resolveNumeral('bV5', key);
    const iChord = resolveNumeral(slots[i].numeral, key);
    return [{
      spiceId: 'tritone-riff', spiceName: "Devil's interval",
      label: `${sym(iChord)} → ${sym(bv)}`,
      targetSlotId: slots[i].id,
      explanation:
        `${L(iChord.root)} to ${L(bv.root)} is a tritone — "diabolus in musica," the interval medieval theory told ` +
        `you to avoid. Tony Iommi built Black Sabbath's first riff on it and invented a genre. ` +
        `It never resolves cleanly, which is exactly why it sounds like doom.`,
      apply: () => ({ slots: insertAt(slots, i + 1, newSlot('bV5', 1, { spiceId: 'tritone-riff' })) }),
    }];
  },
};

const harmonicMinorV: Spice = {
  id: 'harmonic-minor-v',
  name: 'Harmonic minor V',
  icon: '🧛',
  blurb: 'Raise the leading tone; give minor a real dominant.',
  find(slots, { key }) {
    if (!isMinorish(key.mode)) return [];
    const apps: SpiceApplication[] = [];
    slots.forEach((s, i) => {
      const p = parseNumeralParts(s.numeral);
      if (p.degree !== 5 || !p.lower || p.target || p.acc !== 0) return;
      const newNumeral = p.suffix === '7' ? 'V7' : 'V';
      const oldChord = resolveNumeral(s.numeral, key);
      const newChord = resolveNumeral(newNumeral, key);
      apps.push({
        spiceId: 'harmonic-minor-v', spiceName: 'Harmonic minor V',
        label: `${sym(oldChord)} → ${sym(newChord)}`,
        targetSlotId: s.id,
        explanation:
          `Natural minor's ${sym(oldChord)} is polite. Raise its middle note to ${toneLabel(newChord, 3)} and you get ` +
          `${sym(newChord)} — a real dominant with a leading tone that *insists* on ${L(key.tonic)}. ` +
          `That one raised note is the entire reason harmonic minor exists. Instant drama; metal and flamenco approved.`,
        apply: () => ({ slots: replaceAt(slots, i, newSlot(newNumeral, s.bars, { spiceId: 'harmonic-minor-v' })) }),
      });
    });
    return apps;
  },
};

const deceptiveCadence: Spice = {
  id: 'deceptive-cadence',
  name: 'Deceptive cadence',
  icon: '🪤',
  blurb: 'Promise them home; deliver the relative minor.',
  find(slots, { key }) {
    const apps: SpiceApplication[] = [];
    for (let i = 0; i < slots.length - 1; i++) {
      const cur = parseNumeralParts(slots[i].numeral);
      if (cur.degree !== 5 || cur.lower || cur.target || cur.acc !== 0) continue;
      if (!isTonicDegree(slots[i + 1].numeral)) continue;
      const replNumeral = isMinorish(key.mode) ? 'bVI' : 'vi';
      const v = resolveNumeral(slots[i].numeral, key);
      const home = resolveNumeral(slots[i + 1].numeral, key);
      const decep = resolveNumeral(replNumeral, key);
      apps.push({
        spiceId: 'deceptive-cadence', spiceName: 'Deceptive cadence',
        label: `${sym(v)} → ${sym(decep)} (not ${sym(home)})`,
        targetSlotId: slots[i + 1].id,
        explanation:
          `${sym(v)} promises ${sym(home)}; you deliver ${sym(decep)} — same neighborhood, wrong house. ` +
          `Two of the three notes your ear pre-ordered are still there, which is exactly why the trick lands. ` +
          `The deceptive cadence keeps the story going when everyone thought the chapter was over.`,
        apply: () => ({
          slots: replaceAt(slots, i + 1, newSlot(replNumeral, slots[i + 1].bars, { spiceId: 'deceptive-cadence', annotation: 'gotcha' })),
        }),
      });
      break;
    }
    return apps;
  },
};

const chromaticMediant: Spice = {
  id: 'chromatic-mediant',
  name: 'Chromatic mediant',
  icon: '🎬',
  blurb: 'The film-score jump-cut: chords a major third apart.',
  find(slots, { key }) {
    const apps: SpiceApplication[] = [];
    const minor = isMinorish(key.mode);
    slots.forEach((s, i) => {
      if (!isTonicDegree(s.numeral)) return;
      const options = minor ? ['bvi', 'III'] : ['bVI', 'III'];
      for (const opt of options) {
        const next = slots[i + 1];
        if (next && parseNumeralParts(next.numeral).degree === parseNumeralParts(opt).degree) continue;
        const home = resolveNumeral(s.numeral, key);
        const jump = resolveNumeral(opt, key);
        apps.push({
          spiceId: 'chromatic-mediant', spiceName: 'Chromatic mediant',
          label: `${sym(home)} → ${sym(jump)} jump-cut`,
          targetSlotId: s.id,
          explanation:
            `${sym(home)} and ${sym(jump)} sit a major third apart and share exactly one note — no preparation, ` +
            `no diplomacy, just a harmonic jump-cut. Film composers keep this move in the glovebox: it reads as ` +
            `"the scenery changed" without a single dominant in sight.`,
          apply: () => ({ slots: insertAt(slots, i + 1, newSlot(opt, 1, { spiceId: 'chromatic-mediant' })) }),
        });
      }
    });
    return apps.slice(0, 2);
  },
};

const commonToneDim: Spice = {
  id: 'common-tone-dim',
  name: 'Common-tone dim',
  icon: '💎',
  blurb: 'A dim7 that sparkles around the tonic without leaving it.',
  find(slots, { key }) {
    if (isMinorish(key.mode)) return [];
    const apps: SpiceApplication[] = [];
    for (let i = 1; i < slots.length; i++) {
      if (!isTonicDegree(slots[i].numeral)) continue;
      const prevQ = resolveNumeral(slots[i - 1].numeral, key).quality.id;
      if (prevQ === 'dim7' || prevQ === 'dim') continue;
      const dim = resolveNumeral('#iio7', key);
      const home = resolveNumeral(slots[i].numeral, key);
      apps.push({
        spiceId: 'common-tone-dim', spiceName: 'Common-tone dim',
        label: `${sym(dim)} → ${sym(home)}`,
        targetSlotId: slots[i].id,
        explanation:
          `${sym(dim)} secretly contains ${L(home.root)} — your tonic's own root — while the other three voices ` +
          `lean a half step away and melt back. The bass can sit still and everything shimmers around it: ` +
          `the barbershop / old-Hollywood sparkle, also beloved by western swing.`,
        apply: () => ({ slots: insertAt(slots, i, newSlot('#iio7', 1, { spiceId: 'common-tone-dim' })) }),
      });
      break;
    }
    return apps;
  },
};

const neapolitan: Spice = {
  id: 'neapolitan',
  name: 'Neapolitan ♭II',
  icon: '🍦',
  blurb: 'The subdominant in a powdered wig, leaning onto V.',
  find(slots, { key }) {
    const apps: SpiceApplication[] = [];
    slots.forEach((s, i) => {
      const p = parseNumeralParts(s.numeral);
      if (p.degree !== 5 || p.lower || p.target || p.acc !== 0) return;
      if (i > 0) {
        const prev = parseNumeralParts(slots[i - 1].numeral);
        if (prev.degree === 2 && prev.acc === -1) return;
      }
      const bii = resolveNumeral('bII', key);
      const v = resolveNumeral(s.numeral, key);
      apps.push({
        spiceId: 'neapolitan', spiceName: 'Neapolitan ♭II',
        label: `${sym(bii)} → ${sym(v)}`,
        targetSlotId: s.id,
        explanation:
          `${sym(bii)} is the Neapolitan: a major chord built a half step above home, doing the subdominant's job ` +
          `in a powdered wig. It leans onto ${sym(v)} from above and suddenly the chorus is an opera. ` +
          `(Classically it appears in first inversion; in a band, root position just means more menace.)`,
        apply: () => ({ slots: insertAt(slots, i, newSlot('bII', 1, { spiceId: 'neapolitan' })) }),
      });
    });
    return apps.slice(0, 1);
  },
};

const minorDeflation: Spice = {
  id: 'minor-deflation',
  name: 'Deflated dominant',
  icon: '🎈',
  blurb: 'Let the air out of the V.',
  find(slots, { key }) {
    const apps: SpiceApplication[] = [];
    slots.forEach((s, i) => {
      const p = parseNumeralParts(s.numeral);
      if (p.degree !== 5 || p.lower || p.target || p.acc !== 0) return;
      if (p.suffix !== '' && p.suffix !== '7') return;
      const newNumeral = p.suffix === '7' ? 'v7' : 'v';
      const before = resolveNumeral(s.numeral, key);
      const after = resolveNumeral(newNumeral, key);
      apps.push({
        spiceId: 'minor-deflation', spiceName: 'Deflated dominant',
        label: `${sym(before)} → ${sym(after)}`,
        targetSlotId: s.id,
        explanation:
          `Take the leading tone out of ${sym(before)} and it stops insisting — ${sym(after)} resolves by slouch ` +
          `instead of snap. That one lowered note (${toneLabel(before, 3)}→${toneLabel(after, 3)}) is the overcast ` +
          `sky over half the indie canon.`,
        apply: () => ({ slots: replaceAt(slots, i, newSlot(newNumeral, s.bars, { spiceId: 'minor-deflation' })) }),
      });
    });
    return apps.slice(0, 1);
  },
};

export const SPICES: Record<SpiceId, Spice> = {
  'deceptive-cadence': deceptiveCadence,
  'chromatic-mediant': chromaticMediant,
  'common-tone-dim': commonToneDim,
  'neapolitan': neapolitan,
  'minor-deflation': minorDeflation,
  'secondary-dominant': secondaryDominant,
  'borrowed-iv': borrowedIv,
  'flat-seven': flatSeven,
  'mario': mario,
  'tritone-sub': tritoneSub,
  'extensions': extensions,
  'sus-tension': susTension,
  'passing-dim': passingDim,
  'picardy': picardy,
  'andalusian': andalusian,
  'truck-driver': truckDriver,
  'backdoor': backdoor,
  'half-step-slide': halfStepSlide,
  'line-cliche': lineCliche,
  'pedal-point': pedalPoint,
  'phrygian-bite': phrygianBite,
  'tritone-riff': tritoneRiff,
  'harmonic-minor-v': harmonicMinorV,
};

/** Subtle spices: color and quality changes, no structural surgery. */
export const GENTLE_SPICES: ReadonlySet<SpiceId> = new Set<SpiceId>([
  'extensions', 'sus-tension', 'borrowed-iv', 'minor-deflation', 'picardy', 'harmonic-minor-v',
]);

/** Bold spices: structural moves that earn their keep at high heat. */
export const BOLD_SPICES: ReadonlySet<SpiceId> = new Set<SpiceId>([
  'secondary-dominant', 'tritone-sub', 'chromatic-mediant', 'neapolitan', 'passing-dim',
  'half-step-slide', 'deceptive-cadence', 'andalusian', 'mario', 'line-cliche', 'backdoor',
  'common-tone-dim', 'tritone-riff', 'phrygian-bite', 'flat-seven', 'pedal-point',
]);

/** All applications available right now, given a genre's allowed spice list. */
export function findAllApplications(
  slots: Slot[], ctx: SpiceContext, allowed: SpiceId[],
): SpiceApplication[] {
  const out: SpiceApplication[] = [];
  for (const id of allowed) {
    try {
      out.push(...SPICES[id].find(slots, ctx));
    }
    catch {
      // a malformed numeral in one spice should never take down the rack
    }
  }
  return out;
}

/** Weighted-random pick for the big red Spice button, avoiding repeats. */
export function pickRandomApplication(
  slots: Slot[], ctx: SpiceContext, allowed: SpiceId[], lastSpiceId?: SpiceId,
): SpiceApplication | undefined {
  const apps = findAllApplications(slots, ctx, allowed);
  if (!apps.length) return undefined;
  const fresh = apps.filter((a) => a.spiceId !== lastSpiceId);
  const pool = fresh.length ? fresh : apps;
  // group by spice so prolific spices don't dominate the dice
  const bySpice = new Map<SpiceId, SpiceApplication[]>();
  for (const a of pool) {
    const list = bySpice.get(a.spiceId) ?? [];
    list.push(a);
    bySpice.set(a.spiceId, list);
  }
  const spiceIds = [...bySpice.keys()];
  const chosen = bySpice.get(spiceIds[Math.floor(Math.random() * spiceIds.length)])!;
  return chosen[Math.floor(Math.random() * chosen.length)];
}
