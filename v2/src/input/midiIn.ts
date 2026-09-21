// Web MIDI in: an OP-1 field (or any controller) over USB. Available in
// Chromium browsers; WKWebView — the Tauri shell on macOS — doesn't ship Web
// MIDI, so callers must treat `null` as "not on this platform" and offer the
// mic or the computer keyboard instead.

export interface MidiInHandle {
  stop(): void;
}

export type MidiNoteHandler = (midi: number, on: boolean, velocity: number, timeStampMs: number) => void;

export const midiInSupported = (): boolean => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

export async function openMidiIn(onNote: MidiNoteHandler, onPorts: (names: string[]) => void): Promise<MidiInHandle | null> {
  if (!midiInSupported()) return null;
  let access: MIDIAccess;
  try {
    access = await navigator.requestMIDIAccess();
  }
  catch {
    return null;
  }
  const onMessage = (e: MIDIMessageEvent) => {
    const data = e.data;
    if (!data || data.length < 3) return;
    const kind = data[0] & 0xf0;
    if (kind === 0x90 && data[2] > 0) onNote(data[1], true, data[2] / 127, e.timeStamp);
    else if (kind === 0x80 || (kind === 0x90 && data[2] === 0)) onNote(data[1], false, 0, e.timeStamp);
  };
  const wire = () => {
    const names: string[] = [];
    access.inputs.forEach((input) => {
      input.onmidimessage = onMessage;
      names.push(input.name ?? 'MIDI input');
    });
    onPorts(names);
  };
  wire();
  access.onstatechange = wire;
  return {
    stop() {
      access.onstatechange = null;
      access.inputs.forEach((input) => { input.onmidimessage = null; });
    },
  };
}
