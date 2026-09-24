// The desktop shell's ears and MIDI port, spoken to over Tauri's bridge: the
// audio interface read straight from Core Audio (device and input of your
// choice, pitch tracked in Rust — see src-tauri/src/audio.rs) and CoreMIDI.
// In a browser none of this exists, and every call here says so.

import { createNoteTracker } from './pitch';
import type { MicHandle, MicOptions } from './mic';
import type { MidiInHandle, MidiNoteHandler } from './midiIn';

export const isDesktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac/.test(navigator.platform ?? '');

export interface AudioDevice {
  id: string;
  name: string;
  channels: number;
  sampleRate: number;
  isDefault: boolean;
}

export interface AudioStarted {
  device: string;
  sampleRate: number;
  channels: number;
  window: number;
  hop: number;
}

/** what the ears heard in one hop; `midi` is null when nothing periodic is sounding */
export interface AudioFrame {
  freq: number | null;
  midi: number | null;
  clarity: number;
  rms: number;
  level: number;
  t: number;
}

export type AudioState = { kind: 'running'; device: string } | { kind: 'stopped' } | { kind: 'error'; message: string };

export interface MidiPort {
  id: string;
  name: string;
}

interface MidiNoteEvent {
  midi: number;
  on: boolean;
  velocity: number;
  stamp: number;
}

async function bridge() {
  const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]);
  return { invoke, listen };
}

export async function listAudioDevices(): Promise<AudioDevice[]> {
  if (!isDesktop()) return [];
  const { invoke } = await bridge();
  return invoke<AudioDevice[]>('audio_devices');
}

export async function listMidiPorts(): Promise<MidiPort[]> {
  if (!isDesktop()) return [];
  const { invoke } = await bridge();
  return invoke<MidiPort[]>('midi_ports');
}

export interface InterfaceOptions extends MicOptions {
  /** null: the system's default input */
  deviceId: string | null;
  /** 0-based input on the device; -1 mixes every input down */
  channel: number;
  onState?: (state: AudioState) => void;
}

/** The interface as an instrument input — the same shape as the mic, so the controller cannot tell them apart. */
export async function openInterface(ctx: AudioContext, opts: InterfaceOptions): Promise<MicHandle | null> {
  if (!isDesktop()) return null;
  const { invoke, listen } = await bridge();
  const tracker = createNoteTracker();
  let windowSeconds = (opts.low ? 4096 : 2048) / 48000;
  let tick = 0;
  const unFrame = await listen<AudioFrame>('quire://audio', (e) => {
    const f = e.payload;
    const result = f.midi === null || f.freq === null ? null : { freq: f.freq, midi: f.midi, clarity: f.clarity, rms: f.rms };
    // the window's centre is the best single timestamp for what it contains
    const at = ctx.currentTime - windowSeconds / 2;
    for (const ev of tracker.push(result, at)) opts.onNote(ev.midi, ev.type === 'on', ev.time);
    if (opts.onLevel && ++tick % 2 === 0) opts.onLevel(f.level, tracker.current());
  });
  const unState = opts.onState ? await listen<AudioState>('quire://audio-state', (e) => opts.onState?.(e.payload)) : () => undefined;
  try {
    const started = await invoke<AudioStarted>('audio_start', { device: opts.deviceId, channel: opts.channel, low: !!opts.low });
    windowSeconds = started.window / started.sampleRate;
  }
  catch (err) {
    unFrame();
    unState();
    opts.onState?.({ kind: 'error', message: String(err) });
    return null;
  }
  return {
    stop() {
      unFrame();
      unState();
      void invoke('audio_stop');
    },
  };
}

/** CoreMIDI in, the same shape as Web MIDI: `onPorts([])` means nothing is plugged in. */
export async function openNativeMidi(onNote: MidiNoteHandler, onPorts: (names: string[]) => void, portId: string | null): Promise<MidiInHandle | null> {
  if (!isDesktop()) return null;
  const { invoke, listen } = await bridge();
  // the port's own clock is not the page's; a note is stamped as it arrives, and the latency table takes the rest
  const un = await listen<MidiNoteEvent>('quire://midi', (e) => onNote(e.payload.midi, e.payload.on, e.payload.velocity, performance.now()));
  try {
    onPorts([await invoke<string>('midi_start', { port: portId })]);
  }
  catch {
    onPorts([]);
    return { stop() { un(); } };
  }
  return {
    stop() {
      un();
      void invoke('midi_stop');
    },
  };
}
