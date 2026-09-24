// Play along and get told something useful. The app listens (mic, MIDI or
// the computer keyboard), places every note on the loop, and grades each
// pass against the drill that's up.

import { useApp } from '../state/AppContext';
import { InputSource } from '../state/controller';
import { LENSES } from '../theory/solo';
import { midiLabel } from '../theory/notes';
import { midiInSupported } from '../input/midiIn';
import { micSupported } from '../input/mic';

const SOURCES: { id: InputSource; name: string; hint: string }[] = [
  { id: 'off', name: 'Off', hint: 'not listening' },
  { id: 'mic', name: 'Mic', hint: 'guitar, bass, voice or a speaker — one note at a time' },
  { id: 'midi', name: 'MIDI', hint: 'any controller over USB (Chrome / Edge)' },
  { id: 'qwerty', name: 'Keys', hint: 'the computer keyboard as a two-octave piano' },
];

export function ListenPanel() {
  const { inputSource, setInputSource, inputStatus, held, micLevel, grade, scores, lens, progress, state, preferFlat } = useApp();
  const drill = LENSES.find((l) => l.id === lens) ?? LENSES[0];
  const best = progress.drillBest[lens];
  const name = (m: number) => midiLabel(m, preferFlat ? 'flat' : 'sharp');
  const supported = (id: InputSource) => id === 'off' || id === 'qwerty' || (id === 'mic' ? micSupported() : midiInSupported());

  return (
    <section className="panel listen-panel">
      <div className="panel-head">
        <div>
          <h2>Listen</h2>
          <div className="panel-sub">graded against <strong>{drill.name}</strong></div>
        </div>
        <div className="seg">
          {SOURCES.map((s) => (
            <button key={s.id} className={inputSource === s.id ? 'seg-on' : ''} disabled={!supported(s.id)} title={s.hint} onClick={() => setInputSource(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {inputSource === 'off' ? (
        <div className="listen-idle">Pick a source, press play, and play along.</div>
      ) : (
        <>
          <div className="listen-status">
            <span>{inputStatus}</span>
            {inputSource === 'mic' && <span className="mic-meter"><i style={{ width: `${Math.min(100, micLevel.rms * 450)}%` }} /></span>}
            <span className="listen-now">{held.length ? held.map(name).join(' ') : inputSource === 'mic' && micLevel.midi !== null ? name(micLevel.midi) : '—'}</span>
          </div>
          {!state.playing && <div className="practice-hint">Notes count while the loop is running.</div>}
          {grade && (
            <div className="grade">
              <div className={`grade-score ${grade.score >= 80 ? 'grade-great' : grade.score >= 55 ? 'grade-ok' : 'grade-low'}`}>
                {grade.score}
                <span>last pass</span>
              </div>
              <div className="grade-body">
                <div className="grade-chips">
                  {grade.segments.map((s, i) => (
                    <span key={i} className={`landing ${s.landed === null ? 'landing-none' : s.landed ? 'landing-hit' : 'landing-miss'}`}
                      title={s.landed === false ? `you: ${s.playedLabel} · target: ${s.targetLabels.join(' / ')}` : `${s.inside}/${s.notes} inside the drill`}>
                      {s.chord} {s.landed === null ? '·' : s.landed ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
                {grade.lines.map((line, i) => <div key={i} className="grade-line">{line}</div>)}
              </div>
            </div>
          )}
          {(scores.length > 1 || best !== undefined) && (
            <div className="score-trail">
              <span className="control-label">Session</span>
              <div className="score-bars">
                {scores.map((s, i) => <i key={i} title={`${s}`} style={{ height: `${Math.max(6, s * 0.28)}px` }} className={s >= 80 ? 'bar-great' : s >= 55 ? 'bar-ok' : 'bar-low'} />)}
              </div>
              {best !== undefined && <span className="practice-hint">best <strong>{best}</strong> · {progress.drillPasses[lens] ?? 0} passes</span>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
