// The chord "autocomplete": next-chord candidates ranked by a corpus of
// classic changes plus functional-harmony fallbacks, an auto-finish that
// walks the corpus into a cadence, a mood-seeded dice generator, and
// spice substitutions for a selected chord.

import { PRESETS } from '../data/presets';
import {
  ChordInfo, KeySig, ModeId, diatonicPalette, numeralCore, prettyNumeral,
  resolveRoman, secondaryDominantOf, tritoneSubOf,
} from './harmony';
import { Rng, pick, pickWeighted } from '../lib/rng';

export type Lane = 'stable' | 'motion' | 'tension' | 'color';

export interface Candidate {
  token: string;
  label: string;
  symbol: string;
  why: string;
  lane: Lane;
}

type Family = 'majorish' | 'minorish';
export const familyOf = (mode: ModeId): Family =>
  mode === 'minor' || mode === 'dorian' || mode === 'phrygian' ? 'minorish' : 'majorish';

// ---------------------------------------------------------------------------
// Corpus: preset changes plus a few extra standards, mined into bigrams.

const EXTRA_CORPUS: Record<Family, string[][]> = {
  majorish: [
    ['I', 'IV', 'vi', 'V'],
    ['I', 'iii', 'IV', 'V'],
    ['I', 'V', 'IV', 'V'],
    ['vi', 'V', 'IV', 'V'],
    ['I', 'bVII', 'IV', 'I'],
    ['Imaj7', 'IVmaj7', 'iii7', 'vi7'],
    ['ii7', 'V7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7'],
    ['I', 'V/vi', 'vi', 'IV'],
    ['I', 'I7', 'IV', 'iv'],
  ],
  minorish: [
    ['i', 'iv', 'V7', 'i'],
    ['i', 'bVI', 'bVII', 'i'],
    ['i', 'bIII', 'bVII', 'iv'],
    ['i', 'iv', 'bVII', 'bIII'],
    ['i7', 'iv7', 'bVI', 'V7'],
    ['i', 'bII', 'V7', 'i'],
    ['i', 'v', 'bVI', 'bVII'],
  ],
};

interface Bigram {
  /** follower token -> weight */
  follows: Map<string, number>;
}

function buildBigrams(): Record<Family, Map<string, Bigram>> {
  const out: Record<Family, Map<string, Bigram>> = { majorish: new Map(), minorish: new Map() };
  const feed = (family: Family, tokens: string[]) => {
    const table = out[family];
    for (let i = 0; i < tokens.length; i++) {
      const from = numeralCore(tokens[i]);
      const to = tokens[(i + 1) % tokens.length]; // progressions loop
      const entry = table.get(from) ?? { follows: new Map() };
      entry.follows.set(to, (entry.follows.get(to) ?? 0) + 1);
      table.set(from, entry);
    }
  };
  for (const preset of PRESETS) feed(familyOf(preset.mode), preset.tokens.map((t) => t.t));
  for (const family of ['majorish', 'minorish'] as Family[]) {
    for (const seq of EXTRA_CORPUS[family]) feed(family, seq);
  }
  return out;
}

const BIGRAMS = buildBigrams();

// ---------------------------------------------------------------------------
// Borrow shelf: idiomatic out-of-key colors per mode, with the why attached.

interface ShelfEntry { token: string; hook: string }

const SHELVES: Record<ModeId, ShelfEntry[]> = {
  major: [
    { token: 'iv', hook: 'The bittersweet IV, borrowed from the parallel minor.' },
    { token: 'bVII', hook: 'The rock & roll back door.' },
    { token: 'bVI', hook: 'Epic lift, borrowed darkness.' },
  ],
  lydian: [
    { token: 'iv', hook: 'Cancel the ♯4 and grieve a little.' },
    { token: 'bVII', hook: 'Ground the float with a plain-clothes chord.' },
    { token: 'I7', hook: 'Tip the shimmer toward the blues.' },
  ],
  mixolydian: [
    { token: 'V7', hook: 'Borrow the leading tone back for a real cadence.' },
    { token: 'iv', hook: 'Parallel-minor rain.' },
    { token: 'bVI', hook: 'One more flat than you own.' },
  ],
  minor: [
    { token: 'V7', hook: 'Raise the leading tone — harmonic-minor gravity.' },
    { token: 'IV', hook: 'Major IV from Dorian, a hopeful lift.' },
    { token: 'bII', hook: 'Neapolitan menace a half step above home.' },
  ],
  dorian: [
    { token: 'V7', hook: 'Real dominant gravity when the vamp needs an exit.' },
    { token: 'bVI', hook: 'Aeolian shadow when Dorian gets too sunny.' },
    { token: 'bII', hook: 'A pinch of Phrygian menace.' },
  ],
  phrygian: [
    { token: 'V7', hook: 'Harmonic gravity smuggled into the dungeon.' },
    { token: 'IV', hook: 'Dorian sunshine through the bars.' },
    { token: 'I', hook: 'Picardy third — the dungeon door opens.' },
  ],
};

