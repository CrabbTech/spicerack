// Sound: a Karplus-Strong plucked string for guitar and bass, a percussive
// two-osc voice for piano, a soft two-osc synth for OP-1, and a bar scheduler
// for the play button. Plain Web Audio — no samples, nothing to load.
//
// The scheduler is a small backing band: chords, a bassist, drums and an
// optional lead line each sit on their own bus, so the mix can change while
// the loop runs and the part being practised can be pulled out of the way.

import { freqOfMidi } from '../theory/notes';
import { DrumPattern, StrumHit } from '../data/genres';
import { LeadNote } from '../theory/lick';
import { GrooveInstrument, Meter, barEvents, beatsPerBar, groupStarts, swung } from './groove';

export type InstrumentId = GrooveInstrument;

export interface PlaySlot {
  midis: number[];
  bars: number;
  /** pitch class for the backing bassist */
  rootPc: number;
  /** this slot's own meter, when a song strings together sections in different meters */
  meter?: Meter;
}

/** Where the loop is right now — what lets a played note be placed on the timeline. */
export interface TransportPosition {
  pass: number;
  /** beats since the top of this pass */
  beat: number;
  bpm: number;
  transpose: number;
}

export interface Mix {
  chords: boolean;
  bass: boolean;
  drums: boolean;
}

export interface PassInfo {
  pass: number;
  bpm: number;
  /** semitones this pass is transposed by (truck-driver repeat) */
  transpose: number;
}

export interface PlayOptions {
  bpm: number;
  swing?: number;
  pattern: StrumHit[];
  instrument: InstrumentId;
  /** timbre for the chord part, when it should differ from the studied instrument */
  backingVoice?: InstrumentId;
  drums?: DrumPattern;
  /** run chords as an arpeggio instead of pattern strums */
  arp?: boolean;
  meter?: Meter;
  /** click one bar before the first pass */
  countIn?: boolean;
  /** tempo trainer: start at a fraction of the tempo and climb every pass */
  ramp?: { startPct: number; stepPct: number };
  /** every other pass goes up by this many semitones */
  modulate?: number | null;
  /** demo lick, read fresh at the top of every pass */
  lead?: () => LeadNote[] | null;
  onSlot?: (index: number | null) => void;
  onLead?: (midi: number | null) => void;
  onPass?: (info: PassInfo) => void;
  /** stop by itself after this many passes (ear-training rounds, song play-throughs) */
  maxPasses?: number;
  onEnd?: () => void;
}

export interface SeqStep {
  /** seconds from now */
  at: number;
  midis: number[];
  dur: number;
  vel?: number;
}

type BusId = 'chords' | 'bass' | 'drums' | 'lead' | 'ui';

