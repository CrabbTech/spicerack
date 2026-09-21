// Always on screen: where you are (Learn / Jam / Write), what you're holding,
// and the transport.

import { useApp } from '../state/AppContext';
import { ViewId } from '../state/reducer';
import { audio } from '../audio/engine';
import { op1RangeLabel } from '../op1/op1';
import { pianoRangeLabel } from '../piano/piano';
import { streak } from '../practice/progress';
import { CrabLogo } from './CrabLogo';

const VIEWS: { id: ViewId; icon: string; name: string; hint: string }[] = [
  { id: 'learn', icon: '🎓', name: 'LEARN', hint: 'guided paths: one idea, one task at a time' },
  { id: 'jam', icon: '🎸', name: 'JAM', hint: 'instrument in hand: big diagram, drills, and the app listening to you play' },
  { id: 'write', icon: '✍️', name: 'WRITE', hint: 'chords, spices, melody and song sections' },
];

export function TopBar() {
  const { state, dispatch, bpm, startPlayback, stopPlayback, setModal, progress } = useApp();
  const days = streak(progress);
  return (
    <header className="topbar">
      <div className="brand">
        <CrabLogo size={34} />
        <span className="brand-name">SPICERACK<span className="brand-two">2</span></span>
        <div className="seg view-seg">
          {VIEWS.map((v) => (
            <button key={v.id} className={state.view === v.id ? 'seg-on' : ''} title={v.hint}
              onClick={() => dispatch({ type: 'view', view: v.id })}>
              {v.icon} {v.name}
            </button>
          ))}
        </div>
        {days > 0 && <span className="streak" title="days in a row with a graded pass or a finished lesson step">🔥 {days}</span>}
      </div>
      <div className="transport">
        <div className="seg">
          <button className={state.instrument === 'guitar' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'guitar' })}>GUITAR</button>
          <button className={state.instrument === 'bass' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'bass' })}>BASS</button>
          <button className={state.instrument === 'piano' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'piano' })}>PIANO</button>
          <button className={state.instrument === 'op1' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'op1' })}>OP-1 FIELD</button>
        </div>
        {(state.instrument === 'op1' || state.instrument === 'piano') && (
          <div className="octave">
            <button className="mini" onClick={() => dispatch({ type: 'octave', delta: -1 })} disabled={state.octaveShift <= -2}>−</button>
            <span title="octave shift">
              {state.instrument === 'piano' ? pianoRangeLabel(state.octaveShift) : op1RangeLabel(state.octaveShift)}
            </span>
            <button className="mini" onClick={() => dispatch({ type: 'octave', delta: 1 })} disabled={state.octaveShift >= 2}>+</button>
          </div>
        )}
        <label className="bpm">
          <input type="number" min={40} max={240} value={bpm}
            onChange={(e) => dispatch({ type: 'bpm', bpm: Number(e.target.value) || null })} />
          <span>BPM</span>
        </label>
        <button className={`btn play ${state.playing ? 'btn-stop' : ''}`} onClick={() => (state.playing ? stopPlayback() : startPlayback())}>
          {state.playing ? '■ STOP' : '▶ PLAY'}
        </button>
        <button className={`btn mute ${state.muted ? 'muted' : ''}`}
          onClick={() => { audio.setMuted(!state.muted); dispatch({ type: 'muted', muted: !state.muted }); }}
          title={state.muted ? 'unmute' : 'mute'}>
          {state.muted ? '🔇' : '🔊'}
        </button>
        <button className="btn" onClick={() => setModal('library')} title="saved songs">📚</button>
        <button className="btn" onClick={() => setModal('settings')} title="look & feel (t)">🎨</button>
      </div>
    </header>
  );
}
