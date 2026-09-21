// Ears. The app listens to a guitar (or a hummed line, or an OP-1 through the
// mic) and has to know which note the player landed on. Two halves: a YIN
// pitch detector that turns one frame of samples into a frequency, and a note
// tracker that turns a wobbly stream of those into clean on/off events.
// No Web Audio in here — frames in, data out — so all of it is unit-testable.
//
// Why YIN and not an FFT peak: a plucked string's 2nd harmonic is often louder
// than its fundamental, so the tallest spectral peak is an octave up. YIN asks
// "after how many samples does the waveform repeat?", which is the fundamental
// no matter which harmonic is loudest.

export interface PitchResult {
  freq: number;
  /** fractional midi note number (69 = A4 = 440 Hz) */
  midi: number;
  /** 0..1 — how periodic the frame is; below ~0.8 is usually noise or a chord */
  clarity: number;
  /** root-mean-square level of the frame, 0..1 */
  rms: number;
}

export interface PitchOptions {
  /** default 70 — just under a guitar's low E. The lag search never exceeds half the frame, so the real floor is max(minFreq, 2 × sampleRate / frame.length) */
  minFreq?: number;
  /** default 1400 */
  maxFreq?: number;
  /** YIN threshold: a dip in the normalized difference must fall below this to count as a period. default 0.15 */
  threshold?: number;
}

/** below this the frame is room tone, not a note */
const RMS_FLOOR = 0.003;

let scratch = new Float64Array(0);

const freqToMidi = (freq: number): number => 69 + 12 * Math.log2(freq / 440);

/**
 * Monophonic pitch of one frame, or null when nothing periodic is sounding.
 * 2048 samples reaches a guitar's low E at 44.1/48 kHz; a bass needs 4096 and
 * a lower `minFreq`.
 */
export function detectPitch(frame: Float32Array, sampleRate: number, opts: PitchOptions = {}): PitchResult | null {
  const n = frame.length;
  const minFreq = opts.minFreq ?? 70;
  const maxFreq = opts.maxFreq ?? 1400;
  const threshold = opts.threshold ?? 0.15;

  let energy = 0;
  for (let i = 0; i < n; i++) energy += frame[i] * frame[i];
  const rms = Math.min(1, Math.sqrt(energy / Math.max(1, n)));
  if (rms < RMS_FLOOR) return null;

  // lags to search; one past each end is computed so every candidate has two neighbours
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(Math.ceil(sampleRate / minFreq) + 1, n >> 1);
  if (tauMax - tauMin < 2) return null;
  const w = n - tauMax;

  if (scratch.length < tauMax + 1) scratch = new Float64Array(tauMax + 1);
  const cmnd = scratch;

  // Difference function, normalized on the fly by its own cumulative mean.
  // The FIRST true local minimum under the threshold is the period — first
  // means shortest, so a clean tone can never come out an octave down — and
  // the search stops there, which makes high notes several times cheaper.
  let running = 0;
  let tau = -1;
  cmnd[0] = 1;
  for (let lag = 1; lag <= tauMax; lag++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const d = frame[j] - frame[j + lag];
      sum += d * d;
    }
    running += sum;
    cmnd[lag] = running > 0 ? (sum * lag) / running : 1;

    const t = lag - 1;
    if (t >= tauMin && cmnd[t] < threshold && cmnd[t] <= cmnd[t - 1] && cmnd[t] < cmnd[lag]) {
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // parabolic interpolation: the true period falls between samples
  const a = cmnd[tau - 1];
  const b = cmnd[tau];
  const c = cmnd[tau + 1];
  const curve = a - 2 * b + c;
  const shift = curve > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / curve)) : 0;
  const depth = b - 0.25 * (a - c) * shift;

  const freq = sampleRate / (tau + shift);
  return { freq, midi: freqToMidi(freq), clarity: Math.max(0, Math.min(1, 1 - depth)), rms };
}

export interface TrackerOptions {
  /** frames in a row that must agree (within ±0.5 semitone of each other) before a note starts. default 2 */
  stableFrames?: number;
  /** default 0.82 */
  minClarity?: number;
  /** default 0.012 */
  minRms?: number;
  /** a new pluck on the same pitch counts as a re-attack when rms jumps by this factor. default 1.8 */
  reattackRatio?: number;
}

