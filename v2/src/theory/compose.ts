// The compose engine: builds progressions from a functional grammar
// (home → motion → tension → release) instead of canned templates. Genre
// flavor comes from two places: the key's own diatonic/borrowed chord pools,
// and bigram counts mined from the genre's real templates, so a composed
// synthwave loop leans ♭VI–♭VII and a composed lofi loop leans ii7–V7.

import { Key, isMinorish } from './scales';
import { coreToString, parseNumeralParts, resolveNumeral, secondaryDominantOf, withSuffix } from './roman';
import { borrowShelf, diatonicPalette } from './progression';
import { SUFFIX_OF } from './spices';
import { Genre } from '../data/genres';

export type CadenceId = 'auto' | 'authentic' | 'plagal' | 'deceptive' | 'half' | 'loop';

export interface ComposeOptions {
  genre: Genre;
  key: Key;
  length: 4 | 6 | 8;
  heat: 1 | 2 | 3;
  cadence: CadenceId;
  startOnTonic: boolean;
}

export interface ComposedResult {
  name: string;
  numerals: string[];
  bars: number[];
  planText: string;
  cadence: Exclude<CadenceId, 'auto'>;
}

type Func = 'T' | 'Tc' | 'PD' | 'D';

interface Cand {
  numeral: string;
  core: string;
  func: Func;
  degree: number;
  weight: number;
  borrowed?: boolean;
}

const CADENCE_SENTENCES: Record<Exclude<CadenceId, 'auto'>, string> = {
  authentic: 'It closes with the oldest gravity in music: V falling onto home.',
  plagal: 'It closes the church way — the IV settles onto home with no leading tone at all (the amen cadence).',
  deceptive: 'It sets up V→I and hands you the relative minor instead: the deceptive cadence, music’s best plot twist.',
  half: 'It parks on V — a question mark. The repeat is the answer.',
  loop: 'It never resolves on purpose — the pull back to the top IS the hook.',
};

const FUNC_WORD: Record<string, string> = {
  tonic: 'home', subdominant: 'motion', dominant: 'tension',
  borrowed: 'shadow', secondary: 'pull',
};

const LOOPY_GENRES = new Set([
  'funk', 'reggae', 'thrash', 'synthwave', 'shoegaze', 'vaporwave', 'surf', 'grunge',
]);

const MAJOR_ADJ = ['Golden', 'Glass', 'Peach', 'Sunlit', 'Marigold', 'Saltwater', 'Polaroid', 'Honeydew'];
const MINOR_ADJ = ['Velvet', 'Indigo', 'Smoke', 'Iron', 'Midnight', 'Cinder', 'Ultraviolet', 'Static'];
const NOUNS = ['Loop', 'Avenue', 'Turnaround', 'Spiral', 'Tide', 'Engine', 'Postcard', 'Orbit', 'Corridor', 'Diorama'];

const rand = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function pickWeighted(cands: Cand[], boost: (c: Cand) => number): Cand {
  const weights = cands.map((c) => Math.max(0.01, c.weight * boost(c)));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

const coreOf = (numeral: string): string => coreToString(parseNumeralParts(numeral));

/** bigram counts (core→core) mined from the genre's templates in this mode */
function mineBigrams(genre: Genre, mode: Key['mode']): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const t of genre.templates) {
    if (t.mode !== mode) continue;
    const cores = t.numerals.map(coreOf);
    for (let i = 0; i < cores.length; i++) {
      const a = cores[i];
      const b = cores[(i + 1) % cores.length]; // include the loop-around
      const row = out.get(a) ?? new Map<string, number>();
      row.set(b, (row.get(b) ?? 0) + 1);
      out.set(a, row);
    }
  }
  return out;
}

const SHELF_FUNC: Record<string, Func> = {
  iv: 'PD', bVII: 'D', bVI: 'PD', bIII: 'Tc', bII: 'PD', V7: 'D', IV: 'PD', bVII7: 'D',
};

interface Pools {
  T: Cand;
  Tc: Cand[];
  PD: Cand[];
  D: Cand[];
  all: Cand[];
}

