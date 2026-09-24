// The crab canon panel: the verdict on a melody read from both ends at once,
// the strip it lives on, and the two moves that make it work — mirror the
// chords so the harmony reads the same both ways, or nudge the notes until
// the line agrees with itself.

import { useApp } from '../state/AppContext';
import { CRAB_MODES, harmonyIsPalindrome, mirrorSpec } from '../theory/crab';
import { midiLabel } from '../theory/notes';
import { MobiusStrip } from './MobiusStrip';
import { PixelCrab } from './PixelCrab';

const pct = (x: number): string => `${Math.round(x * 100)}%`;

export function CrabCanon() {
  const {
    state, melodyCtx: ctx, melodyLead, loopBeats, perBar, preferFlat, ab, songAt,
    crabReport: report, crabOn, setCrabOn, crabMode, setCrabMode, crabProofNow, mirrorChords, startPlayback, stopPlayback,
  } = useApp();
  if (!ctx) return null;
  const notes = state.melody;
  const name = (midi: number) => midiLabel(midi, preferFlat ? 'flat' : 'sharp').replace(/-?\d+$/, '');
  const spec = mirrorSpec(ctx, notes, crabMode, loopBeats);
  const palindrome = report?.palindrome ?? harmonyIsPalindrome(ctx);
  const nothingToFix = !report || (!report.misses.length && !report.clashes.length);

  return (
    <section className="panel crab-panel">
      <div className="panel-head">
        <div>
          <h2>Crab canon</h2>
          <div className="panel-sub">One line, read from both ends at once — Bach’s <em>canon cancrizans</em>, over your chords.</div>
        </div>
        <div className="panel-actions">
          <div className="seg">
            {CRAB_MODES.map((m) => (
              <button key={m.id} className={crabMode === m.id ? 'seg-on' : ''} onClick={() => setCrabMode(m.id)} title={m.hint}>{m.name}</button>
            ))}
          </div>
          <button className={`btn ${crabOn ? 'btn-on' : ''}`} disabled={!notes.length} onClick={() => setCrabOn(!crabOn)}>
            {crabOn ? 'Crab in' : 'Let the crab in'}
          </button>
          <button className="btn" disabled={!notes.length} onClick={() => { if (state.playing) stopPlayback(); else { setCrabOn(true); startPlayback(); } }}>
            {state.playing ? '■ Stop' : '▶ Hear both'}
          </button>
          <button className="btn" disabled={nothingToFix} onClick={crabProofNow}>Crab-proof</button>
          <button className="btn" disabled={palindrome || state.slots.length < 2} onClick={mirrorChords}>Mirror the chords</button>
        </div>
      </div>

      <div className="crab-body">
        <MobiusStrip notes={melodyLead} total={loopBeats} perBar={perBar} lo={ctx.lo} hi={ctx.hi} mode={crabMode} spec={spec}
          playing={state.playing && !ab && songAt === null} crabOn={crabOn} />
        <div className="crab-verdict">
          {!report ? (
            <div className="practice-hint">Write a few bars above and the crab will walk them backwards.</div>
          ) : (
            <>
              <div className="crab-score">
                <span className="crab-rating">
                  {[0, 1, 2].map((i) => <PixelCrab key={i} size={28} className={i < report.verdict.crabs ? '' : 'px-crab-ink px-crab-off'} />)}
                </span>
                <div>
                  <div className="crab-grade">{report.verdict.name}<span className="crab-number">{report.score}</span></div>
                  <div className="practice-hint">{report.verdict.text}</div>
                </div>
              </div>
              <span className="crab-meter"><i style={{ width: `${report.score}%` }} /></span>
              <div className="crab-stats">
                <span>fits backwards <strong>{pct(report.fit)}</strong></span>
                <span>agree where they meet <strong>{report.together ? pct(report.agreement) : '—'}</strong></span>
                <span>overlap <strong>{pct(report.together)}</strong></span>
                <span className={`landing ${palindrome ? 'landing-hit' : ''}`}>{palindrome ? 'harmony reads both ways' : 'harmony is one-way'}</span>
              </div>
              <div className="coach-landings">
                {report.misses
                  .filter((m, i, all) => all.findIndex((x) => x.bar === m.bar && x.midi === m.midi && x.chord === m.chord) === i)
                  .slice(0, 6).map((m) => (
                    <span key={m.id} className="landing landing-miss">bar {m.bar + 1} · {name(m.midi)} over {m.chord} ✗</span>
                  ))}
                {!report.misses.length && <span className="landing landing-hit">every note lands backwards ✓</span>}
              </div>
              {report.observations.map((o, i) => <div key={i} className={`coach-note coach-${o.kind}`}>{o.text}</div>)}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