interface Bus {
  pluckIn: AudioNode;
  synthIn: AudioNode;
  out: GainNode;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<BusId, Bus>;
  private pluckCache = new Map<number, AudioBuffer>();
  private generation = 0;
  private timers: number[] = [];
  private liveSources: AudioScheduledSourceNode[] = [];
  private volume = 0.85;
  private mix: Mix = { chords: true, bass: true, drums: true };
  private leadOn = false;
  /** start time and tempo of every scheduled pass, newest last */
  private passes: { start: number; pass: number; bpm: number; transpose: number }[] = [];
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
      this.buses = {
        chords: this.makeBus(this.mix.chords ? 1 : 0, 4200, 0.5),
        bass: this.makeBus(this.mix.bass ? 1 : 0, 2400, 0.5),
        drums: this.makeBus(this.mix.drums ? 1 : 0, 4200, 0.5),
        // the lead sits forward: brighter string, hotter synth
        lead: this.makeBus(this.leadOn ? 1.15 : 0, 6200, 0.66),
        ui: this.makeBus(1, 4200, 0.5),
      };
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private makeBus(level: number, pluckCutoff: number, synthLevel: number): Bus {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(this.master);
    const pluckIn = ctx.createBiquadFilter();
    pluckIn.type = 'lowpass';
    pluckIn.frequency.value = pluckCutoff;
    pluckIn.connect(out);
    const synthIn = ctx.createGain();
    synthIn.gain.value = synthLevel;
    synthIn.connect(out);
    return { pluckIn, synthIn, out };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  /** Pull a player out of the band (or put them back) without stopping the loop. */
  setMix(mix: Mix): void {
    this.mix = mix;
    if (!this.ctx) return;
    for (const id of ['chords', 'bass', 'drums'] as const) {
      this.buses[id].out.gain.setTargetAtTime(mix[id] ? 1 : 0, this.ctx.currentTime, 0.03);
    }
  }

  /** The shared clock: inputs stamp their notes with this so they line up with the loop. */
  now(): number {
    return this.ensure().currentTime;
  }

  /** The engine's context, for an input (the mic) that has to live on the same clock. */
  context(): AudioContext {
    return this.ensure();
  }

  /** Loop position at time `at` (default: now); null when nothing is playing or the count-in is still running. */
  position(at?: number): TransportPosition | null {
    if (!this.ctx) return null;
    const t = at ?? this.ctx.currentTime;
    for (let i = this.passes.length - 1; i >= 0; i--) {
      const p = this.passes[i];
      if (p.start <= t + 1e-4) return { pass: p.pass, beat: (t - p.start) * (p.bpm / 60), bpm: p.bpm, transpose: p.transpose };
    }
    return null;
  }

  /** The demo lick is always scheduled; this gate decides whether anyone hears it. */
  setLead(on: boolean): void {
    this.leadOn = on;
    if (this.ctx) this.buses.lead.out.gain.setTargetAtTime(on ? 1.15 : 0, this.ctx.currentTime, 0.02);
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

  private pluck(midi: number, when: number, vel: number, cutAfter: number | undefined, bus: BusId): void {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi);
    const gain = ctx.createGain();
    gain.gain.value = vel * 0.6;
    if (cutAfter !== undefined) {
      gain.gain.setValueAtTime(vel * 0.6, when + Math.max(0.04, cutAfter - 0.05));
      gain.gain.linearRampToValueAtTime(0.0001, when + cutAfter + 0.03);
    }
    src.connect(gain).connect(this.buses[bus].pluckIn);
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
  private piano(midi: number, when: number, dur: number, vel: number, bus: BusId): void {
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
    filter.connect(gain).connect(this.buses[bus].synthIn);
    osc1.start(when); osc2.start(when);
    osc1.stop(when + dur + 0.8); osc2.stop(when + dur + 0.8);
    this.track(osc1); this.track(osc2);
  }

  /** One note on the right voice for the instrument. */
  private voice(midi: number, when: number, dur: number, vel: number, instrument: InstrumentId, bus: BusId): void {
    if (instrument === 'guitar') this.pluck(midi, when, vel, dur, bus);
    else if (instrument === 'bass') this.pluck(midi, when, Math.min(1, vel * 1.15), dur + 0.4, bus);
    else if (instrument === 'piano') this.piano(midi, when, dur, vel, bus);
    else this.synth(midi, when, dur, vel, bus);
  }

  private synth(midi: number, when: number, dur: number, vel: number, bus: BusId): void {
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
    filter.connect(gain).connect(this.buses[bus].synthIn);
    osc1.start(when); osc2.start(when);
    osc1.stop(when + dur + 0.6); osc2.stop(when + dur + 0.6);
    this.track(osc1); this.track(osc2);
  }

  /** Notes sounded together, with the stagger each instrument would give them. */
  private hit(midis: number[], when: number, dur: number, vel: number, instrument: InstrumentId, bus: BusId): void {
    const gap = instrument === 'guitar' ? 0.014 : instrument === 'piano' ? 0.006 : 0.004;
    midis.forEach((m, i) => {
      this.voice(m, when + i * gap, dur, instrument === 'guitar' ? vel * (1 - i * 0.04) : vel, instrument, bus);
    });
  }

  /** One chord: strummed (guitar), a quick R–5–8 walk (bass) or near-block (keys). */
  strum(midis: number[], instrument: InstrumentId, when?: number, vel = 0.9, dur = 1.8): void {
    const ctx = this.ensure();
    const t0 = when ?? ctx.currentTime + 0.03;
    if (instrument === 'bass') {
      midis.slice(0, 3).forEach((m, i) => this.voice(m, t0 + i * 0.16, dur, vel * (1 - i * 0.12), 'bass', 'ui'));
      return;
    }
    this.hit(midis, t0, dur, vel, instrument, 'ui');
  }

  /** A single note, right now — for clicking around the solo map. Never interrupts the loop. */
  note(midi: number, instrument: InstrumentId, dur = 0.9): void {
    const ctx = this.ensure();
    this.voice(midi, ctx.currentTime + 0.01, dur, 0.92, instrument, 'ui');
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
    osc.connect(gain).connect(this.buses.drums.out);
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
    noise.connect(bp).connect(ng).connect(this.buses.drums.out);
    noise.start(when);
    noise.stop(when + 0.2);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, when);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.28 * vel, when);
    bg.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
    body.connect(bg).connect(this.buses.drums.out);
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
    noise.connect(hp).connect(g).connect(this.buses.drums.out);
    noise.start(when);
    noise.stop(when + 0.06);
    this.track(noise);
  }