function buildPools(genre: Genre, key: Key, heat: 1 | 2 | 3): Pools {
  const jazzy = genre.flavor.ladder.maj === 'maj7' || genre.flavor.ladder.min === 'm7' || genre.flavor.ladder.min === 'm9';
  const cands: Cand[] = [];
  for (const entry of diatonicPalette(key)) {
    const parts = parseNumeralParts(entry.numeral);
    const numeral = jazzy ? entry.seventhNumeral : entry.numeral;
    const base: Cand = {
      numeral, core: coreToString(parts), degree: parts.degree, weight: 1,
      func: parts.degree === 1 ? 'T' : parts.degree === 3 || parts.degree === 6 ? 'Tc'
        : parts.degree === 2 || parts.degree === 4 ? 'PD' : 'D',
    };
    if (entry.chord.quality.id === 'dim') base.weight = 0.25;
    else if (parts.degree === 3) base.weight = 0.45;
    else if (parts.degree === 6) base.weight = 0.65;
    else if (parts.degree === 2) base.weight = 0.8;
    else if (parts.degree === 7) base.weight = 0.3;
    cands.push(base);
  }
  if (heat >= 2) {
    for (const shelf of borrowShelf(key)) {
      const func = SHELF_FUNC[shelf.numeral];
      if (!func) continue;
      const parts = parseNumeralParts(shelf.numeral);
      if (cands.some((c) => c.core === coreToString(parts) && c.numeral === shelf.numeral)) continue;
      cands.push({
        numeral: shelf.numeral, core: coreToString(parts), degree: parts.degree,
        func, weight: heat === 3 ? 0.7 : 0.45, borrowed: true,
      });
    }
  }
  // a real dominant for minor keys even at heat 1 (it's convention, not spice)
  if (isMinorish(key.mode) && !cands.some((c) => c.degree === 5 && c.numeral.startsWith('V'))) {
    cands.push({ numeral: jazzy ? 'V7' : 'V', core: 'V', degree: 5, func: 'D', weight: 0.9 });
  }
  const T = cands.find((c) => c.func === 'T')!;
  return {
    T,
    Tc: cands.filter((c) => c.func === 'Tc'),
    PD: cands.filter((c) => c.func === 'PD'),
    D: cands.filter((c) => c.func === 'D'),
    all: cands,
  };
}

/** ladder a numeral up one rung (heat-3 jazz dressing) */
function dressUp(numeral: string, genre: Genre, key: Key): string {
  const parts = parseNumeralParts(numeral);
  const q = resolveNumeral(numeral, key).quality.id;
  // a functioning V must stay dominant — never let the ladder hand it a maj7
  if (parts.degree === 5 && !parts.lower && !parts.target && q === 'maj') {
    return withSuffix(numeral, '7');
  }
  const up = genre.flavor.ladder[q];
  const suffix = up && SUFFIX_OF[up];
  return suffix ? withSuffix(numeral, suffix) : numeral;
}

function resolveCadence(cadence: CadenceId, genre: Genre): Exclude<CadenceId, 'auto'> {
  if (cadence !== 'auto') return cadence;
  const r = Math.random();
  if (LOOPY_GENRES.has(genre.id)) {
    return r < 0.6 ? 'loop' : r < 0.8 ? 'half' : 'plagal';
  }
  return r < 0.5 ? 'authentic' : r < 0.75 ? 'loop' : r < 0.9 ? 'plagal' : 'deceptive';
}

