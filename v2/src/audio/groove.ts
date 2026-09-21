// One bar of groove, as data. The play button and the MIDI writer both build
// from this, so what you hear, what the lesson says and what lands in the DAW
// are the same music — including odd meters, which get a groove built from
// their accent groups instead of a 4/4 pattern with the end sawn off.

import { mod12 } from '../theory/notes';
import { DrumPattern, StrumHit } from '../data/genres';

export type GrooveInstrument = 'guitar' | 'bass' | 'piano' | 'op1';

export interface Meter {
  /** accent groups in eighth notes, e.g. 7/8 (2+2+3) = [2, 2, 3] */
  groups: number[];
}

/** Bar length in quarter-note beats. */
export const beatsPerBar = (meter?: Meter): number =>
  meter ? meter.groups.reduce((a, b) => a + b, 0) / 2 : 4;

/** Beat positions where each accent group starts. */
export function groupStarts(meter: Meter): number[] {
  const out: number[] = [];
  let at = 0;
  for (const g of meter.groups) {
    out.push(at / 2);
    at += g;
  }
  return out;
}

/** MIDI time-signature numerator/denominator power for a meter. */
export function timeSignature(meter?: Meter): { numerator: number; denomPow: number } {
  if (!meter) return { numerator: 4, denomPow: 2 };
  const eighths = meter.groups.reduce((a, b) => a + b, 0);
  return eighths % 2 === 0 ? { numerator: eighths / 2, denomPow: 2 } : { numerator: eighths, denomPow: 3 };
}

export interface GrooveOptions {
  pattern: StrumHit[];
  drums?: DrumPattern;
  /** 0..1 — how far upbeat eighths get pushed toward a triplet shuffle */
  swing: number;
  arp: boolean;
  instrument: GrooveInstrument;
  meter?: Meter;
}

export interface GrooveSlot {
  /** the studied instrument's voicing, low to high (bass: root, fifth, octave) */
  midis: number[];
  /** pitch class the backing bass plays */
  rootPc: number;
}

export interface ChordHit {
  beat: number;
  dur: number;
  vel: number;
  /** sounded together (strummed); arps and bass lines carry one note per hit */
  midis: number[];
}

export interface NoteHit {
  beat: number;
  dur: number;
  vel: number;
  midi: number;
}

export interface DrumHit {
  beat: number;
  vel: number;
  drum: 'kick' | 'snare' | 'hat';
}

export interface BarEvents {
  chords: ChordHit[];
  /** soft sustained bed under an OP-1 arpeggio */
  pad: ChordHit[];
  /** the backing bassist (empty when the studied instrument IS the bass) */
  bass: NoteHit[];
  drums: DrumHit[];
}

const isUpbeat = (beat: number): boolean => Math.abs((beat % 1) - 0.5) < 0.01;

export const swung = (beat: number, swing: number): number => beat + (isUpbeat(beat) ? swing / 6 : 0);

/** Backing-bass register: E1..D♯2, like a real four-string. */
export const backingBassMidi = (rootPc: number): number => 28 + mod12(rootPc - 4);

/**
 * Events for one bar — or the first `span` beats of one, for half-bar chords.
 * Beats are relative to the bar start and already swung.
 */
export function barEvents(slot: GrooveSlot, span: number, opts: GrooveOptions): BarEvents {
  const out: BarEvents = { chords: [], pad: [], bass: [], drums: [] };
  const { swing, meter } = opts;
  const starts = meter ? groupStarts(meter).filter((b) => b < span - 1e-6) : [];
  // in an odd meter the accent groups ARE the strum pattern
  const pattern: StrumHit[] = meter
    ? starts.map((b, i) => ({ beat: b, durBeats: ((starts[i + 1] ?? span) - b) * 0.9, vel: i === 0 ? 0.95 : 0.78 }))
    : opts.pattern.filter((h) => h.beat < span - 1e-6);
  const steps = Math.round(span * 2);

  if (slot.midis.length) {
    if (opts.instrument === 'bass') {
      // a bassist, not a strummer: root then fifth, or an R-5-8-5 walk
      const root = slot.midis[0];
      const fifth = slot.midis[1] ?? root;
      const octave = slot.midis[2] ?? root;
      if (opts.arp) {
        const seq = [root, fifth, octave, fifth];
        for (let s = 0; s < steps; s++) {
          out.chords.push({ beat: swung(s / 2, swing), dur: 0.55, vel: s % 2 === 0 ? 0.9 : 0.7, midis: [seq[s % 4]] });
        }
      }
      else {
        for (const h of pattern) {
          const late = meter ? h.beat > 0 : h.beat >= 2;
          out.chords.push({ beat: swung(h.beat, swing), dur: h.durBeats, vel: h.vel, midis: [late ? fifth : root] });
        }
      }
    }
    else if (opts.arp) {
      // running eighth-note arpeggio, up then over the top
      const seq = [...slot.midis].sort((a, b) => a - b);
      const dur = opts.instrument === 'guitar' ? 0.55 : 0.42;
      for (let s = 0; s < steps; s++) {
        out.chords.push({ beat: swung(s / 2, swing), dur, vel: s % 2 === 0 ? 0.85 : 0.6, midis: [seq[s % seq.length]] });
      }
      if (opts.instrument === 'op1') out.pad.push({ beat: 0, dur: span * 0.96, vel: 0.22, midis: slot.midis });
    }
    else {
      for (const h of pattern) {
        out.chords.push({ beat: swung(h.beat, swing), dur: h.durBeats, vel: h.vel, midis: slot.midis });
      }
    }
  }

  if (opts.instrument !== 'bass') {
    const midi = backingBassMidi(slot.rootPc);
    if (meter) {
      // root on the downbeat, again on the last accent group to push into the next bar
      const last = starts[starts.length - 1] ?? 0;
      out.bass.push({ beat: 0, dur: Math.max(0.5, (starts[1] ?? span) - 0.1), vel: 0.88, midi });
      if (last > 0) out.bass.push({ beat: last, dur: Math.max(0.5, span - last - 0.1), vel: 0.78, midi });
    }
    else {
      out.bass.push({ beat: 0, dur: Math.min(1.9, span), vel: 0.88, midi });
      if (span > 2) out.bass.push({ beat: 2, dur: 1.9, vel: 0.78, midi });
    }
  }

  if (meter) {
    // kick the downbeat, answer on the other accents, always end the bar on a snare
    starts.forEach((b, i) => {
      const isLast = i === starts.length - 1;
      if (i === 0) out.drums.push({ beat: b, vel: 1, drum: 'kick' });
      else if (isLast || i % 2 === 1) out.drums.push({ beat: b, vel: isLast ? 0.95 : 0.85, drum: 'snare' });
      else out.drums.push({ beat: b, vel: 0.85, drum: 'kick' });
    });
    for (let s = 0; s < steps; s++) {
      const b = s / 2;
      out.drums.push({ beat: swung(b, swing), vel: starts.includes(b) ? 1 : 0.62, drum: 'hat' });
    }
  }
  else if (opts.drums) {
    for (const b of opts.drums.kick) if (b < span) out.drums.push({ beat: b, vel: b === 0 ? 1 : 0.85, drum: 'kick' });
    for (const b of opts.drums.snare) if (b < span) out.drums.push({ beat: b, vel: 0.95, drum: 'snare' });
    for (const b of opts.drums.hat) {
      if (b < span) out.drums.push({ beat: swung(b, swing), vel: isUpbeat(b) ? 0.7 : 1, drum: 'hat' });
    }
  }
  return out;
}
