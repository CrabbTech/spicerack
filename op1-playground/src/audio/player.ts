// Playback via Tone.js: an OP-1-flavored soft synth for chords, a brighter
// lead for the melody, transport-scheduled with manual swing (the same swing
// math the MIDI export uses, so what you hear is what you drag into a DAW).

import * as Tone from 'tone';

export type ArpStyle = 'off' | 'up' | 'down' | 'updown';

export interface PlaySlotSpec {
  midis: number[];
  bars: number;
}

export interface PlayMelodyNote {
  start: number; // absolute beats
  dur: number; // beats
  midi: number;
}

export interface PlaySpec {
  slots: PlaySlotSpec[];
  melody: PlayMelodyNote[];
  bpm: number;
  swing: number; // 0..1
  arp: ArpStyle;
  chordsOn: boolean;
  melodyOn: boolean;
  /** beats per bar for the click accents (default 4) */
  beatsPerBar?: number;
  /** count-in beats played before beat 0; the loop skips them on repeats */
  countInBeats?: number;
  /** metronome through the material (the count-in always clicks) */
  click?: boolean;
  onSlot?: (index: number | null) => void;
  onMelody?: (midi: number | null) => void;
  /** hardware out: (midi, velocity 0..1, durMs, atMs perf-timestamp) */
  midiSend?: (midi: number, vel: number, durMs: number, atMs: number) => void;
}

/** Strum pattern for un-arped chords, per 4-beat bar. */
const CHORD_HITS = [
  { beat: 0, dur: 1.9, vel: 0.85 },
  { beat: 2, dur: 1.35, vel: 0.62 },
  { beat: 3.5, dur: 0.45, vel: 0.5 },
];

export const swungBeat = (beat: number, swing: number): number =>
  beat + (Math.abs((beat % 1) - 0.5) < 0.01 ? swing / 6 : 0);

interface ChordEvent { time: number; midis: number[]; dur: number; vel: number; slotIdx: number | null }
interface MelodyEvent { time: number; midi: number; dur: number; vel: number }

export interface ClickEvent { time: number; accent: boolean }

/**
 * Metronome schedule in seconds: every beat of the count-in (first beat
 * accented), then — only when `through` — every beat of the material with
 * accents on bar starts.
 */
export function clickEvents(
  countInBeats: number, totalBeats: number, beatsPerBar: number, spb: number, through: boolean,
): ClickEvent[] {
  const out: ClickEvent[] = [];
  for (let b = 0; b < countInBeats; b++) out.push({ time: b * spb, accent: b === 0 });
  if (through) {
    for (let b = 0; b < totalBeats; b++) {
      out.push({ time: (countInBeats + b) * spb, accent: b % beatsPerBar === 0 });
    }
  }
  return out;
}

/** Expand slots into swung chord events + slot-highlight markers (seconds). */
export function chordEvents(spec: PlaySpec, spb: number): ChordEvent[] {
  const out: ChordEvent[] = [];
  let cursor = 0;
  spec.slots.forEach((slot, slotIdx) => {
    const totalBeats = slot.bars * 4;
    out.push({ time: cursor * spb, midis: [], dur: 0, vel: 0, slotIdx }); // highlight marker
    if (spec.chordsOn && slot.midis.length) {
      for (let b0 = 0; b0 < totalBeats - 1e-6; b0 += 4) {
        const span = Math.min(4, totalBeats - b0);
        const barStart = cursor + b0;
        if (spec.arp !== 'off') {
          const up = [...slot.midis].sort((a, b) => a - b);
          const seq = spec.arp === 'down' ? [...up].reverse()
            : spec.arp === 'updown' ? [...up, ...[...up].reverse().slice(1, -1)] : up;
          const steps = Math.round(span * 2);
          for (let step = 0; step < steps; step++) {
            out.push({
              time: (barStart + swungBeat(step / 2, spec.swing)) * spb,
              midis: [seq[step % seq.length]],
              dur: 0.55 * spb,
              vel: step % 2 === 0 ? 0.78 : 0.55,
              slotIdx: null,
            });
          }
        }
        else {
          for (const hit of CHORD_HITS) {
            if (hit.beat >= span - 1e-6) continue;
            out.push({
              time: (barStart + swungBeat(hit.beat, spec.swing)) * spb,
              midis: slot.midis,
              dur: hit.dur * spb,
              vel: hit.vel,
              slotIdx: null,
            });
          }
        }
      }
    }
    cursor += totalBeats;
  });
  return out;
}

class Player {
  private chordSynth: Tone.PolySynth | null = null;
  private melodySynth: Tone.Synth | null = null;
  private clickSynth: Tone.Synth | null = null;
  private parts: Tone.Part[] = [];
  private started = false;

