// MIDI export via @tonejs/midi — chords track + melody track with the same
// swing math the play button uses.

import { Midi } from '@tonejs/midi';
import { ArpStyle, PlayMelodyNote, PlaySlotSpec, chordEvents, swungBeat } from './player';

export interface MidiExportSpec {
  name: string;
  bpm: number;
  swing: number;
  arp: ArpStyle;
  slots: PlaySlotSpec[];
  melody: PlayMelodyNote[];
  includeChords: boolean;
  includeMelody: boolean;
}

export function buildMidiFile(spec: MidiExportSpec): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(spec.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  midi.header.name = spec.name;
  const ppq = midi.header.ppq;
  const spb = 60 / spec.bpm; // chordEvents works in seconds; convert back to beats

  if (spec.includeChords) {
    const track = midi.addTrack();
    track.name = 'OP-1 chords';
    track.instrument.number = 4; // electric piano 1
    for (const ev of chordEvents({
      slots: spec.slots, melody: [], bpm: spec.bpm, swing: spec.swing, arp: spec.arp,
      chordsOn: true, melodyOn: false,
    }, spb)) {
      if (ev.slotIdx !== null) continue; // highlight markers, not notes
      for (const m of ev.midis) {
        track.addNote({
          midi: m,
          ticks: Math.round((ev.time / spb) * ppq),
          durationTicks: Math.max(24, Math.round((ev.dur / spb) * ppq)),
          velocity: ev.vel,
        });
      }
    }
  }

  if (spec.includeMelody && spec.melody.length) {
    const track = midi.addTrack();
    track.name = 'OP-1 melody';
    track.instrument.number = 80; // square lead
    for (const n of spec.melody) {
      track.addNote({
        midi: n.midi,
        ticks: Math.round(swungBeat(n.start, spec.swing) * ppq),
        durationTicks: Math.max(24, Math.round(n.dur * 0.92 * ppq)),
        velocity: 0.85,
      });
    }
  }

  return new Uint8Array(midi.toArray());
}

export function midiFilename(keyName: string): string {
  const slug = keyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `op1-playground-${slug}.mid`;
}

export function downloadBlob(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
