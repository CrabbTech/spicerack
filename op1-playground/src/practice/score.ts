// Play-along grading: the expected notes of a practice slice on a timeline,
// and a Grader that judges incoming presses (hardware MIDI or the QWERTY
// piano) against them. Pure and tested — the UI only feeds it events.

import { CompiledSection, PartId } from '../songs/compile';
import { OP1_BASE_MIDI } from '../op1/op1';

export interface ExpectedNote {
  /** ms from the top of the pass */
  atMs: number;
  /** sounding midi at the section's octave shift */
  midi: number;
  /** physical key index 0..23 */
  index: number;
}

/**
 * What a practice range asks your hands to do: written notes where they
 * exist, otherwise the chord voicing struck at the top of each bar.
 */
export function expectedFor(
  section: CompiledSection, fromBar: number, toBar: number, bpm: number, part?: PartId,
): { notes: ExpectedNote[]; passMs: number } {
  const lo = Math.max(0, Math.min(fromBar, toBar));
  const hi = Math.min(section.bars.length - 1, Math.max(fromBar, toBar));
  const bars = section.bars.filter((b) => b.index >= lo && b.index <= hi);
  const offset = bars[0]?.startBeat ?? 0;
  const msPerBeat = 60000 / bpm;
  const shift = 12 * section.octaveShift;
  const notes: ExpectedNote[] = [];
  for (const bar of bars) {
    if (bar.notes.length) {
      for (const n of bar.notes) {
        if (part && n.part !== part) continue;
        notes.push({ atMs: (n.start - offset) * msPerBeat, midi: n.midi + shift, index: n.index });
      }
    }
    else {
      for (const m of bar.voicing.midis) {
        notes.push({ atMs: (bar.startBeat - offset) * msPerBeat, midi: m + shift, index: m - OP1_BASE_MIDI });
      }
    }
  }
  notes.sort((a, b) => a.atMs - b.atMs || a.midi - b.midi);
  const beats = bars.reduce((sum, b) => sum + b.beats, 0);
  return { notes, passMs: beats * msPerBeat };
}

export interface Judgement {
  kind: 'hit' | 'miss';
  /** physical key index the press landed on */
  index: number;
  /** signed ms early(-)/late(+), hits only */
  deltaMs?: number;
}

export interface PassStats {
  hits: number;
  expected: number;
  extras: number;
  /** mean absolute timing error of the hits, ms */
  avgAbsMs: number;
}

export interface GraderOptions {
  /** half-width of the timing window */
  windowMs?: number;
  /** match by pitch class, so the hardware's own octave switch can differ */
  anyOctave?: boolean;
}

export class Grader {
  private readonly notes: ExpectedNote[];
  private readonly passMs: number;
  private readonly windowMs: number;
  private readonly anyOctave: boolean;
  private matched = new Set<string>();
  private hitDeltas: number[] = [];
  private extras = 0;
  private maxPass = 0;

  constructor(expected: { notes: ExpectedNote[]; passMs: number }, opts: GraderOptions = {}) {
    this.notes = expected.notes;
    this.passMs = Math.max(1, expected.passMs);
    this.windowMs = opts.windowMs ?? 250;
    this.anyOctave = opts.anyOctave !== false;
  }

  private matches(expected: number, played: number): boolean {
    return this.anyOctave
      ? ((expected % 12) + 12) % 12 === ((played % 12) + 12) % 12
      : expected === played;
  }

  /** Judge one press at `relMs` since the top of pass 0 (count-in excluded). */
  play(relMs: number, midi: number): Judgement {
    const index = Math.max(0, Math.min(23, ((midi - OP1_BASE_MIDI) % 24 + 24) % 24));
    const pass = Math.max(0, Math.floor(relMs / this.passMs));
    this.maxPass = Math.max(this.maxPass, pass);
    let best: { key: string; delta: number } | undefined;
    // a press near a pass boundary may belong to the neighbouring pass
    for (const p of [pass - 1, pass, pass + 1]) {
      if (p < 0) continue;
      const local = relMs - p * this.passMs;
      this.notes.forEach((n, i) => {
        const key = `${p}:${i}`;
        if (this.matched.has(key) || !this.matches(n.midi, midi)) return;
        const delta = local - n.atMs;
        if (Math.abs(delta) > this.windowMs) return;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { key, delta };
      });
    }
    if (best) {
      this.matched.add(best.key);
      this.hitDeltas.push(best.delta);
      const expIndex = this.notes[Number(best.key.split(':')[1])].index;
      return { kind: 'hit', index: expIndex, deltaMs: Math.round(best.delta) };
    }
    this.extras++;
    return { kind: 'miss', index };
  }

  /**
   * How many expected presses of each physical key went unhit, over every
   * pass started so far — the raw material for the trouble-key memory.
   */
  missedByKey(): Map<number, number> {
    const out = new Map<number, number>();
    for (let p = 0; p <= this.maxPass; p++) {
      this.notes.forEach((n, i) => {
        if (this.matched.has(`${p}:${i}`)) return;
        out.set(n.index, (out.get(n.index) ?? 0) + 1);
      });
    }
    return out;
  }

  /** Running totals across every pass started so far. */
  stats(): PassStats {
    const expected = this.notes.length * (this.maxPass + 1);
    const avg = this.hitDeltas.length
      ? this.hitDeltas.reduce((s, d) => s + Math.abs(d), 0) / this.hitDeltas.length
      : 0;
    return {
      hits: this.hitDeltas.length,
      expected,
      extras: this.extras,
      avgAbsMs: Math.round(avg),
    };
  }

  /** 0..100: hit rate with a small penalty for stray presses. */
  get accuracy(): number {
    const s = this.stats();
    if (!s.expected) return 0;
    return Math.max(0, Math.round(100 * (s.hits / s.expected) - 5 * (s.extras / s.expected)));
  }
}