  /** Count-in stick click — on the ui bus so it survives a muted drummer. */
  private click(when: number, accent: boolean): void {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1760 : 1175;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.22 : 0.14, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(g).connect(this.buses.ui.out);
    osc.start(when);
    osc.stop(when + 0.07);
    this.track(osc);
  }

  private after(when: number, fn: () => void): void {
    const gen = this.generation;
    const delay = Math.max(0, (when - this.ensure().currentTime) * 1000);
    this.timers.push(window.setTimeout(() => {
      if (gen === this.generation) fn();
    }, delay));
  }

  /** A run up a scale (and back down for the full effect). */
  playScale(midis: number[], instrument: InstrumentId, bpm = 132): void {
    this.stop();
    const ctx = this.ensure();
    const eighth = 30 / bpm;
    const seq = [...midis, ...[...midis].reverse().slice(1)];
    seq.forEach((m, i) => {
      const t = ctx.currentTime + 0.05 + i * eighth;
      const dur = instrument === 'guitar' || instrument === 'bass' ? eighth * 1.6 : eighth * 0.92;
      this.voice(m, t, dur, instrument === 'guitar' || instrument === 'bass' ? 0.85 : 0.8, instrument, 'ui');
    });
  }

  /** A hand-built sequence (transition demos): chords and single voices on a timeline. */
  playSequence(steps: SeqStep[], instrument: InstrumentId, onStep?: (index: number | null) => void): void {
    this.stop();
    const ctx = this.ensure();
    const t0 = ctx.currentTime + 0.05;
    // chords ring on a keyboard voice when the instrument is bass, so the harmony is audible
    const voiceId: InstrumentId = instrument === 'bass' ? 'piano' : instrument;
    let end = 0;
    steps.forEach((step, i) => {
      this.hit(step.midis, t0 + step.at, step.dur, step.vel ?? 0.85, voiceId, 'ui');
      this.after(t0 + step.at, () => onStep?.(i));
      end = Math.max(end, step.at + step.dur);
    });
    this.after(t0 + end, () => onStep?.(null));
  }