// ---------------------------------------------------------------------------
// Next-chord candidates.

const laneOf = (chord: ChordInfo): Lane =>
  chord.func === 'tonic' ? 'stable'
    : chord.func === 'subdominant' ? 'motion'
      : chord.func === 'borrowed' ? 'color' : 'tension';

function tryCandidate(token: string, key: KeySig, why: string, lane?: Lane): Candidate | undefined {
  try {
    const chord = resolveRoman(token, key);
    return { token, label: prettyNumeral(chord.numeral ?? token), symbol: chord.symbol, why, lane: lane ?? laneOf(chord) };
  }
  catch {
    return undefined;
  }
}

const tonicToken = (key: KeySig): string => (familyOf(key.mode) === 'minorish' ? 'i' : 'I');

/** Line cliché continuations: i → imaj7 → i7 → i6. */
const CLICHE_NEXT: Record<string, string> = { i: 'imaj7', imaj7: 'i7', i7: 'i6' };

export function nextCandidates(last: ChordInfo | undefined, key: KeySig): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (c: Candidate | undefined) => {
    if (!c) return;
    const id = c.symbol;
    if (seen.has(id) || (last && c.symbol === last.symbol)) return;
    seen.add(id);
    out.push(c);
  };

  if (!last) {
    const palette = diatonicPalette(key, false);
    add(tryCandidate(tonicToken(key), key, 'Start at home so every color reads against it.'));
    for (const entry of palette.slice(1, 6)) {
      add(tryCandidate(entry.numeral, key, 'Start away from home and let the loop find it.'));
    }
    return out.slice(0, 6);
  }

  // 1. a secondary dominant wants its target
  if (last.secondaryOf) {
    add(tryCandidate(last.secondaryOf, key, 'Resolve the temporary dominant into its target.', 'stable'));
  }

  // 2. corpus: what the classics actually do next
  const core = last.numeral ? numeralCore(last.numeral) : undefined;
  if (core) {
    const entry = BIGRAMS[familyOf(key.mode)].get(core);
    if (entry) {
      const ranked = [...entry.follows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [token, count] of ranked) {
        add(tryCandidate(token, key,
          count > 1 ? `What ${prettyNumeral(core)} does next in ${count} classic changes.` : `A move borrowed from the classics.`));
      }
    }
    const cliche = CLICHE_NEXT[last.numeral ?? ''];
    if (cliche) add(tryCandidate(cliche, key, 'Continue the line cliché — the inner voice walks down.', 'color'));
  }

  // 3. functional fallbacks
  const fivish = familyOf(key.mode) === 'minorish' ? 'V7' : 'V';
  switch (last.func) {
    case 'tonic':
      add(tryCandidate('IV', key, 'Open the phrase with predominant motion.'));
      add(tryCandidate('ii7', key, 'A smoother predominant setup before the dominant.'));
      add(tryCandidate(fivish, key, 'Move straight into tension.'));
      break;
    case 'subdominant':
      add(tryCandidate(fivish, key, 'Predominant into dominant is the cleanest setup.'));
      add(tryCandidate(tonicToken(key), key, 'Plagal release back to home.'));
      break;
    case 'dominant':
    case 'secondary':
      add(tryCandidate(tonicToken(key), key, 'Resolve the pull back to the home chord.'));
      add(tryCandidate(familyOf(key.mode) === 'minorish' ? 'bVI' : 'vi', key,
        'Dodge the expected landing — the deceptive cadence.', 'color'));
      break;
    case 'borrowed':
      add(tryCandidate(tonicToken(key), key, 'Let the borrowed color settle back into the key.'));
      add(tryCandidate(fivish, key, 'Turn the color into forward pressure.'));
      break;
  }

  // 4. spice lane
  const vi = familyOf(key.mode) === 'minorish' ? 'iv' : 'vi';
  const secondary = secondaryDominantOf(vi);
  if (secondary) add(tryCandidate(secondary, key, `Aim a temporary dominant at ${prettyNumeral(vi)}.`, 'color'));
  if (last.func === 'dominant') {
    const sub = tritoneSubOf('I');
    if (sub) add(tryCandidate(sub, key, 'Same tritone, half-step slide home.', 'color'));
  }
  for (const shelf of SHELVES[key.mode]) add(tryCandidate(shelf.token, key, shelf.hook, 'color'));

  return out.slice(0, 9);
}

// ---------------------------------------------------------------------------
// Auto-finish: continue the user's progression to a cadence.

