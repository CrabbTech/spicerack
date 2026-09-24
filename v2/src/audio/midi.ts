// Standard MIDI File (type 1) writer: chords + bass + optional drums and demo
// lick, built from the same bar events the play button schedules — so meters,
// the gear-change repeat and the groove all land in the DAW as you heard them.
// Pure TS, no deps.

import { DrumPattern, StrumHit } from '../data/genres';
import { LeadNote } from '../theory/lick';
import { InstrumentId } from './engine';
import { BRAND } from '../brand';
import { Meter, barEvents, beatsPerBar, swung, timeSignature } from './groove';

export interface MidiExportSlot {
  midis: number[];
  bars: number;
  rootPc: number;
  /** this slot's own meter, when a song strings together sections in different meters */
  meter?: Meter;
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
  meter?: Meter;
  /** truck-driver repeat: write the loop twice, the second time up this many semitones */
  modulate?: number | null;
  /** demo lick to include as its own track */
  lead?: LeadNote[] | null;
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

const DRUM_NOTE = { kick: 36, snare: 38, hat: 42 } as const;

export function buildMidiFile(slots: MidiExportSlot[], opts: MidiExportOptions): Uint8Array {
  const sig = timeSignature(opts.meter);
  const meta = new TrackBuilder();
  meta.meta(0x03, ascii(opts.name));
  meta.meta(0x51, [...u32(Math.round(60_000_000 / opts.bpm)).slice(1)]); // 3-byte µs/quarter
  meta.meta(0x58, [sig.numerator, sig.denomPow, sig.denomPow === 3 ? 36 : 24, 8]);

  const PROGRAMS: Record<InstrumentId, number> = { guitar: 25, bass: 33, piano: 0, op1: 4 };
  const chords = new TrackBuilder();
  chords.meta(0x03, ascii(opts.instrument === 'bass' ? 'Bass line' : 'Chords'));
  chords.program(0, PROGRAMS[opts.instrument]); // steel guitar / fingered bass / grand / e-piano

  const bass = new TrackBuilder();
  bass.meta(0x03, ascii('Bass'));
  bass.program(1, 33); // fingered bass

  const drums = new TrackBuilder();
  drums.meta(0x03, ascii('Drums'));

  const lead = new TrackBuilder();
  lead.meta(0x03, ascii('Lead (demo lick)'));
  lead.program(2, opts.instrument === 'guitar' ? 27 : opts.instrument === 'bass' ? 33 : 80); // clean electric / bass / square lead

  const perBar = beatsPerBar(opts.meter);
  const ticks = (beats: number): number => Math.round(beats * TPQ);
  // the same passes the play button makes: once at pitch, then the gear change
  const passes = opts.modulate ? [0, opts.modulate] : [0];
  let cursor = 0;
  let sigNow = sig;
  for (const transpose of passes) {
    const passStart = cursor;
    for (const slot of slots) {
      const slotMeter = slot.meter ?? opts.meter;
      const slotBar = slot.meter ? beatsPerBar(slot.meter) : perBar;
      const slotSig = timeSignature(slotMeter);
      if (slotSig.numerator !== sigNow.numerator || slotSig.denomPow !== sigNow.denomPow) {
        sigNow = slotSig;
        meta.meta(0x58, [slotSig.numerator, slotSig.denomPow, slotSig.denomPow === 3 ? 36 : 24, 8], cursor);
      }
      const totalBeats = slot.bars * slotBar;
      const sounding = { midis: slot.midis.map((m) => m + transpose), rootPc: slot.rootPc + transpose };
      for (let b0 = 0; b0 < totalBeats - 1e-6; b0 += slotBar) {
        const span = Math.min(slotBar, totalBeats - b0); // shorter for fractional-bar slots
        const barStart = cursor + ticks(b0);
        const ev = barEvents(sounding, span, {
          pattern: opts.pattern, drums: opts.drums, swing: opts.swing, arp: opts.arp,
          instrument: opts.instrument, meter: slotMeter,
        });
        for (const h of [...ev.chords, ...ev.pad]) {
          for (const m of h.midis) chords.note(0, m, barStart + ticks(h.beat), ticks(h.dur), h.vel * 112);
        }
        for (const h of ev.bass) bass.note(1, h.midi, barStart + ticks(h.beat), ticks(h.dur), h.vel * 112);
        if (opts.includeDrums) {
          for (const d of ev.drums) drums.note(9, DRUM_NOTE[d.drum], barStart + ticks(d.beat), d.drum === 'hat' ? 40 : 60, d.vel * (d.drum === 'hat' ? 80 : 110));
        }
      }
      cursor += ticks(totalBeats);
    }
    for (const n of opts.lead ?? []) {
      const at = passStart + ticks(opts.meter ? n.beat : swung(n.beat, opts.swing));
      if (at < cursor) lead.note(2, n.midi + transpose, at, ticks(n.dur), n.vel * 118);
    }
  }

  // when the instrument *is* the bass, the chords track already carries the low end
  const trackList = [
    meta, chords,
    ...(opts.instrument === 'bass' ? [] : [bass]),
    ...(opts.includeDrums && opts.drums ? [drums] : []),
    ...(opts.lead?.length ? [lead] : []),
  ];
  const body = trackList.flatMap((t) => encodeTrack(t.events));
  const header = [...ascii('MThd'), ...u32(6), ...u16(1), ...u16(trackList.length), ...u16(TPQ)];
  return new Uint8Array([...header, ...body]);
}

/** Suggested filename, e.g. "quire-night-drive-a-minor.mid". */
export function midiFilename(template: string, keyLabel: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${BRAND.fileSlug}-${slug(template)}-${slug(keyLabel)}.mid`;
}
