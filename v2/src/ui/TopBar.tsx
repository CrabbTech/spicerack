// Always on screen: where you are (Learn / Jam / Write), what you're holding,
// and the transport.

import { useApp } from '../state/AppContext';
import { ViewId } from '../state/reducer';
import { audio } from '../audio/engine';
import { op1RangeLabel } from '../op1/op1';
import { pianoRangeLabel } from '../piano/piano';
import { streak } from '../practice/progress';
import { PixelCrab } from './PixelCrab';
import { BRAND } from '../brand';

const VIEWS: { id: ViewId; name: string }[] = [
  { id: 'learn', name: 'Learn' },
  { id: 'jam', name: 'Jam' },
  { id: 'write', name: 'Write' },
];

export function TopBar() {
  const { state, dispatch, bpm, startPlayback, stopPlayback, setModal, progress } = useApp();
  const days = streak(progress);
  return (
    <header className="topbar">
      <div className="brand">
        <PixelCrab size={44} title={BRAND.name} />
        <span className="brand-name">{BRAND.mark}</span>
        <div className="seg view-seg">
          {VIEWS.map((v) => (
            <button key={v.id} className={state.view === v.id ? 'seg-on' : ''} onClick={() => dispatch({ type: 'view', view: v.id })}>
              {v.name}
            </button>
          ))}
        </div>
        {days > 0 && <span className="streak">{days} day{days === 1 ? '' : 's'} running</span>}
      </div>
      <div className="transport">
        <div className="seg">
          <button className={state.instrument === 'guitar' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'guitar' })}>Guitar</button>
          <button className={state.instrument === 'bass' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'bass' })}>Bass</button>
          <button className={state.instrument === 'piano' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'piano' })}>Piano</button>
          <button className={state.instrument === 'op1' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'op1' })}>OP-1</button>
        </div>
        {(state.instrument === 'op1' || state.instrument === 'piano') && (
          <div className="octave">
            <button className="mini" onClick={() => dispatch({ type: 'octave', delta: -1 })} disabled={state.octaveShift <= -2}>−</button>
            <span>{state.instrument === 'piano' ? pianoRangeLabel(state.octaveShift) : op1RangeLabel(state.octaveShift)}</span>
            <button className="mini" onClick={() => dispatch({ type: 'octave', delta: 1 })} disabled={state.octaveShift >= 2}>+</button>
          </div>
        )}
        <label className="bpm">
          <input type="number" min={40} max={240} value={bpm} onChange={(e) => dispatch({ type: 'bpm', bpm: Number(e.target.value) || null })} />
          <span>BPM</span>
        </label>
        <button className={`btn play ${state.playing ? 'btn-stop' : ''}`} onClick={() => (state.playing ? stopPlayback() : startPlayback())}>
          {state.playing ? '■ Stop' : '▶ Play'}
        </button>
        <button className={`btn mute ${state.muted ? 'muted' : ''}`} onClick={() => { audio.setMuted(!state.muted); dispatch({ type: 'muted', muted: !state.muted }); }}>
          {state.muted ? 'Unmute' : 'Mute'}
        </button>
        <button className="btn" onClick={() => setModal('library')}>Library</button>
      </div>
    </header>
  );
}
