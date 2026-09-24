// The microphone as an instrument input: poll an AnalyserNode, run the pitch
// detector on each frame, and let the note tracker turn the wobbly stream into
// note on/off events. It runs on the audio engine's own AudioContext so its
// timestamps sit on the same clock as the loop.

import { createNoteTracker, detectPitch } from './pitch';

export interface MicHandle {
  stop(): void;
}

export interface MicOptions {
  /** bass needs a longer window to see its low E */
  low?: boolean;
  onNote: (midi: number, on: boolean, time: number) => void;
  /** live level + pitch for the meter, ~20×/second */
  onLevel?: (rms: number, midi: number | null) => void;
  /** a particular input (MediaDeviceInfo.deviceId); the browser's choice when absent */
  deviceId?: string | null;
}

export const micSupported = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export async function openMic(ctx: AudioContext, opts: MicOptions): Promise<MicHandle | null> {
  if (!micSupported()) return null;
  let stream: MediaStream;
  try {
    // an instrument is not a voice call: leave the signal alone
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}) },
    });
  }
  catch {
    return null;
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = opts.low ? 4096 : 2048;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser); // never to the speakers
  const frame = new Float32Array(analyser.fftSize);
  const frameSeconds = analyser.fftSize / ctx.sampleRate;
  const tracker = createNoteTracker();
  let tick = 0;

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(frame);
    const result = detectPitch(frame, ctx.sampleRate, opts.low ? { minFreq: 38, maxFreq: 700 } : undefined);
    // the frame's centre is the best single timestamp for what it contains
    const at = ctx.currentTime - frameSeconds / 2;
    for (const e of tracker.push(result, at)) opts.onNote(e.midi, e.type === 'on', e.time);
    if (opts.onLevel && ++tick % 2 === 0) {
      let sum = 0;
      for (let i = 0; i < frame.length; i += 8) sum += frame[i] * frame[i];
      opts.onLevel(Math.sqrt(sum / (frame.length / 8)), tracker.current());
    }
  }, 25);

  return {
    stop() {
      window.clearInterval(timer);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