export type TrackerEvent =
  | { type: 'on'; midi: number; time: number }
  | { type: 'off'; midi: number; time: number };

export interface NoteTracker {
  /** feed every frame's result (or null) with its time in seconds; returns the events that frame caused */
  push(result: PitchResult | null, time: number): TrackerEvent[];
  reset(): void;
  /** the sounding midi note, or null */
  current(): number | null;
}

/** a sounding note keeps frames this close to it — wider than ±0.5 so vibrato on the boundary cannot flap */
const HOLD_SEMITONES = 0.7;
/** unusable frames in a row that end a note */
const OFF_FRAMES = 2;
/** the level follows a decaying string quickly but rises slowly, so an attack split across two frames still reads as a jump */
const LEVEL_FALL = 0.7;
const LEVEL_RISE = 0.3;

interface Candidate {
  sum: number;
  count: number;
  /** time of the first agreeing frame — the onset, before detection latency */
  time: number;
  rms: number;
}

export function createNoteTracker(opts: TrackerOptions = {}): NoteTracker {
  const stableFrames = Math.max(1, Math.round(opts.stableFrames ?? 2));
  const minClarity = opts.minClarity ?? 0.82;
  const minRms = opts.minRms ?? 0.012;
  const reattackRatio = opts.reattackRatio ?? 1.8;
  // frames in a row that may fail to support a note before it is dropped even
  // though no new note settled (a tail dissolving into confident garbage)
  const maxMisses = stableFrames + 2;

  let active: number | null = null;
  let level = 0;
  let age = 0;
  let quiet = 0;
  let misses = 0;
  let missTime = 0;
  let cand: Candidate | null = null;

  const reset = (): void => {
    active = null;
    level = 0;
    age = 0;
    quiet = 0;
    misses = 0;
    missTime = 0;
    cand = null;
  };

  /** a frame that did not support the sounding note — enough of them end it */
  const miss = (time: number, events: TrackerEvent[]): void => {
    if (active === null) return;
    if (misses === 0) missTime = time;
    misses++;
    if (quiet < OFF_FRAMES && misses < maxMisses) return;
    events.push({ type: 'off', midi: active, time: missTime });
    active = null;
    misses = 0;
  };

  const push = (result: PitchResult | null, time: number): TrackerEvent[] => {
    const events: TrackerEvent[] = [];

    if (result === null || !Number.isFinite(result.midi) || result.clarity < minClarity || result.rms < minRms) {
      cand = null;
      quiet++;
      miss(time, events);
      return events;
    }
    quiet = 0;

    if (active !== null && Math.abs(result.midi - active) <= HOLD_SEMITONES) {
      cand = null;
      misses = 0;
      // the frame right after an attack is still the same attack arriving
      if (age > 0 && result.rms >= reattackRatio * level) {
        events.push({ type: 'off', midi: active, time }, { type: 'on', midi: active, time });
        level = result.rms;
        age = 0;
      }
      else {
        level = age === 0
          ? Math.max(level, result.rms)
          : level + (result.rms > level ? LEVEL_RISE : LEVEL_FALL) * (result.rms - level);
        age++;
      }
      return events;
    }

    // somewhere else (or nothing sounding yet): it has to hold still before it counts
    if (cand && Math.abs(result.midi - cand.sum / cand.count) <= 0.5) {
      cand.sum += result.midi;
      cand.count++;
      cand.rms = result.rms;
    }
    else {
      cand = { sum: result.midi, count: 1, time, rms: result.rms };
    }

    if (cand.count >= stableFrames) {
      if (active !== null) events.push({ type: 'off', midi: active, time: cand.time });
      active = Math.round(cand.sum / cand.count);
      events.push({ type: 'on', midi: active, time: cand.time });
      level = cand.rms;
      age = 0;
      misses = 0;
      cand = null;
    }
    else {
      miss(time, events);
    }
    return events;
  };

  return { push, reset, current: () => active };
}
