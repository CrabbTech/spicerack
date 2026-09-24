// The Sound sheet: which input the ears open (the interface and the input on
// it, in the desktop app; the microphone, in a browser), which MIDI port,
// a meter to prove it is hearing you — and how to sit next to an amp sim.

import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { AudioDevice, MidiPort, listAudioDevices, listMidiPorts } from '../input/native';
import { channelLabel } from '../state/sound';
import { midiLabel } from '../theory/notes';

interface WebInput {
  id: string;
  label: string;
}

export function SoundModal({ onClose }: { onClose: () => void }) {
  const { sound, setSound, desktop, inputSource, setInputSource, micLevel, inputStatus, state, preferFlat } = useApp();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [ports, setPorts] = useState<MidiPort[]>([]);
  const [webInputs, setWebInputs] = useState<WebInput[]>([]);
  const [trouble, setTrouble] = useState('');

  const refresh = async () => {
    setTrouble('');
    try {
      if (desktop) {
        const [d, p] = await Promise.all([listAudioDevices(), listMidiPorts()]);
        setDevices(d);
        setPorts(p);
      }
      else if (navigator.mediaDevices?.enumerateDevices) {
        const all = await navigator.mediaDevices.enumerateDevices();
        setWebInputs(all.filter((x) => x.kind === 'audioinput').map((x, i) => ({ id: x.deviceId, label: x.label || `Audio input ${i + 1}` })));
      }
    }
    catch (err) {
      setTrouble(String(err));
    }
  };
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const device = devices.find((d) => d.id === sound.deviceId) ?? devices.find((d) => d.isDefault) ?? devices[0];
  const channels = Math.max(1, device?.channels ?? 2);
  const listening = inputSource === (desktop ? 'interface' : 'mic');
  const heard = micLevel.midi === null ? '—' : midiLabel(micLevel.midi, preferFlat ? 'flat' : 'sharp');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sound" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Sound</h2>
          <button className="btn" onClick={() => void refresh()}>Refresh</button>
          <button className="btn" onClick={onClose}>×</button>
        </div>

        <div className="sound-section">
          <div className="shelf-head">Input</div>
          {desktop ? (
            <div className="setting-row">
              <span className="setting-label">Interface</span>
              <select value={device?.id ?? ''} onChange={(e) => setSound({ ...sound, deviceId: e.target.value || null, channel: 0 })}>
                {!devices.length && <option value="">no input devices found</option>}
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}{d.isDefault ? ' (default)' : ''} · {d.channels} in · {Math.round(d.sampleRate / 100) / 10} kHz</option>)}
              </select>
              <span className="setting-label">Input</span>
              <div className="seg">
                {Array.from({ length: Math.min(channels, 8) }, (_, i) => (
                  <button key={i} className={sound.channel === i ? 'seg-on' : ''} onClick={() => setSound({ ...sound, channel: i })}>{channelLabel(i)}</button>
                ))}
                {channels > 1 && <button className={sound.channel < 0 ? 'seg-on' : ''} onClick={() => setSound({ ...sound, channel: -1 })}>Mix</button>}
              </div>
            </div>
          ) : (
            <div className="setting-row">
              <span className="setting-label">Microphone</span>
              <select value={sound.micId ?? ''} onChange={(e) => setSound({ ...sound, micId: e.target.value || null })}>
                <option value="">the browser’s choice</option>
                {webInputs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <span className="practice-hint">names appear once the microphone has been allowed</span>
            </div>
          )}
          <div className="sound-meter">
            <span className="mic-meter"><i style={{ width: `${Math.min(100, micLevel.rms * 450)}%` }} /></span>
            <span className="listen-now">{listening ? heard : '·'}</span>
            {listening
              ? <button className="btn" onClick={() => setInputSource('off')}>Stop</button>
              : <button className="btn btn-spice" onClick={() => setInputSource(desktop ? 'interface' : 'mic')}>Listen</button>}
            <span className="practice-hint">{listening ? inputStatus : `Play a note; the ears report it here${state.instrument === 'bass' ? ' (bass: a longer window, a lower floor)' : ''}.`}</span>
          </div>
        </div>

        <div className="sound-section">
          <div className="shelf-head">MIDI</div>
          {desktop ? (
            <div className="setting-row">
              <span className="setting-label">Port</span>
              <select value={sound.midiPort ?? ''} onChange={(e) => setSound({ ...sound, midiPort: e.target.value || null })}>
                <option value="">{ports.length ? 'the first port found' : 'no MIDI ports found'}</option>
                {ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="practice-hint">CoreMIDI, straight in — an OP-1 field over USB shows up here</span>
            </div>
          ) : (
            <div className="practice-hint">Web MIDI works in Chrome and Edge; the desktop app listens to CoreMIDI itself.</div>
          )}
        </div>

        <div className="sound-section sound-routing">
          <div className="shelf-head">Next to an amp sim</div>
          <p>
            Quire opens the interface itself, and Core Audio lets more than one app read an input at once — so AmpliTube (or any amp sim)
            can keep the guitar too. Pick the input the guitar is plugged into (usually <strong>1</strong>): Quire hears the dry string and grades
            it, the amp sim shapes the tone you hear, and both play out of the same output.
          </p>
          <p>
            To grade the amp’s sound instead, route the amp sim into a virtual device (BlackHole, Loopback) and pick that here.
            An interface input never hears the band; a microphone does, so headphones keep it out.
          </p>
        </div>

        {trouble && <div className="lab-errors"><div>{trouble}</div></div>}
        <div className="modal-foot">
          <button className="btn btn-spice" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
