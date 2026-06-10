// Standard MIDI File (type 1) writer: chords + bass + optional drums, using
// the same groove the play button uses, so what you drag into the DAW is what
// you heard. Pure TS, no deps.

import { mod12 } from '../theory/notes';
import { DrumPattern, StrumHit } from '../data/genres';
import { InstrumentId } from './engine';

export interface MidiExportSlot {
  midis: number[];
  bars: number;
  rootPc: number;
}

export interface MidiExportOptions {
  name: string;
  bpm: number;
  swing: number;
  pattern: StrumHit[];
  drums?: DrumPattern;
  includeDrums: boolean;
  arp: boolean;
  instrument: InstrumentId;
}

const TPQ = 480;

interface TrackEvent {
  tick: number;
  /** sort order at equal ticks: note-offs first */
  order: number;
  bytes: number[];
}

function vlq(n: number): number[] {
  if (n < 0) n = 0;
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0) & 0x7f);

function encodeTrack(events: TrackEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const bytes: number[] = [];
  let last = 0;
  for (const e of sorted) {
    bytes.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  bytes.push(...vlq(0), 0xff, 0x2f, 0x00);
  return [...ascii('MTrk'), ...u32(bytes.length), ...bytes];
}

class TrackBuilder {
  events: TrackEvent[] = [];
  meta(type: number, data: number[], tick = 0): void {
    this.events.push({ tick, order: 0, bytes: [0xff, type, data.length, ...data] });
  }
  program(channel: number, program: number, tick = 0): void {
    this.events.push({ tick, order: 0, bytes: [0xc0 | channel, program & 0x7f] });
  }
  note(channel: number, midi: number, tick: number, durTicks: number, vel: number): void {
    const m = Math.max(0, Math.min(127, Math.round(midi)));
    const v = Math.max(1, Math.min(127, Math.round(vel)));
    this.events.push({ tick, order: 1, bytes: [0x90 | channel, m, v] });
    this.events.push({ tick: tick + Math.max(24, Math.round(durTicks)), order: 0, bytes: [0x80 | channel, m, 0] });
  }
}

const swungBeat = (beat: number, swing: number): number =>
  beat + (Math.abs((beat % 1) - 0.5) < 0.01 ? swing / 6 : 0);

export function buildMidiFile(slots: MidiExportSlot[], opts: MidiExportOptions): Uint8Array {
  const meta = new TrackBuilder();
  meta.meta(0x03, ascii(opts.name));
  meta.meta(0x51, [...u32(Math.round(60_000_000 / opts.bpm)).slice(1)]); // 3-byte µs/quarter
  meta.meta(0x58, [4, 2, 24, 8]); // 4/4

  const PROGRAMS: Record<InstrumentId, number> = { guitar: 25, bass: 33, piano: 0, op1: 4 };
  const chords = new TrackBuilder();
  chords.meta(0x03, ascii(opts.instrument === 'bass' ? 'Bass line' : 'Chords'));
  chords.program(0, PROGRAMS[opts.instrument]); // steel guitar / fingered bass / grand / e-piano

  const bass = new TrackBuilder();
  bass.meta(0x03, ascii('Bass'));
  bass.program(1, 33); // fingered bass

  const drums = new TrackBuilder();
  drums.meta(0x03, ascii('Drums'));

  let cursor = 0;
  for (const slot of slots) {
    const totalBeats = slot.bars * 4;
    for (let b0 = 0; b0 < totalBeats - 1e-6; b0 += 4) {
      const span = Math.min(4, totalBeats - b0); // < 4 for fractional-bar slots
      const barStart = cursor + Math.round(b0 * TPQ);
      if (opts.instrument === 'bass' && slot.midis.length) {
        // mirror the play button: root/fifth on pattern hits, or an R-5-8-5 walk
        const root = slot.midis[0];
        const fifth = slot.midis[1] ?? root;
        const octave = slot.midis[2] ?? root;
        if (opts.arp) {
          const seq = [root, fifth, octave, fifth];
          const steps = Math.round(span * 2);
          for (let step = 0; step < steps; step++) {
            const tick = barStart + Math.round(swungBeat(step / 2, opts.swing) * TPQ);
            chords.note(0, seq[step % seq.length], tick, TPQ * 0.5, step % 2 === 0 ? 104 : 80);
          }
        }
        else {
          for (const hit of opts.pattern) {
            if (hit.beat >= span - 1e-6) continue;
            const tick = barStart + Math.round(swungBeat(hit.beat, opts.swing) * TPQ);
            chords.note(0, hit.beat < 2 ? root : fifth, tick, hit.durBeats * TPQ, hit.vel * 112);
          }
        }
      }
      else if (opts.arp && slot.midis.length) {
        const seq = [...slot.midis].sort((a, b) => a - b);
        const steps = Math.round(span * 2);
        for (let step = 0; step < steps; step++) {
          const tick = barStart + Math.round(swungBeat(step / 2, opts.swing) * TPQ);
          chords.note(0, seq[step % seq.length], tick, TPQ * 0.5, step % 2 === 0 ? 100 : 74);
        }
      }
      else {
        for (const hit of opts.pattern) {
          if (hit.beat >= span - 1e-6) continue;
          const tick = barStart + Math.round(swungBeat(hit.beat, opts.swing) * TPQ);
          for (const m of slot.midis) {
            chords.note(0, m, tick, hit.durBeats * TPQ, hit.vel * 112);
          }
        }
      }
      if (opts.instrument !== 'bass') {
        const bassMidi = 28 + mod12(slot.rootPc - 4); // E1..D#2
        bass.note(1, bassMidi, barStart, Math.min(1.9, span) * TPQ, 98);
        if (span > 2) bass.note(1, bassMidi, barStart + 2 * TPQ, TPQ * 1.9, 88);
      }
      if (opts.includeDrums && opts.drums) {
        for (const b of opts.drums.kick) if (b < span) drums.note(9, 36, barStart + Math.round(b * TPQ), 60, 112);
        for (const b of opts.drums.snare) if (b < span) drums.note(9, 38, barStart + Math.round(b * TPQ), 60, 102);
        for (const b of opts.drums.hat) {
          if (b >= span) continue;
          drums.note(9, 42, barStart + Math.round(swungBeat(b, opts.swing) * TPQ), 40, Math.abs((b % 1) - 0.5) < 0.01 ? 64 : 80);
        }
      }
    }
    cursor += Math.round(totalBeats * TPQ);
  }

  // when the instrument *is* the bass, the chords track already carries the low end
  const trackList = [meta, chords, ...(opts.instrument === 'bass' ? [] : [bass]), ...(opts.includeDrums && opts.drums ? [drums] : [])];
  const body = trackList.flatMap((t) => encodeTrack(t.events));
  const header = [...ascii('MThd'), ...u32(6), ...u16(1), ...u16(trackList.length), ...u16(TPQ)];
  return new Uint8Array([...header, ...body]);
}

/** Suggested filename, e.g. "spicerack-night-drive-a-minor.mid". */
export function midiFilename(template: string, keyLabel: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `spicerack-${slug(template)}-${slug(keyLabel)}.mid`;
}