export function composeProgression(opts: ComposeOptions): ComposedResult {
  const { genre, key, heat } = opts;
  const cadence = resolveCadence(opts.cadence, genre);
  const pools = buildPools(genre, key, heat);
  const bigrams = mineBigrams(genre, key.mode);
  const jazzy = genre.flavor.ladder.maj === 'maj7' || genre.flavor.ladder.min === 'm7' || genre.flavor.ladder.min === 'm9';

  const big = (prev: string | undefined, core: string): number =>
    prev ? (bigrams.get(prev)?.get(core) ?? 0) : 0;

  const pick = (pool: Cand[], prevCore: string | undefined, avoidCore?: string): Cand => {
    const usable = pool.filter((c) => c.core !== prevCore && c.core !== avoidCore);
    const from = usable.length ? usable : pool;
    return pickWeighted(from, (c) => 1 + 2.5 * big(prevCore, c.core));
  };

  // function plan for one phrase of n slots ending with `tail` literal funcs
  const phrase = (n: number, tail: ('PD' | 'D' | 'PD4' | 'T' | 'DEC' | 'V' | 'NONT')[]): string[] => {
    const out: string[] = [];
    let prevCore: string | undefined;
    const fillCount = n - tail.length;
    for (let i = 0; i < fillCount; i++) {
      let cand: Cand;
      if (i === 0) {
        cand = opts.startOnTonic ? pools.T : pick([...pools.Tc, ...pools.PD], undefined);
      }
      else {
        const prevFunc = out.length ? funcOfCore(prevCore!) : 'T';
        const menu: Cand[] =
          prevFunc === 'T' ? [...pools.Tc, ...pools.PD, ...pools.D.map((d) => ({ ...d, weight: d.weight * 0.4 }))]
          : prevFunc === 'Tc' ? [...pools.PD, ...pools.D.map((d) => ({ ...d, weight: d.weight * 0.5 }))]
          : prevFunc === 'PD' ? [...pools.D, ...pools.PD.map((p) => ({ ...p, weight: p.weight * 0.4 })), { ...pools.T, weight: 0.35 }]
          : [{ ...pools.T, weight: 1 }, ...pools.Tc, ...pools.PD.map((p) => ({ ...p, weight: p.weight * 0.5 }))];
        cand = pick(menu, prevCore);
      }
      out.push(cand.numeral);
      prevCore = cand.core;
    }
    for (const t of tail) {
      let numeral: string;
      if (t === 'PD') numeral = pick(pools.PD, prevCore).numeral;
      else if (t === 'PD4') {
        const fours = pools.PD.filter((c) => c.degree === 4);
        numeral = pick(fours.length ? fours : pools.PD, prevCore).numeral;
      }
      else if (t === 'D') {
        // cadential D must be a functional dominant — bVII7 etc. is a backdoor, not a cadence
        const functional = pools.D.filter((c) => !c.borrowed);
        numeral = pick(functional.length ? functional : pools.D, prevCore).numeral;
      }
      else if (t === 'T') numeral = pools.T.numeral;
      else if (t === 'V') numeral = jazzy ? 'V7' : 'V';
      else if (t === 'DEC') numeral = isMinorish(key.mode) ? (jazzy ? 'bVImaj7' : 'bVI') : (jazzy ? 'vi7' : 'vi');
      else { // NONT: dominant-ish, never home
        const nonT = [...pools.D, ...pools.PD.filter((c) => c.borrowed)];
        numeral = pick(nonT.length ? nonT : pools.D, prevCore).numeral;
      }
      out.push(numeral);
      prevCore = coreOf(numeral);
    }
    return out;
  };

  const funcOfCore = (core: string): Func => {
    const hit = pools.all.find((c) => c.core === core);
    return hit?.func ?? 'PD';
  };

  const tailFor = (c: Exclude<CadenceId, 'auto'>): ('PD' | 'D' | 'PD4' | 'T' | 'DEC' | 'V' | 'NONT')[] =>
    c === 'authentic' ? ['PD', 'D', 'T']
    : c === 'plagal' ? ['PD4', 'T']
    : c === 'deceptive' ? ['PD', 'D', 'DEC']
    : c === 'half' ? ['PD', 'V']
    : ['PD', 'NONT'];

  let numerals: string[];
  let isPeriod = false;
  if (opts.length === 8) {
    // antecedent / consequent: question ends on V, answer ends with the cadence
    isPeriod = true;
    numerals = [...phrase(4, ['PD', 'V']), ...phrase(4, tailFor(cadence === 'half' ? 'authentic' : cadence))];
  }
  else {
    numerals = phrase(opts.length, tailFor(cadence));
  }

  // heat-3 dressing: ladder some chords up a rung
  if (heat === 3) {
    numerals = numerals.map((n) => (Math.random() < 0.45 ? dressUp(n, genre, key) : n));
  }

  // heat-3 secondary dominants: insert pull before 1–2 mid-progression targets
  const secondaries: { dom: string; target: string }[] = [];
  if (heat === 3) {
    const maxInserts = opts.length === 8 ? 2 : 1;
    for (let tries = 0; tries < 6 && secondaries.length < maxInserts; tries++) {
      const i = 1 + Math.floor(Math.random() * (numerals.length - 2));
      const parts = parseNumeralParts(numerals[i]);
      if (parts.target || parts.degree === 1) continue;
      const q = resolveNumeral(numerals[i], key).quality.id;
      if (q === 'dim' || q === 'dim7' || q === 'm7b5') continue;
      const dom = secondaryDominantOf(numerals[i], genre.flavor.dominantFlavor);
      if (coreOf(numerals[i - 1]) === coreOf(dom)) continue;
      numerals.splice(i, 0, dom);
      secondaries.push({ dom, target: numerals[i + 1] });
    }
  }

  // plan text
  const resolved = numerals.map((n) => resolveNumeral(n, key));
  const words = resolved.map((c) => FUNC_WORD[c.func] ?? c.func);
  const skeleton = isPeriod
    ? 'Question phrase ends on the V; answer phrase brings it home — a classic period.'
    : `Skeleton: ${words.join(' → ')}.`;
  const borrowedOnes = numerals.filter((_, i) => resolved[i].func === 'borrowed');
  const extras: string[] = [];
  if (borrowedOnes.length) extras.push(`Borrowed ${borrowedOnes.map((b) => prettyish(b)).join(', ')} for shadow.`);
  for (const s of secondaries) {
    extras.push(`${prettyish(s.dom)} is a hired gun aimed straight at ${prettyish(s.target)}.`);
  }
  const planText = [skeleton, CADENCE_SENTENCES[cadence], ...extras].join(' ');

  const name = `${rand(isMinorish(key.mode) ? MINOR_ADJ : MAJOR_ADJ)} ${rand(NOUNS)}`;

  return { name, numerals, bars: numerals.map(() => 1), planText, cadence };
}

const prettyish = (numeral: string): string =>
  numeral.replace(/b(?=[IViv])/g, '♭').replace(/#(?=[IViv])/g, '♯');