  /** Loop a progression with the genre's groove. Returns a stop fn. */
  play(slots: PlaySlot[], opts: PlayOptions): () => void {
    this.stop();
    const ctx = this.ensure();
    const gen = this.generation;
    const swing = opts.swing ?? 0;
    const perBar = beatsPerBar(opts.meter);
    const chordVoice: InstrumentId = opts.instrument === 'bass' ? 'bass' : opts.backingVoice ?? opts.instrument;
    const bpmOf = (pass: number): number =>
      opts.ramp ? opts.bpm * Math.min(1, (opts.ramp.startPct + pass * opts.ramp.stepPct) / 100) : opts.bpm;

    const schedulePass = (passStart: number, pass: number) => {
      if (gen !== this.generation) return;
      if (opts.maxPasses && pass >= opts.maxPasses) {
        this.after(passStart + 0.4, () => opts.onEnd?.());
        return;
      }
      const bpm = bpmOf(pass);
      const beat = 60 / bpm;
      const transpose = opts.modulate && pass % 2 === 1 ? opts.modulate : 0;
      this.passes.push({ start: passStart, pass, bpm, transpose });
      if (this.passes.length > 8) this.passes.shift();
      this.after(passStart, () => opts.onPass?.({ pass, bpm, transpose }));

      let cursor = passStart;
      slots.forEach((slot, slotIdx) => {
        const slotStart = cursor;
        this.after(slotStart, () => opts.onSlot?.(slotIdx));
        const slotBar = slot.meter ? beatsPerBar(slot.meter) : perBar;
        const totalBeats = slot.bars * slotBar;
        const sounding = {
          midis: slot.midis.map((m) => m + transpose),
          rootPc: slot.rootPc + transpose,
        };
        for (let b0 = 0; b0 < totalBeats - 1e-6; b0 += slotBar) {
          const span = Math.min(slotBar, totalBeats - b0); // shorter for fractional-bar slots
          const barStart = slotStart + b0 * beat;
          const ev = barEvents(sounding, span, {
            pattern: opts.pattern, drums: opts.drums, swing, arp: !!opts.arp,
            instrument: opts.instrument, meter: slot.meter ?? opts.meter,
          });
          for (const h of ev.chords) this.hit(h.midis, barStart + h.beat * beat, h.dur * beat, h.vel, chordVoice, 'chords');
          for (const h of ev.pad) this.hit(h.midis, barStart + h.beat * beat, h.dur * beat, h.vel, 'op1', 'chords');
          for (const h of ev.bass) this.voice(h.midi, barStart + h.beat * beat, h.dur * beat, h.vel, 'bass', 'bass');
          for (const d of ev.drums) {
            const t = barStart + d.beat * beat;
            if (d.drum === 'kick') this.kick(t, d.vel);
            else if (d.drum === 'snare') this.snare(t, d.vel);
            else this.hat(t, d.vel);
          }
        }
        cursor += totalBeats * beat;
      });

      for (const n of opts.lead?.() ?? []) {
        // swing only reads right when bars are whole beats long
        const at = passStart + (opts.meter ? n.beat : swung(n.beat, swing)) * beat;
        if (at >= cursor - 1e-6) continue;
        const midi = n.midi + transpose;
        this.voice(midi, at, n.dur * beat, n.vel, opts.instrument, 'lead');
        this.after(at, () => opts.onLead?.(midi));
        this.after(at + n.dur * beat, () => opts.onLead?.(null));
      }

      this.timers.push(window.setTimeout(
        () => schedulePass(cursor, pass + 1),
        Math.max(0, (cursor - ctx.currentTime - 0.3) * 1000),
      ));
    };

    let start = ctx.currentTime + 0.06;
    if (opts.countIn) {
      const beat = 60 / bpmOf(0);
      const clicks = opts.meter ? groupStarts(opts.meter) : [0, 1, 2, 3];
      clicks.forEach((b, i) => this.click(start + b * beat, i === 0));
      start += perBar * beat;
    }
    schedulePass(start, 0);
    return () => this.stop();
  }

  stop(): void {
    this.generation++;
    this.passes = [];
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    for (const src of this.liveSources) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    this.liveSources = [];
  }
}

export const audio = new AudioEngine();
