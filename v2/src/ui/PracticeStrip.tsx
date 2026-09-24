// The practice transport and the backing band, in one strip.

import { useApp } from '../state/AppContext';
import { PracticeSettings } from '../state/controller';
import { chordSymbol } from '../theory/chords';

export function PracticeStrip() {
  const { state, dispatch, practice, setPractice, passInfo, order, setLoopIdx, realized, melodyOn, setMelodyOn, demoOn } = useApp();
  const hasMelody = state.melody.length > 0;
  return (
    <div className="practice-row">
      <span className="control-label">Practice</span>
      <button className={`chip ${practice.countIn ? 'chip-on' : ''}`} onClick={() => setPractice({ ...practice, countIn: !practice.countIn })}>Count-in</button>
      <button className={`chip ${practice.ramp ? 'chip-on' : ''}`} onClick={() => setPractice({ ...practice, ramp: !practice.ramp })}>
        Tempo ramp{practice.ramp && state.playing && passInfo ? ` · ${Math.round(passInfo.bpm)}` : ''}
      </button>
      {order
        ? <button className="chip chip-on" onClick={() => setLoopIdx(null)}>Loop {order.map((i) => chordSymbol(realized[i].chord)).join(' → ')} ×</button>
        : <span className="practice-hint">shift-click cards to loop</span>}
      <span className="control-label band-label">Band</span>
      <button className={`chip ${practice.chords ? 'chip-on' : ''}`} onClick={() => setPractice({ ...practice, chords: !practice.chords })}>
        {state.instrument === 'bass' ? 'Bass line' : 'Chords'}
      </button>
      <button className={`chip ${practice.bass && state.instrument !== 'bass' ? 'chip-on' : ''}`} disabled={state.instrument === 'bass'}
        onClick={() => setPractice({ ...practice, bass: !practice.bass })}>Bass</button>
      <button className={`chip ${state.drumsOn ? 'chip-on' : ''}`} onClick={() => dispatch({ type: 'drums', on: !state.drumsOn })}>Drums</button>
      <button className={`chip ${melodyOn && hasMelody && !demoOn ? 'chip-on' : ''}`} disabled={!hasMelody} onClick={() => setMelodyOn(!melodyOn)}>Melody</button>
      <select className="tpl-select backing-select" value={practice.backing} disabled={state.instrument === 'bass'}
        onChange={(e) => setPractice({ ...practice, backing: e.target.value as PracticeSettings['backing'] })}>
        <option value="same">chords: same instrument</option>
        <option value="guitar">chords: guitar</option>
        <option value="piano">chords: piano</option>
        <option value="op1">chords: OP-1</option>
      </select>
    </div>
  );
}
