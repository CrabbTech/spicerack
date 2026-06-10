// Sound: a Karplus-Strong plucked string for guitar mode, a soft two-osc
// synth voice for OP-1 mode, and a bar-pattern scheduler for the play button.
// Everything is plain Web Audio — no samples, nothing to load.

import { freqOfMidi } from '../theory/notes';
import { StrumHit } from '../data/genres';

export type InstrumentId = 'guitar' | 'op1';

export interface PlaySlot {
  midis: number[];
  bars: number;
}

export interface PlayOptions {
  bpm: number;
  swing?: number;
  pattern: StrumHit[];
  instrument: InstrumentId;
  onSlot?: (index: number | null) => void;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private guitarBus!: BiquadFilterNode;
  private synthBus!: GainNode;
  private pluckCache = new Map<number, AudioBuffer>();
  private generation = 0;
  private timers: number[] = [];
  private liveSources: AudioScheduledSourceNode[] = [];
  private volume = 0.85;
  muted = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 6;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);
      this.guitarBus = this.ctx.createBiquadFilter();
      this.guitarBus.type = 'lowpass';
      this.guitarBus.frequency.value = 4200;
      this.guitarBus.connect(this.master);
      this.synthBus = this.ctx.createGain();
      this.synthBus.gain.value = 0.5;
      this.synthBus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  private pluckBuffer(midi: number): AudioBuffer {
    const cached = this.pluckCache.get(midi);
    if (cached) return cached;
    const ctx = this.ensure();
    const sr = ctx.sampleRate;
    const freq = freqOfMidi(midi);
    const period = Math.max(2, Math.round(sr / freq));
    const seconds = 2.4;
    const data = new Float32Array(Math.floor(sr * seconds));
    // softened noise burst
    let last = 0;
    for (let i = 0; i < period; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.55 * last + 0.45 * white;
      data[i] = last;
    }
    // Karplus-Strong: averaged delay line with mild damping
    const damp = 0.498 * (midi < 52 ? 0.999 : 0.997);
    for (let i = period; i < data.length; i++) {
      data[i] = damp * (data[i - period] + data[i - period + 1]);
    }
    const buffer = ctx.createBuffer(1, data.length, sr);
    buffer.copyToChannel(data, 0);
    this.pluckCache.set(midi, buffer);
    return buffer;
  }

  private pluck(midi: number, when: number, vel: number, cutAfter?: number): void {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi);
    const gain = ctx.createGain();
    gain.gain.value = vel * 0.6;
    if (cutAfter !== undefined) {
      gain.gain.setValueAtTime(vel * 0.6, when + Math.max(0.04, cutAfter - 0.05));
      gain.gain.linearRampToValueAtTime(0.0001, when + cutAfter + 0.03);
    }
    src.connect(gain).connect(this.guitarBus);
    src.start(when);
    src.stop(when + 2.5);
    this.track(src);
  }

  private track(src: AudioScheduledSourceNode): void {
    this.liveSources.push(src);
    src.addEventListener('ended', () => {
      const i = this.liveSources.indexOf(src);
      if (i >= 0) this.liveSources.splice(i, 1);
    });
  }

  private synth(midi: number, when: number, dur: number, vel: number): void {
    const ctx = this.ensure();
    const freq = freqOfMidi(midi);
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq;
    osc2.detune.value = 6;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 + 2400 * vel;
    const gain = ctx.createGain();
    const peak = vel * 0.32;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.015);
    gain.gain.setTargetAtTime(peak * 0.7, when + 0.02, 0.12);
    gain.gain.setTargetAtTime(0.0001, when + dur, 0.09);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.synthBus);
    osc1.start(when); osc2.start(when);
    osc1.stop(when + dur + 0.6); osc2.stop(when + dur + 0.6);
    this.track(osc1); this.track(osc2);
  }

  /** One chord, strummed (guitar) or near-block (OP-1). */
  strum(midis: number[], instrument: InstrumentId, when?: number, vel = 0.9, dur = 1.8): void {
    const ctx = this.ensure();
    const t0 = when ?? ctx.currentTime + 0.03;
    const gap = instrument === 'guitar' ? 0.014 : 0.004;
    midis.forEach((m, i) => {
      if (instrument === 'guitar') this.pluck(m, t0 + i * gap, vel * (1 - i * 0.04), dur);
      else this.synth(m, t0 + i * gap, dur, vel);
    });
  }

  /** A run up a scale (and back down for the full effect). */
  playScale(midis: number[], instrument: InstrumentId, bpm = 132): void {
    this.stop();
    const ctx = this.ensure();
    const gen = this.generation;
    const eighth = 30 / bpm;
    const seq = [...midis, ...[...midis].reverse().slice(1)];
    seq.forEach((m, i) => {
      if (gen !== this.generation) return;
      const t = ctx.currentTime + 0.05 + i * eighth;
      if (instrument === 'guitar') this.pluck(m, t, 0.85, eighth * 1.6);
      else this.synth(m, t, eighth * 0.92, 0.8);
    });
  }

  /** Loop a progression with the genre's strum pattern. Returns a stop fn. */
  play(slots: PlaySlot[], opts: PlayOptions): () => void {
    this.stop();
    const ctx = this.ensure();
    const gen = this.generation;
    const beat = 60 / opts.bpm;
    const swingShift = (opts.swing ?? 0) / 6;

    const schedulePass = (passStart: number) => {
      if (gen !== this.generation) return;
      let cursor = passStart;
      slots.forEach((slot, slotIdx) => {
        const slotStart = cursor;
        const uiDelay = Math.max(0, (slotStart - ctx.currentTime) * 1000);
        this.timers.push(window.setTimeout(() => {
          if (gen === this.generation) opts.onSlot?.(slotIdx);
        }, uiDelay));
        for (let bar = 0; bar < slot.bars; bar++) {
          const barStart = slotStart + bar * 4 * beat;
          for (const hit of opts.pattern) {
            const isOffbeatEighth = Math.abs((hit.beat % 1) - 0.5) < 0.01;
            const beatPos = hit.beat + (isOffbeatEighth ? swingShift : 0);
            this.strum(slot.midis, opts.instrument, barStart + beatPos * beat, hit.vel, hit.durBeats * beat);
          }
        }
        cursor += slot.bars * 4 * beat;
      });
      const passLen = cursor - passStart;
      this.timers.push(window.setTimeout(() => schedulePass(passStart + passLen), Math.max(0, (cursor - ctx.currentTime - 0.3) * 1000)));
    };

    schedulePass(ctx.currentTime + 0.06);
    return () => this.stop();
  }

  stop(): void {
    this.generation++;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    for (const src of this.liveSources) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    this.liveSources = [];
  }
}

export const audio = new AudioEngine();
