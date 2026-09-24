// The crab canon panel: the verdict on a melody read from both ends at once,
// the strip it lives on, and the two moves that make it work — mirror the
// chords so the harmony reads the same both ways, or nudge the notes until
// the line agrees with itself.

import { useApp } from '../state/AppContext';
import { CRAB_MODES, harmonyIsPalindrome, mirrorSpec } from '../theory/crab';
import { midiLabel } from '../theory/notes';
import { MobiusStrip } from './MobiusStrip';

const NOTE_ICON = { good: '✅', fix: '🛠', idea: '💡' } as const;
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
          <h2>🦀 Crab canon</h2>
          <div className="panel-sub">
            your melody, met by itself walking backwards. One line, read from both ends at once — Bach’s <em>canon cancrizans</em> (1747), over your chords.
          </div>
        </div>
        <div className="panel-actions">
          <div className="seg" title="how the second player reads the line">
            {CRAB_MODES.map((m) => (
              <button key={m.id} className={crabMode === m.id ? 'seg-on' : ''} onClick={() => setCrabMode(m.id)} title={m.hint}>
                {m.icon} {m.name.toUpperCase()}
              </button>
            ))}
          </div>
          <button className={`btn ${crabOn ? 'btn-on' : ''}`} disabled={!notes.length} onClick={() => setCrabOn(!crabOn)}
            title="the mirror voice joins the loop on a sound of its own (k)">
            {crabOn ? '🦀 Crab is in' : '🦀 Let the crab in'}
          </button>
          <button className="btn" disabled={!notes.length} onClick={() => { if (state.playing) stopPlayback(); else { setCrabOn(true); startPlayback(); } }}
            title="play the loop with both readings of the line">
            {state.playing ? '■ Stop' : '▶ Hear both'}
          </button>
          <button className="btn" disabled={nothingToFix} onClick={crabProofNow}
            title="every unlocked note moves to the nearest pitch that works over its own chord, over the chord its mirror lands on, and against the other voice — never for a worse score">
            🩹 Make it crab-proof
          </button>
          <button className="btn" disabled={palindrome || state.slots.length < 2} onClick={mirrorChords}
            title="the progression comes back the way it went (I–IV–V → I–IV–V–IV–I), so the harmony reads the same from either end">
            🪞 Mirror the chords
          </button>
        </div>
      </div>

      <div className="crab-body">
        <MobiusStrip notes={melodyLead} total={loopBeats} perBar={perBar} lo={ctx.lo} hi={ctx.hi} mode={crabMode} spec={spec}
          playing={state.playing && !ab && songAt === null} crabOn={crabOn} />
        <div className="crab-verdict">
          {!report ? (
            <>
              <div className="practice-hint">Write a few bars in the workbench above — or 🌱 seed one — and the crab will walk them backwards.</div>
              <div className="coach-note coach-idea">
                💡 The strip has one side. Go round once and you are travelling the same notes the other way up — which is exactly what the second player does when they read your line from the end.
              </div>
            </>
          ) : (
            <>
              <div className="crab-score">
                <span className="crab-icon">{report.verdict.icon}</span>
                <div>
                  <div className="crab-grade">{report.verdict.name} <span className="crab-number">{report.score}</span></div>
                  <div className="practice-hint">{report.verdict.text}</div>
                </div>
              </div>
              <span className="crab-meter"><i style={{ width: `${report.score}%` }} /></span>
              <div className="crab-stats">
                <span title="how much of the backwards voice sits on friendly notes">fits backwards <strong>{pct(report.fit)}</strong></span>
                <span title="how much of the time the two voices sound together without grinding">agree where they meet <strong>{report.together ? pct(report.agreement) : '—'}</strong></span>
                <span title="how much of the loop both voices are sounding">overlap <strong>{pct(report.together)}</strong></span>
                <span className={`landing ${palindrome ? 'landing-hit' : ''}`}>{palindrome ? 'harmony reads both ways ✓' : 'harmony is one-way'}</span>
              </div>
              <div className="coach-landings" title="mirror notes that fight the chord they land on">
                {report.misses
                  .filter((m, i, all) => all.findIndex((x) => x.bar === m.bar && x.midi === m.midi && x.chord === m.chord) === i)
                  .slice(0, 6).map((m) => (
                    <span key={m.id} className="landing landing-miss" title={`from bar ${m.fromBar + 1} — ${m.why}`}>
                      bar {m.bar + 1} · {name(m.midi)} over {m.chord} ✗
                    </span>
                  ))}
                {!report.misses.length && <span className="landing landing-hit">every note lands backwards ✓</span>}
              </div>
              {report.observations.map((o, i) => (
                <div key={i} className={`coach-note coach-${o.kind}`}>{NOTE_ICON[o.kind]} {o.text}</div>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
