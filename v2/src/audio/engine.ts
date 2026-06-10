// Sound: a Karplus-Strong plucked string for guitar and bass, a percussive
// two-osc voice for piano, a soft two-osc synth for OP-1, and a bar-pattern
// scheduler for the play button. Plain Web Audio — no samples, nothing to load.

import { freqOfMidi } from '../theory/notes';
import { DrumPattern, StrumHit } from '../data/genres';

export type InstrumentId = 'guitar' | 'bass' | 'piano' | 'op1';

export interface PlaySlot {
  midis: number[];
  bars: number;
}

export interface PlayOptions {
  bpm: number;
  swing?: number;
  pattern: StrumHit[];
  instrument: InstrumentId;
  drums?: DrumPattern;
  drumsOn?: boolean;
  /** run chords as an arpeggio instead of pattern strums */
  arp?: boolean;
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

  /** Percussive piano-ish voice: hard attack, natural decay, bright 2nd partial. */
  private piano(midi: number, when: number, dur: number, vel: number): void {
    const ctx = this.ensure();
    const freq = freqOfMidi(midi);
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    osc2.detune.value = 5;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600 + 3800 * vel, when);
    filter.frequency.setTargetAtTime(900, when + 0.02, 0.5);
    const gain = ctx.createGain();
    const peak = vel * 0.38;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    gain.gain.setTargetAtTime(peak * 0.25, when + 0.02, 0.45);
    gain.gain.setTargetAtTime(0.0001, when + dur, 0.07);
    osc1.connect(filter);
    osc2.connect(o2g).connect(filter);
    filter.connect(gain).connect(this.synthBus);
    osc1.start(when); osc2.start(when);
    osc1.stop(when + dur + 0.8); osc2.stop(when + dur + 0.8);
    this.track(osc1); this.track(osc2);
  }

  /** One note on the right voice for the instrument. */
  private voice(midi: number, when: number, dur: number, vel: number, instrument: InstrumentId): void {
    if (instrument === 'guitar') this.pluck(midi, when, vel, dur);
    else if (instrument === 'bass') this.pluck(midi, when, Math.min(1, vel * 1.15), dur + 0.4);
    else if (instrument === 'piano') this.piano(midi, when, dur, vel);
    else this.synth(midi, when, dur, vel);
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

  /** One chord: strummed (guitar), a quick R–5–8 walk (bass) or near-block (keys). */
  strum(midis: number[], instrument: InstrumentId, when?: number, vel = 0.9, dur = 1.8): void {
    const ctx = this.ensure();
    const t0 = when ?? ctx.currentTime + 0.03;
    if (instrument === 'bass') {
      midis.slice(0, 3).forEach((m, i) => this.voice(m, t0 + i * 0.16, dur, vel * (1 - i * 0.12), 'bass'));
      return;
    }
    const gap = instrument === 'guitar' ? 0.014 : instrument === 'piano' ? 0.006 : 0.004;
    midis.forEach((m, i) => {
      this.voice(m, t0 + i * gap, dur, instrument === 'guitar' ? vel * (1 - i * 0.04) : vel, instrument);
    });
  }

  // --- drum machine: synthesized kick / snare / hat -------------------------

  private kick(when: number, vel = 1): void {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.11);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9 * vel, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.26);
    osc.connect(gain).connect(this.master);
    osc.start(when);
    osc.stop(when + 0.3);
    this.track(osc);
  }

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ensure();
    const cached = this.pluckCache.get(-1);
    if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.pluckCache.set(-1, buf);
    return buf;
  }

  private snare(when: number, vel = 1): void {
    const ctx = this.ensure();
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5 * vel, when);
    ng.gain.exponentialRampToValueAtTime(0.001, when + 0.17);
    noise.connect(bp).connect(ng).connect(this.master);
    noise.start(when);
    noise.stop(when + 0.2);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, when);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.28 * vel, when);
    bg.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
    body.connect(bg).connect(this.master);
    body.start(when);
    body.stop(when + 0.13);
    this.track(noise);
    this.track(body);
  }

  private hat(when: number, vel = 1): void {
    const ctx = this.ensure();
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * vel, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.045);
    noise.connect(hp).connect(g).connect(this.master);
    noise.start(when);
    noise.stop(when + 0.06);
    this.track(noise);
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
      if (instrument === 'guitar' || instrument === 'bass') this.voice(m, t, eighth * 1.6, 0.85, instrument);
      else this.voice(m, t, eighth * 0.92, 0.8, instrument);
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
        const totalBeats = slot.bars * 4;
        for (let b0 = 0; b0 < totalBeats - 1e-6; b0 += 4) {
          const span = Math.min(4, totalBeats - b0); // < 4 for fractional-bar slots
          const barStart = slotStart + b0 * beat;
          if (opts.instrument === 'bass' && slot.midis.length) {
            // a bassist, not a strummer: root then fifth, or an R-5-8-5 walk
            const root = slot.midis[0];
            const fifth = slot.midis[1] ?? root;
            const octave = slot.midis[2] ?? root;
            if (opts.arp) {
              const seq = [root, fifth, octave, fifth];
              const steps = Math.round(span * 2);
              for (let step = 0; step < steps; step++) {
                const t = barStart + (step / 2 + (step % 2 === 1 ? swingShift : 0)) * beat;
                this.voice(seq[step % seq.length], t, beat * 0.55, step % 2 === 0 ? 0.9 : 0.7, 'bass');
              }
            }
            else {
              for (const hit of opts.pattern) {
                if (hit.beat >= span - 1e-6) continue;
                const isOffbeatEighth = Math.abs((hit.beat % 1) - 0.5) < 0.01;
                const beatPos = hit.beat + (isOffbeatEighth ? swingShift : 0);
                this.voice(hit.beat < 2 ? root : fifth, barStart + beatPos * beat, hit.durBeats * beat, hit.vel, 'bass');
              }
            }
          }
          else if (opts.arp && slot.midis.length) {
            // running eighth-note arpeggio, up then over the top
            const seq = [...slot.midis].sort((a, b) => a - b);
            const steps = Math.round(span * 2);
            for (let step = 0; step < steps; step++) {
              const m = seq[step % seq.length];
              const t = barStart + (step / 2 + (step % 2 === 1 ? swingShift : 0)) * beat;
              if (opts.instrument === 'guitar') this.pluck(m, t, step % 2 === 0 ? 0.85 : 0.62, beat * 0.55);
              else this.voice(m, t, beat * 0.42, step % 2 === 0 ? 0.8 : 0.55, opts.instrument);
            }
            if (opts.instrument === 'op1') {
              // soft pad bed under the arp
              for (const m of slot.midis) this.synth(m, barStart, span * beat * 0.96, 0.22);
            }
          }
          else {
            for (const hit of opts.pattern) {
              if (hit.beat >= span - 1e-6) continue;
              const isOffbeatEighth = Math.abs((hit.beat % 1) - 0.5) < 0.01;
              const beatPos = hit.beat + (isOffbeatEighth ? swingShift : 0);
              this.strum(slot.midis, opts.instrument, barStart + beatPos * beat, hit.vel, hit.durBeats * beat);
            }
          }
          if (opts.drumsOn && opts.drums) {
            for (const b of opts.drums.kick) if (b < span) this.kick(barStart + b * beat, b === 0 ? 1 : 0.85);
            for (const b of opts.drums.snare) if (b < span) this.snare(barStart + b * beat, 0.95);
            for (const b of opts.drums.hat) {
              if (b >= span) continue;
              const isOff = Math.abs((b % 1) - 0.5) < 0.01;
              this.hat(barStart + (b + (isOff ? swingShift : 0)) * beat, isOff ? 0.7 : 1);
            }
          }
        }
        cursor += totalBeats * beat;
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
