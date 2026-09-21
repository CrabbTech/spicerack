// The practice transport and the backing band, in one strip.

import { useApp } from '../state/AppContext';
import { PracticeSettings, RAMP } from '../state/controller';
import { chordSymbol } from '../theory/chords';

export function PracticeStrip() {
  const { state, dispatch, practice, setPractice, passInfo, order, setLoopIdx, realized, bpm, melodyOn, setMelodyOn, demoOn } = useApp();
  const hasMelody = state.melody.length > 0;
  return (
    <div className="practice-row">
      <span className="control-label">PRACTICE</span>
      <button className={`chip ${practice.countIn ? 'chip-on' : ''}`} title="one bar of clicks before the loop starts"
        onClick={() => setPractice({ ...practice, countIn: !practice.countIn })}>⏱ Count-in</button>
      <button className={`chip ${practice.ramp ? 'chip-on' : ''}`}
        title={`tempo trainer: starts at ${RAMP.startPct}% and climbs ${RAMP.stepPct}% every pass until it reaches ${bpm} bpm`}
        onClick={() => setPractice({ ...practice, ramp: !practice.ramp })}>
        🐢→🐇 Tempo ramp{practice.ramp && state.playing && passInfo ? ` · ${Math.round(passInfo.bpm)} bpm` : ''}
      </button>
      {order
        ? <button className="chip chip-on" onClick={() => setLoopIdx(null)} title="back to the whole progression">
          🔁 {order.map((i) => chordSymbol(realized[i].chord)).join(' → ')} ✕
        </button>
        : <span className="practice-hint">shift-click cards to loop a section</span>}
      <span className="control-label band-label">BAND</span>
      <button className={`chip ${practice.chords ? 'chip-on' : ''}`} title="mute the chord part and comp it yourself"
        onClick={() => setPractice({ ...practice, chords: !practice.chords })}>
        {state.instrument === 'bass' ? '🎚 Bass line' : '🎸 Chords'}
      </button>
      <button className={`chip ${practice.bass && state.instrument !== 'bass' ? 'chip-on' : ''}`}
        disabled={state.instrument === 'bass'}
        title={state.instrument === 'bass' ? 'you are the bassist' : 'backing bassist (b)'}
        onClick={() => setPractice({ ...practice, bass: !practice.bass })}>🎚 Bass</button>
      <button className={`chip ${state.drumsOn ? 'chip-on' : ''}`} title="drums (d)"
        onClick={() => dispatch({ type: 'drums', on: !state.drumsOn })}>🥁 Drums</button>
      <button className={`chip ${melodyOn && hasMelody && !demoOn ? 'chip-on' : ''}`} disabled={!hasMelody}
        title={hasMelody ? (demoOn ? 'the demo lick has the lead right now — turn it off to hear your melody' : 'play the written melody over the loop') : 'write a melody in WRITE and it plays here'}
        onClick={() => setMelodyOn(!melodyOn)}>🎵 Melody</button>
      <select className="tpl-select backing-select" value={practice.backing} disabled={state.instrument === 'bass'}
        title="which sound plays the chords — practise guitar over synth pads, or keys over a strummed guitar"
        onChange={(e) => setPractice({ ...practice, backing: e.target.value as PracticeSettings['backing'] })}>
        <option value="same">chords: same instrument</option>
        <option value="guitar">chords: guitar</option>
        <option value="piano">chords: piano</option>
        <option value="op1">chords: OP-1 synth</option>
      </select>
    </div>
  );
}
