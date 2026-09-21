// Fretboard fluency drills. The player this is for can already play a great
// deal — what's missing is instant retrieval of relationships: from this root,
// where is the 3rd? what is this dot, against that one? Fluency is speed, so
// these are short timed sprints, and whatever gets missed comes back more often.
//
// Cards are pure data: what's shown, what counts as right (as positions for a
// click, as pitches for a played note), and the one-line rule to take away.

import { mod12, noteLabel, spellPcSimple } from '../theory/notes';

export type FretDrillKind = 'interval' | 'degree' | 'chordtone' | 'unison' | 'note';

export interface FretPos {
  string: number;
  fret: number;
}

export interface FretCard {
  kind: FretDrillKind;
  prompt: string;
  /** dots drawn as part of the question */
  given: (FretPos & { label: string })[];
  /** every position that counts as right (empty for multiple-choice cards) */
  answers: FretPos[];
  /** label to print on the answers once revealed */
  answerLabel: string;
  /** pitches that count when the answer is played instead of clicked; pitch classes when `anyOctave` */
  answerMidis: number[];
  anyOctave: boolean;
  /** multiple choice ('degree' cards) */
  choices?: string[];
  correctChoice?: string;
  /** frets worth drawing attention to */
  window: { lo: number; hi: number };
  /** the rule behind the answer */
  explain: string;
  /** what this card exercises — misses are tallied under it */
  tag: string;
}

export const FRET_DRILLS: { id: FretDrillKind; icon: string; name: string; blurb: string }[] = [
  { id: 'interval', icon: '📐', name: 'Interval from a root', blurb: 'A root is lit — find the 3rd, the 5th, the ♭7 around it. Intervals are shapes; learn the shapes and every chord and lick opens up.' },
  { id: 'degree', icon: '🔢', name: 'Name that degree', blurb: 'Two dots: the root and a mystery note. What is it? The reverse of the first drill — recognition instead of recall.' },
  { id: 'chordtone', icon: '🎯', name: 'Chord tone in position', blurb: 'A chord and a five-fret box: find its root, 3rd or 5th without leaving the box. This is what "playing the changes" is made of.' },
  { id: 'unison', icon: '🪞', name: 'Same note, next string', blurb: 'Every note lives in several places. Find the same pitch one string over — five frets, except across G–B.' },
  { id: 'note', icon: '🔤', name: 'Note names', blurb: 'Find a named note on a named string. The letters matter less than the numbers — but roots have names.' },
];

interface IntervalDef { tag: string; semis: number; short: string; name: string; weight: number }

const INTERVALS: IntervalDef[] = [
  { tag: '♭2', semis: 1, short: '♭2', name: 'minor 2nd', weight: 0.4 },
  { tag: '2', semis: 2, short: '2', name: 'major 2nd', weight: 0.8 },
  { tag: '♭3', semis: 3, short: '♭3', name: 'minor 3rd', weight: 1.6 },
  { tag: '3', semis: 4, short: '3', name: 'major 3rd', weight: 1.8 },
  { tag: '4', semis: 5, short: '4', name: 'perfect 4th', weight: 1.1 },
  { tag: '♭5', semis: 6, short: '♭5', name: 'flat 5th', weight: 0.5 },
  { tag: '5', semis: 7, short: '5', name: 'perfect 5th', weight: 1.5 },
  { tag: '♭6', semis: 8, short: '♭6', name: 'minor 6th', weight: 0.5 },
  { tag: '6', semis: 9, short: '6', name: 'major 6th', weight: 0.9 },
  { tag: '♭7', semis: 10, short: '♭7', name: 'minor 7th', weight: 1.4 },
  { tag: '7', semis: 11, short: '7', name: 'major 7th', weight: 0.9 },
  { tag: '8', semis: 12, short: 'R', name: 'octave', weight: 1.3 },
];

export const DEGREE_CHOICES = INTERVALS.map((i) => i.short);

export interface DrillOptions {
  openMidi: number[];
  names: string[];
  maxFret: number;
  /** tag → times missed; missed things are dealt more often */
  misses?: Record<string, number>;
  preferFlat?: boolean;
}

