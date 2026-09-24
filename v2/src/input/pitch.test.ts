import { describe, expect, it } from 'vitest';
import { PitchResult, TrackerEvent, createNoteTracker, detectPitch } from './pitch';

const midiOf = (freq: number): number => 69 + 12 * Math.log2(freq / 440);

interface ToneOptions {
  /** amplitude of each harmonic, fundamental first */
  amps?: number[];
  /** exponential decay rate, 1/seconds */
  decay?: number;
  /** sample index where the tone begins; silence before it */
  start?: number;
}

function tone(freq: number, sampleRate: number, size: number, opts: ToneOptions = {}): Float32Array {
  const { amps = [0.5], decay = 0, start = 0 } = opts;
  const out = new Float32Array(size);
  for (let i = start; i < size; i++) {
    const t = (i - start) / sampleRate;
    let v = 0;
    // a phase offset per harmonic so the partials are not artificially aligned
    amps.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * freq * (k + 1) * t + k * 0.7); });
    out[i] = v * Math.exp(-decay * t);
  }
  return out;
}

/** a string where the 2nd harmonic out-shouts the fundamental */
const PLUCK = [0.3, 0.6, 0.35, 0.2];

/** tiny LCG (Numerical Recipes constants) so "random" noise is the same every run */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function noise(size: number, amp: number, seed: number): Float32Array {
  const rand = lcg(seed);
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = (rand() * 2 - 1) * amp;
  return out;
}

const GUITAR: [string, number][] = [
  ['E2', 82.41], ['A2', 110], ['D3', 146.83], ['G3', 196], ['B3', 246.94],
  ['E4', 329.63], ['A4', 440], ['E5', 659.26], ['E6', 1318.5],
];
const RATES = [44100, 48000];

