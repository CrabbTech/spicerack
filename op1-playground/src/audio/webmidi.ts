// Hardware out: send the playground straight to a real OP-1 Field (or any
// synth) over USB via the Web MIDI API. Chrome-family browsers only.

export interface MidiOutInfo {
  id: string;
  name: string;
}

class WebMidiOut {
  readonly supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  private access: MIDIAccess | null = null;

  async listOutputs(): Promise<MidiOutInfo[]> {
    if (!this.supported) return [];
    try {
      this.access ??= await navigator.requestMIDIAccess({ sysex: false });
    }
    catch {
      return [];
    }
    return [...this.access.outputs.values()].map((o) => ({ id: o.id, name: o.name ?? o.id }));
  }

  /** Note on now (or at `atMs`), note off after `durMs`. Channel 1. */
  send(outputId: string, midi: number, vel: number, durMs: number, atMs?: number): void {
    const out = this.access?.outputs.get(outputId);
    if (!out) return;
    const at = atMs ?? performance.now();
    const velocity = Math.max(1, Math.min(127, Math.round(vel * 127)));
    const note = Math.max(0, Math.min(127, Math.round(midi)));
    out.send([0x90, note, velocity], at);
    out.send([0x80, note, 0], at + Math.max(30, durMs));
  }

  allNotesOff(outputId: string): void {
    const out = this.access?.outputs.get(outputId);
    out?.send([0xb0, 123, 0]); // CC 123: all notes off
  }
}

export const webMidiOut = new WebMidiOut();