function weighted<T>(items: T[], weightOf: (item: T) => number, rand: () => number): T {
  const total = items.reduce((a, x) => a + weightOf(x), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= weightOf(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

const positionsOf = (midi: number, o: DrillOptions, lo: number, hi: number): FretPos[] => {
  const out: FretPos[] = [];
  o.openMidi.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= Math.max(0, lo) && fret <= Math.min(o.maxFret, hi)) out.push({ string, fret });
  });
  return out;
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** An interval as a movement of the hand: strings over, frets along. */
export function shapeText(from: FretPos, to: FretPos, o: DrillOptions): string {
  const ds = to.string - from.string;
  const df = to.fret - from.fret;
  const along = df === 0 ? 'same fret' : `${plural(Math.abs(df), 'fret')} ${df > 0 ? 'toward the body' : 'back toward the nut'}`;
  if (ds === 0) return `same string, ${along}`;
  // the G→B pair is tuned a fret narrower than every other pair
  const third = o.openMidi.findIndex((m, i) => i > 0 && m - o.openMidi[i - 1] === 4);
  const crosses = third > 0 && Math.min(from.string, to.string) < third && Math.max(from.string, to.string) >= third;
  return `${plural(Math.abs(ds), 'string')} ${ds > 0 ? 'higher' : 'lower'}, ${along}${crosses ? ` — one fret further than usual, because it crosses onto the ${o.names[third]} string` : ''}`;
}

const nearest = (from: FretPos, list: FretPos[]): FretPos =>
  list.reduce((best, p) => (Math.abs(p.fret - from.fret) + Math.abs(p.string - from.string) * 0.4 < Math.abs(best.fret - from.fret) + Math.abs(best.string - from.string) * 0.4 ? p : best));

function pickInterval(o: DrillOptions, rand: () => number): IntervalDef {
  return weighted(INTERVALS, (i) => i.weight * (1 + 0.8 * Math.min(4, o.misses?.[i.tag] ?? 0)), rand);
}

/** A root somewhere playable, with room around it, whose interval has at least one reachable home. */
function rootAndTargets(iv: IntervalDef, o: DrillOptions, rand: () => number): { root: FretPos; targets: FretPos[] } {
  for (let tries = 0; tries < 40; tries++) {
    const string = Math.floor(rand() * (o.openMidi.length - 1));
    const fret = 1 + Math.floor(rand() * 10);
    const root = { string, fret };
    const targets = positionsOf(o.openMidi[string] + fret + iv.semis, o, fret - 4, fret + 5).filter((p) => p.string !== string || iv.semis <= 5);
    // only deal roots whose answer is a real hand shape — within three frets — not a trek up one string
    if (targets.some((t) => Math.abs(t.fret - fret) <= 3)) return { root, targets };
  }
  const root = { string: 0, fret: 5 };
  return { root, targets: positionsOf(o.openMidi[0] + 5 + iv.semis, o, 1, 10) };
}

export function makeCard(kind: FretDrillKind, o: DrillOptions, rand: () => number = Math.random): FretCard {
  const spell = (pc: number) => noteLabel(spellPcSimple(mod12(pc), o.preferFlat ? 'flat' : 'sharp'));

  if (kind === 'interval' || kind === 'degree') {
    const iv = pickInterval(o, rand);
    const { root, targets } = rootAndTargets(iv, o, rand);
    const close = nearest(root, targets);
    const window = { lo: Math.max(0, root.fret - 4), hi: Math.min(o.maxFret, root.fret + 5) };
    const explain = `${iv.name === 'octave' ? 'An octave' : `A ${iv.name}`} (${iv.short}) above a root: ${shapeText(root, close, o)}.`;
    if (kind === 'degree') {
      return {
        kind, tag: iv.tag, window, explain, anyOctave: false,
        prompt: 'What is the ringed note, counted from the root?',
        given: [{ ...root, label: 'R' }, { ...close, label: '?' }],
        answers: [], answerLabel: iv.short, answerMidis: [],
        choices: DEGREE_CHOICES, correctChoice: iv.short,
      };
    }
    return {
      kind, tag: iv.tag, window, explain, anyOctave: false,
      prompt: `Find the ${iv.name} (${iv.short}) above this root`,
      given: [{ ...root, label: 'R' }],
      answers: targets, answerLabel: iv.short,
      answerMidis: [o.openMidi[root.string] + root.fret + iv.semis],
    };
  }

  if (kind === 'chordtone') {
    const rootPc = Math.floor(rand() * 12);
    const minor = rand() < 0.4;
    const tones = [{ tag: 'R', semis: 0 }, { tag: minor ? '♭3' : '3', semis: minor ? 3 : 4 }, { tag: '5', semis: 7 }];
    const tone = weighted(tones, (t) => (t.tag === 'R' ? 0.6 : 1.3) * (1 + 0.8 * Math.min(4, o.misses?.[`ct:${t.tag}`] ?? 0)), rand);
    const lo = 1 + Math.floor(rand() * 9);
    const window = { lo, hi: lo + 4 };
    const pc = mod12(rootPc + tone.semis);
    const answers: FretPos[] = [];
    const given: FretCard['given'] = [];
    o.openMidi.forEach((open, string) => {
      for (let fret = window.lo; fret <= window.hi; fret++) {
        if (mod12(open + fret) === pc) answers.push({ string, fret });
        // the roots are the landmarks: shown, unless the root is what's being asked for
        else if (tone.semis !== 0 && mod12(open + fret) === rootPc) given.push({ string, fret, label: 'R' });
      }
    });
    const chord = `${spell(rootPc)}${minor ? 'm' : ''}`;
    return {
      kind, tag: `ct:${tone.tag}`, window, given, answers, answerLabel: tone.tag, anyOctave: true, answerMidis: [pc],
      prompt: `${chord}: find ${tone.tag === 'R' ? 'a root' : `the ${tone.tag === '5' ? '5th' : `${tone.tag}rd`}`} between frets ${window.lo} and ${window.hi}`,
      explain: `${chord} = ${spell(rootPc)} ${spell(rootPc + tones[1].semis)} ${spell(rootPc + 7)}. Its ${tone.tag === 'R' ? 'root' : tone.tag === '5' ? '5th' : `${tone.tag}rd`} is ${spell(pc)} — ${answers.length} of them live in this box.`,
    };
  }

  if (kind === 'unison') {
    const string = 1 + Math.floor(rand() * (o.openMidi.length - 1));
    const gap = o.openMidi[string] - o.openMidi[string - 1];
    const fret = Math.floor(rand() * Math.min(9, o.maxFret - gap));
    const target = { string: string - 1, fret: fret + gap };
    return {
      kind, tag: `uni:${gap}`, anyOctave: false,
      window: { lo: Math.max(0, fret - 1), hi: Math.min(o.maxFret, target.fret + 1) },
      prompt: `Find this exact pitch on the ${o.names[string - 1]} string`,
      given: [{ string, fret, label: '=' }],
      answers: [target], answerLabel: '=', answerMidis: [o.openMidi[string] + fret],
      explain: gap === 4
        ? `From the ${o.names[string]} string down to ${o.names[string - 1]} it's only 4 frets — the one pair of strings tuned a major 3rd apart. Every shape bends by a fret when it crosses here.`
        : `The same note one string lower is always 5 frets up (the strings are a 4th apart) — which is also why the 5th fret tunes the next string.`,
    };
  }

  const string = Math.floor(rand() * o.openMidi.length);
  const pc = mod12(Math.floor(rand() * 12));
  const frets: number[] = [];
  for (let fret = 0; fret <= Math.min(12, o.maxFret); fret++) if (mod12(o.openMidi[string] + fret) === pc) frets.push(fret);
  return {
    kind, tag: `note:${string}`, anyOctave: true, window: { lo: 0, hi: Math.min(12, o.maxFret) },
    prompt: `Find ${spell(pc)} on the ${o.names[string]} string`,
    given: [], answers: frets.map((fret) => ({ string, fret })), answerLabel: spell(pc), answerMidis: [pc],
    explain: `${spell(pc)} on the ${o.names[string]} string: fret ${frets.join(' and ')}. Count up from the open ${spell(o.openMidi[string])}, or down from the octave at fret 12.`,
  };
}

export const checkClick = (card: FretCard, pos: FretPos): boolean =>
  card.answers.some((a) => a.string === pos.string && a.fret === pos.fret);

export const checkPlayed = (card: FretCard, midi: number): boolean =>
  (card.anyOctave ? card.answerMidis.includes(mod12(midi)) : card.answerMidis.includes(midi));

export interface SprintResult {
  kind: FretDrillKind;
  correct: number;
  total: number;
  /** average seconds per card */
  pace: number;
  /** accuracy, with up to 20 points of it earned by speed (3 s a card or faster = all 20) */
  score: number;
}

export function scoreSprint(kind: FretDrillKind, outcomes: { right: boolean; seconds: number }[]): SprintResult {
  const total = outcomes.length || 1;
  const correct = outcomes.filter((x) => x.right).length;
  const pace = outcomes.reduce((a, x) => a + x.seconds, 0) / total;
  const speed = Math.max(0, Math.min(1, (9 - pace) / 6));
  return { kind, correct, total: outcomes.length, pace, score: Math.round((correct / total) * (80 + 20 * speed)) };
}