describe('detectPitch', () => {
  for (const sr of RATES) {
    it(`finds sine waves across the guitar's range at ${sr} Hz`, () => {
      for (const [name, freq] of GUITAR) {
        const r = detectPitch(tone(freq, sr, 2048), sr);
        expect(r, name).not.toBeNull();
        expect(Math.abs(r!.midi - midiOf(freq)), name).toBeLessThan(0.1);
        expect(r!.clarity, name).toBeGreaterThan(0.9);
        expect(r!.freq, name).toBeCloseTo(freq, -1);
      }
    });

    it(`hears the fundamental under a louder 2nd harmonic at ${sr} Hz`, () => {
      for (const [name, freq] of GUITAR) {
        for (const decay of [3, 12]) {
          const r = detectPitch(tone(freq, sr, 2048, { amps: PLUCK, decay }), sr);
          expect(r, name).not.toBeNull();
          expect(Math.abs(r!.midi - midiOf(freq)), `${name} decay ${decay}`).toBeLessThan(0.1);
          expect(r!.clarity, name).toBeGreaterThan(0.9);
        }
      }
    });

    it(`reaches bass E1 with a 4096 frame and a lowered floor at ${sr} Hz`, () => {
      for (const amps of [[0.5], PLUCK]) {
        const r = detectPitch(tone(41.2, sr, 4096, { amps, decay: 2 }), sr, { minFreq: 38 });
        expect(r).not.toBeNull();
        expect(Math.abs(r!.midi - midiOf(41.2))).toBeLessThan(0.1);
      }
    });
  }

  it('does not mistake a clean tone for the octave below', () => {
    // every multiple of the period is also a perfect dip; the first one must win
    for (const freq of [329.63, 659.26, 1318.5]) {
      const r = detectPitch(tone(freq, 44100, 4096), 44100, { minFreq: 38 });
      expect(Math.abs(r!.midi - midiOf(freq))).toBeLessThan(0.1);
    }
  });

  it('survives a noisy room', () => {
    const frame = tone(110, 44100, 2048, { amps: PLUCK, decay: 3 });
    const hiss = noise(2048, 0.2, 7);
    for (let i = 0; i < frame.length; i++) frame[i] += hiss[i];
    const r = detectPitch(frame, 44100);
    expect(Math.abs(r!.midi - midiOf(110))).toBeLessThan(0.15);
    expect(r!.clarity).toBeLessThan(0.99);
  });

  it('reports the frame level', () => {
    const r = detectPitch(tone(220, 44100, 2048, { amps: [0.5] }), 44100);
    expect(r!.rms).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it('returns null for silence', () => {
    expect(detectPitch(new Float32Array(2048), 44100)).toBeNull();
    expect(detectPitch(new Float32Array(0), 44100)).toBeNull();
  });

  it('returns null for white noise', () => {
    for (let seed = 1; seed <= 25; seed++) {
      expect(detectPitch(noise(2048, 0.5, seed), 44100), `seed ${seed}`).toBeNull();
      expect(detectPitch(noise(2048, 0.05, seed), 48000), `seed ${seed}`).toBeNull();
    }
  });

  it('returns null for a tone under the rms floor', () => {
    expect(detectPitch(tone(220, 44100, 2048, { amps: [0.002] }), 44100)).toBeNull();
    expect(detectPitch(tone(220, 44100, 2048, { amps: [0.02] }), 44100)).not.toBeNull();
  });

  it('returns null when the note is below the search range', () => {
    expect(detectPitch(tone(50, 44100, 2048), 44100)).toBeNull();
  });

  it('never reports an octave error for a tone that starts mid-frame', () => {
    let heard = 0;
    for (const [name, freq] of GUITAR) {
      for (const amps of [[0.5], PLUCK]) {
        for (const start of [128, 256, 512, 768, 1024, 1280, 1536, 1800]) {
          const r = detectPitch(tone(freq, 44100, 2048, { amps, decay: 3, start }), 44100);
          if (r === null) continue;
          heard++;
          expect(Math.abs(r.midi - midiOf(freq)), `${name} from ${start}`).toBeLessThan(0.5);
        }
      }
    }
    expect(heard).toBeGreaterThan(0);
  });

  it('gives the same answer when the scratch buffer is reused across frame sizes', () => {
    const big = detectPitch(tone(41.2, 48000, 4096), 48000, { minFreq: 38 });
    const small = detectPitch(tone(440, 48000, 2048), 48000);
    const again = detectPitch(tone(41.2, 48000, 4096), 48000, { minFreq: 38 });
    expect(Math.abs(small!.midi - 69)).toBeLessThan(0.1);
    expect(again).toEqual(big);
  });
});

const hit = (midi: number, rms = 0.1, clarity = 0.95): PitchResult =>
  ({ freq: 440 * 2 ** ((midi - 69) / 12), midi, clarity, rms });

/** push frames 10 ms apart, collecting every event */
function run(tracker: ReturnType<typeof createNoteTracker>, frames: (PitchResult | null)[], from = 0): TrackerEvent[] {
  return frames.flatMap((f, i) => tracker.push(f, (from + i) / 100));
}

describe('note tracker', () => {
  it('starts a note after stableFrames, stamped with the first frame', () => {
    const tr = createNoteTracker();
    expect(tr.push(hit(64.1), 1.0)).toEqual([]);
    expect(tr.current()).toBeNull();
    expect(tr.push(hit(63.9), 1.025)).toEqual([{ type: 'on', midi: 64, time: 1.0 }]);
    expect(tr.current()).toBe(64);
    expect(tr.push(hit(64.05), 1.05)).toEqual([]);
  });

  it('honours a longer stableFrames and restarts the count when the pitch jumps', () => {
    const tr = createNoteTracker({ stableFrames: 3 });
    const events = run(tr, [hit(60), hit(60), hit(67), hit(67), hit(67)]);
    expect(events).toEqual([{ type: 'on', midi: 67, time: 0.02 }]);
  });

  it('starts at once with stableFrames 1', () => {
    const tr = createNoteTracker({ stableFrames: 1 });
    expect(tr.push(hit(57), 0.5)).toEqual([{ type: 'on', midi: 57, time: 0.5 }]);
  });

  it('ignores frames that are unclear or too quiet', () => {
    const tr = createNoteTracker();
    expect(run(tr, [hit(64, 0.1, 0.5), hit(64, 0.1, 0.5), hit(64, 0.005), hit(64, 0.005)])).toEqual([]);
    expect(tr.current()).toBeNull();
    const loose = createNoteTracker({ minClarity: 0.4, minRms: 0.001 });
    expect(run(loose, [hit(64, 0.1, 0.5), hit(64, 0.005)])).toHaveLength(1);
  });

  it('does not let one outlier frame end the note', () => {
    const tr = createNoteTracker();
    const events = run(tr, [hit(64), hit(64), hit(76), hit(64), null, hit(64), hit(52.3), hit(64)]);
    expect(events).toEqual([{ type: 'on', midi: 64, time: 0 }]);
    expect(tr.current()).toBe(64);
  });

  it('rides out vibrato across the semitone boundary', () => {
    const tr = createNoteTracker();
    const wobble = [64, 64.2, 64.55, 64.6, 64.3, 63.8, 63.45, 63.5, 64];
    expect(run(tr, wobble.map((m) => hit(m)))).toHaveLength(1);
  });

  it('emits off then on, in order, when the pitch changes', () => {
    const tr = createNoteTracker();
    const events = run(tr, [hit(64), hit(64), hit(64), hit(66.1), hit(65.9), hit(66)]);
    expect(events).toEqual([
      { type: 'on', midi: 64, time: 0 },
      { type: 'off', midi: 64, time: 0.03 },
      { type: 'on', midi: 66, time: 0.03 },
    ]);
    expect(tr.current()).toBe(66);
  });

  it('ends the note after two unusable frames, not one', () => {
    const tr = createNoteTracker();
    run(tr, [hit(64), hit(64)]);
    expect(tr.push(null, 0.02)).toEqual([]);
    expect(tr.current()).toBe(64);
    expect(tr.push(hit(64, 0.001), 0.03)).toEqual([{ type: 'off', midi: 64, time: 0.02 }]);
    expect(tr.current()).toBeNull();
    expect(run(tr, [null, null, null], 4)).toEqual([]);
  });

  it('drops a note whose tail dissolves into pitches that never settle', () => {
    const tr = createNoteTracker();
    const events = run(tr, [hit(64), hit(64), hit(71), hit(50), hit(80), hit(58)]);
    expect(events).toEqual([
      { type: 'on', midi: 64, time: 0 },
      { type: 'off', midi: 64, time: 0.02 },
    ]);
  });

  it('counts a re-attack on the same pitch', () => {
    const tr = createNoteTracker();
    const decay = [0.2, 0.2, 0.17, 0.14, 0.12, 0.1];
    expect(run(tr, decay.map((rms) => hit(64, rms)))).toEqual([{ type: 'on', midi: 64, time: 0 }]);
    expect(tr.push(hit(64, 0.22), 0.06)).toEqual([
      { type: 'off', midi: 64, time: 0.06 },
      { type: 'on', midi: 64, time: 0.06 },
    ]);
    expect(tr.current()).toBe(64);
    // and the new pluck decays without firing again
    expect(run(tr, [0.22, 0.2, 0.18].map((rms) => hit(64, rms)), 7)).toEqual([]);
  });

  it('does not read a swelling attack or a gentle crescendo as a re-attack', () => {
    const tr = createNoteTracker();
    // the pluck arrives over the first frames: quiet, louder, full
    const events = run(tr, [0.05, 0.09, 0.2, 0.19, 0.2, 0.22, 0.25, 0.28].map((rms) => hit(64, rms)));
    expect(events).toEqual([{ type: 'on', midi: 64, time: 0 }]);
  });

  it('respects a custom reattackRatio', () => {
    const frames = [0.2, 0.2, 0.15, 0.1, 0.1, 0.1, 0.16].map((rms) => hit(64, rms));
    expect(run(createNoteTracker(), frames)).toHaveLength(1);
    expect(run(createNoteTracker({ reattackRatio: 1.4 }), frames)).toHaveLength(3);
  });

  it('reset() forgets the note and any half-heard candidate', () => {
    const tr = createNoteTracker();
    run(tr, [hit(64), hit(64)]);
    expect(tr.current()).toBe(64);
    tr.reset();
    expect(tr.current()).toBeNull();
    expect(tr.push(null, 1)).toEqual([]);

    tr.push(hit(60), 2);
    tr.reset();
    expect(tr.push(hit(60), 2.01)).toEqual([]);
    expect(tr.push(hit(60), 2.02)).toEqual([{ type: 'on', midi: 60, time: 2.01 }]);
  });

  it('tracks a real signal end to end', () => {
    // E4 for half a second, silence, A4, silence — hopping 1024 samples through 2048 frames
    const sr = 44100;
    const hop = 1024;
    const signal = new Float32Array(sr * 2);
    signal.set(tone(329.63, sr, sr * 0.5, { amps: PLUCK, decay: 3 }), 0);
    signal.set(tone(440, sr, sr * 0.5, { amps: PLUCK, decay: 3 }), sr);
    const tr = createNoteTracker();
    const events: TrackerEvent[] = [];
    for (let at = 0; at + 2048 <= signal.length; at += hop) {
      events.push(...tr.push(detectPitch(signal.subarray(at, at + 2048), sr), at / sr));
    }
    expect(events.map((e) => `${e.type} ${e.midi}`)).toEqual(['on 64', 'off 64', 'on 69', 'off 69']);
    expect(events[0].time).toBeLessThan(0.05);
    expect(Math.abs(events[1].time - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(events[2].time - 1)).toBeLessThan(0.05);
  });
});