const CADENCE_TAILS: Record<Family, string[][]> = {
  majorish: [
    ['IV', 'V', 'I'],
    ['ii7', 'V7', 'Imaj7'],
    ['IV', 'iv', 'I'],
    ['iv7', 'bVII7', 'Imaj7'],
    ['IV', 'V', 'vi'],
  ],
  minorish: [
    ['iv', 'V7', 'i'],
    ['bVI', 'bVII', 'i'],
    ['bII', 'V7', 'i'],
    ['iiø7', 'V7', 'i'],
  ],
};

function walkNext(coreFrom: string, family: Family, rng: Rng, avoid: string): string {
  const entry = BIGRAMS[family].get(coreFrom);
  const fallback: [string, number][] = family === 'minorish'
    ? [['iv', 2], ['bVI', 2], ['bVII', 2], ['V7', 1], ['i', 1]]
    : [['IV', 2], ['V', 2], ['vi', 2], ['ii7', 1], ['I', 1]];
  const pool: [string, number][] = entry
    ? [...entry.follows.entries()].filter(([t]) => numeralCore(t) !== avoid)
    : [];
  const usable = pool.length ? pool : fallback.filter(([t]) => numeralCore(t) !== avoid);
  return pickWeighted(rng, usable.length ? usable : fallback);
}

/**
 * Extend `tokens` to a phrase that lands with a cadence. Returns only the
 * appended tokens. Length lands on the next multiple of 4 (at least +2).
 */
export function autoFinish(tokens: string[], key: KeySig, rng: Rng): string[] {
  const family = familyOf(key.mode);
  const target = Math.max(tokens.length + 2, Math.ceil((tokens.length + 1) / 4) * 4);
  const tail = pick(rng, CADENCE_TAILS[family]);
  const added: string[] = [];
  let lastCore = tokens.length ? numeralCore(tokens[tokens.length - 1]) : (family === 'minorish' ? 'i' : 'I');
  const walkSlots = Math.max(0, target - tokens.length - tail.length);
  for (let i = 0; i < walkSlots; i++) {
    const next = walkNext(lastCore, family, rng, lastCore);
    added.push(next);
    lastCore = numeralCore(next);
  }
  // avoid stuttering into the tail
  const usableTail = numeralCore(tail[0]) === lastCore ? tail.slice(1) : tail;
  added.push(...usableTail);
  return added;
}

// ---------------------------------------------------------------------------
// Dice: roll a fresh progression from a mood.

export type Mood = 'bright' | 'wistful' | 'dark' | 'dreamy' | 'gritty' | 'tense';

export const MOODS: { id: Mood; label: string; blurb: string }[] = [
  { id: 'bright', label: 'Bright', blurb: 'major, wide open' },
  { id: 'wistful', label: 'Wistful', blurb: 'sevenths and soft landings' },
  { id: 'dark', label: 'Dark', blurb: 'minor gravity' },
  { id: 'dreamy', label: 'Dreamy', blurb: 'lydian float' },
  { id: 'gritty', label: 'Gritty', blurb: 'mixolydian swagger' },
  { id: 'tense', label: 'Tense', blurb: 'half steps and pull' },
];

interface MoodSpec {
  mode: ModeId;
  skeletons: string[][];
  seventhChance: number;
  spiceChance: number;
}

const MOOD_SPECS: Record<Mood, MoodSpec> = {
  bright: {
    mode: 'major', seventhChance: 0.15, spiceChance: 0.2,
    skeletons: [
      ['I', 'V', 'vi', 'IV'], ['I', 'IV', 'V', 'IV'], ['I', 'vi', 'IV', 'V'],
      ['I', 'iii', 'IV', 'V'], ['I', 'IV', 'I', 'V'],
    ],
  },
  wistful: {
    mode: 'major', seventhChance: 0.85, spiceChance: 0.3,
    skeletons: [
      ['I', 'vi', 'ii', 'V'], ['IV', 'V', 'iii', 'vi'], ['I', 'IV', 'iii', 'vi'],
      ['vi', 'IV', 'I', 'V'], ['I', 'ii', 'iii', 'IV'],
    ],
  },
  dark: {
    mode: 'minor', seventhChance: 0.25, spiceChance: 0.3,
    skeletons: [
      ['i', 'bVI', 'bIII', 'bVII'], ['i', 'bVII', 'bVI', 'V7'], ['i', 'iv', 'bVI', 'V7'],
      ['i', 'bVI', 'bVII', 'i'], ['i', 'v', 'bVI', 'bVII'],
    ],
  },
  dreamy: {
    mode: 'lydian', seventhChance: 0.7, spiceChance: 0.2,
    skeletons: [
      ['I', 'II', 'I', 'II'], ['I', 'II', 'vii', 'II'], ['I', 'V', 'II', 'I'],
    ],
  },
  gritty: {
    mode: 'mixolydian', seventhChance: 0.4, spiceChance: 0.25,
    skeletons: [
      ['I', 'bVII', 'IV', 'I'], ['I', 'IV', 'bVII', 'IV'], ['I7', 'IV7', 'I7', 'V7'],
      ['I', 'bVII', 'v', 'IV'],
    ],
  },
  tense: {
    mode: 'minor', seventhChance: 0.35, spiceChance: 0.55,
    skeletons: [
      ['i', 'bII', 'i', 'V7'], ['i', 'viio7/i', 'i', 'bII'], ['i', 'bVI', 'V7', 'bII'],
      ['i', 'iv', 'bII', 'V7'],
    ],
  },
};