  private async ensure(): Promise<void> {
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }
    if (!this.chordSynth) {
      const filter = new Tone.Filter(2600, 'lowpass');
      const chordVol = new Tone.Volume(-11);
      this.chordSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.015, decay: 0.25, sustain: 0.55, release: 0.35 },
      }).chain(filter, chordVol, Tone.getDestination());

      const delay = new Tone.PingPongDelay('8n', 0.18);
      delay.wet.value = 0.12;
      const leadVol = new Tone.Volume(-8);
      this.melodySynth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.35, release: 0.2 },
      }).chain(new Tone.Filter(3800, 'lowpass'), delay, leadVol, Tone.getDestination());

      this.clickSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
      }).chain(new Tone.Volume(-9), Tone.getDestination());
    }
  }

  async audition(midis: number[], midiSend?: PlaySpec['midiSend']): Promise<void> {
    await this.ensure();
    const now = Tone.now();
    const freqs = midis.map((m) => Tone.Frequency(m, 'midi').toFrequency());
    this.chordSynth!.triggerAttackRelease(freqs, 1.4, now + 0.02, 0.8);
    if (midiSend) for (const m of midis) midiSend(m, 0.8, 1400, performance.now() + 20);
  }

  async auditionNote(midi: number): Promise<void> {
    await this.ensure();
    this.melodySynth!.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), 0.35, Tone.now() + 0.02, 0.8);
  }

  async play(spec: PlaySpec): Promise<void> {
    await this.ensure();
    this.stop();
    const transport = Tone.getTransport();
    const spb = 60 / spec.bpm;
    const totalBeats = spec.slots.reduce((sum, s) => sum + s.bars * 4, 0);
    if (totalBeats <= 0) return;
    const countIn = Math.max(0, spec.countInBeats ?? 0);
    const off = countIn * spb;
    transport.bpm.value = spec.bpm;
    transport.loop = true;
    transport.loopStart = off; // repeats skip the count-in
    transport.loopEnd = off + totalBeats * spb;

    const draw = Tone.getDraw();
    const chordPart = new Tone.Part<ChordEvent>((time, ev) => {
      if (ev.slotIdx !== null) {
        draw.schedule(() => spec.onSlot?.(ev.slotIdx), time);
        return;
      }
      const freqs = ev.midis.map((m) => Tone.Frequency(m, 'midi').toFrequency());
      this.chordSynth!.triggerAttackRelease(freqs, ev.dur, time, ev.vel);
      if (spec.midiSend) {
        const atMs = performance.now() + Math.max(0, (time - Tone.now()) * 1000);
        for (const m of ev.midis) spec.midiSend(m, ev.vel, ev.dur * 1000, atMs);
      }
    }, chordEvents(spec, spb).map((ev) => ({ ...ev, time: ev.time + off })));
    chordPart.start(0);
    this.parts.push(chordPart);

    const clicks = clickEvents(countIn, totalBeats, spec.beatsPerBar ?? 4, spb, spec.click === true);
    if (clicks.length) {
      const clickPart = new Tone.Part<ClickEvent>((time, ev) => {
        this.clickSynth!.triggerAttackRelease(ev.accent ? 1660 : 1108, 0.03, time, ev.accent ? 0.9 : 0.55);
      }, clicks);
      clickPart.start(0);
      this.parts.push(clickPart);
    }

    if (spec.melodyOn && spec.melody.length) {
      const events: MelodyEvent[] = spec.melody.map((n) => ({
        time: swungBeat(n.start, spec.swing) * spb + off,
        midi: n.midi,
        dur: Math.max(0.1, n.dur * spb * 0.92),
        vel: 0.85,
      }));
      const melodyPart = new Tone.Part<MelodyEvent>((time, ev) => {
        this.melodySynth!.triggerAttackRelease(Tone.Frequency(ev.midi, 'midi').toFrequency(), ev.dur, time, ev.vel);
        draw.schedule(() => spec.onMelody?.(ev.midi), time);
        if (spec.midiSend) {
          const atMs = performance.now() + Math.max(0, (time - Tone.now()) * 1000);
          spec.midiSend(ev.midi, ev.vel, ev.dur * 1000, atMs);
        }
      }, events);
      melodyPart.start(0);
      this.parts.push(melodyPart);
    }

    transport.start('+0.05');
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.loop = false;
    for (const part of this.parts) part.dispose();
    this.parts = [];
    this.chordSynth?.releaseAll();
  }

  get playing(): boolean {
    return Tone.getTransport().state === 'started';
  }
}

export const player = new Player();