const SEVENTH_FORM: Record<string, string> = {
  I: 'Imaj7', IV: 'IVmaj7', V: 'V7', i: 'i7', iv: 'iv7', v: 'v7',
  ii: 'ii7', iii: 'iii7', vi: 'vi7', II: 'II7', bVII: 'bVII7', bVI: 'bVImaj7', bIII: 'bIIImaj7', bII: 'bIImaj7',
};

const validated = (token: string, key: KeySig): boolean => {
  try { resolveRoman(token, key); return true; }
  catch { return false; }
};

export interface DiceRoll {
  mode: ModeId;
  tokens: string[];
}

export function rollDice(mood: Mood, rng: Rng, doubleLength = false): DiceRoll {
  const spec = MOOD_SPECS[mood];
  const key: KeySig = { tonic: 'C', mode: spec.mode };
  let tokens = [...pick(rng, spec.skeletons)];
  if (doubleLength) {
    const second = [...pick(rng, spec.skeletons)];
    // vary the back half's ending so the 8 bars breathe
    second[second.length - 1] = pick(rng, familyOf(spec.mode) === 'minorish' ? ['V7', 'bVII', 'iv'] : ['V', 'IV', 'vi']);
    tokens = [...tokens, ...second];
  }
  tokens = tokens.map((t) => {
    const seventh = SEVENTH_FORM[t];
    return seventh && rng() < spec.seventhChance && validated(seventh, key) ? seventh : t;
  });
  if (rng() < spec.spiceChance) {
    // aim a secondary dominant at one non-tonic chord
    const targets = tokens
      .map((t, i) => ({ core: numeralCore(t), i }))
      .filter(({ core, i }) => i > 0 && core !== 'I' && core !== 'i' && !tokens[i].includes('/'));
    if (targets.length) {
      const { core, i } = pick(rng, targets);
      const secondary = `V7/${core}`;
      if (validated(secondary, key)) tokens[i - 1] = secondary;
    }
  }
  return { mode: spec.mode, tokens };
}

// ---------------------------------------------------------------------------
// Spice: substitutions for one selected chord.

export interface Substitution {
  token: string;
  label: string;
  symbol: string;
  why: string;
}

export function spiceOptions(index: number, parsed: ChordInfo[], key: KeySig): Substitution[] {
  const current = parsed[index];
  const next = parsed[index + 1] ?? parsed[0];
  const out: Substitution[] = [];
  const seen = new Set<string>([current.symbol]);
  const add = (token: string | undefined, why: string) => {
    if (!token) return;
    try {
      const chord = resolveRoman(token, key);
      if (seen.has(chord.symbol)) return;
      seen.add(chord.symbol);
      out.push({ token, label: prettyNumeral(chord.numeral ?? token), symbol: chord.symbol, why });
    }
    catch { /* substitution doesn't spell in this key */ }
  };

  const core = current.numeral ? numeralCore(current.numeral) : undefined;
  if (core) {
    const seventh = SEVENTH_FORM[core];
    if (seventh && seventh !== current.numeral) add(seventh, 'Add the idiomatic seventh.');
    const flipped = core === core.toLowerCase()
      ? core.replace(/[iv]+$/, (m) => m.toUpperCase())
      : core.replace(/[IV]+$/, (m) => m.toLowerCase());
    add(flipped, 'Flip the quality — borrow the parallel color.');
    if (!current.numeral?.includes('sus')) {
      add(core + (current.numeral?.includes('7') && !current.numeral.includes('maj7') ? '7sus4' : 'sus4'),
        'Suspend the third and delay the color.');
    }
  }
  if (next.numeral) {
    add(secondaryDominantOf(numeralCore(next.numeral)), `Aim a temporary dominant at the next chord (${next.symbol}).`);
    if (current.func === 'dominant' || current.func === 'secondary') {
      add(tritoneSubOf(current.secondaryOf ?? numeralCore(next.numeral)), 'Tritone substitution — same pull, half-step bass slide.');
    }
  }
  if (familyOf(key.mode) === 'majorish' && (core === 'IV' || core === 'iv')) {
    add('bVII7', 'Trade it for the backdoor dominant.');
  }
  return out.slice(0, 5);
}
