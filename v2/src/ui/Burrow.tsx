// The burrow, on the Learn page: the crab digs under the genre's loop one
// floor a row. Each floor plays, asks which chord is new or changed, and
// reveals the rack's own explanation. A miss, bedrock or coming up lands
// the loop on the bench and writes the descent into the journal.

import { useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { closingLine } from '../practice/burrow';
import { PixelCrab } from './PixelCrab';

export function Burrow() {
  const { burrow, startBurrow, digNext, answerFloor, replayFloor, leaveBurrow, genre, allGenres, progress, templatesForMode } = useApp();
  const run = burrow?.run;
  const floors = run?.floors ?? [];
  const current = floors[floors.length - 1];
  const ended = !!run?.ended;
  const busy = !!burrow?.phase;
  const answered = !!burrow?.answered;
  const canDig = templatesForMode.some((t) => t.numerals.length >= 2 && t.numerals.length <= 8);
  const best = progress.burrowBest[genre.id];
  const dugIn = run ? allGenres.find((g) => g.id === run.genreId) ?? genre : genre;
  const firstMemory = floors.find((f) => !f.hearBoth && !f.gear)?.depth;
  const crabRow = floors.length;

  // the crab sits beside the row it is on: measured, since a row of eight chips and a long move name can wrap
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [crabTop, setCrabTop] = useState(0);
  useLayoutEffect(() => {
    const place = () => setCrabTop(rows.current[crabRow]?.offsetTop ?? 0);
    place();
    const shaft = rows.current[0]?.parentElement;
    if (!shaft || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(shaft);
    return () => ro.disconnect();
  }, [crabRow, answered, ended, burrow?.symbols.length]);

  // a keyboard player's focus follows the descent: the chips they answered on become plain text
  const digOn = useRef<HTMLButtonElement>(null);
  const digAgain = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!burrow) return;
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest('.burrow-panel')) return;
    if (ended) digAgain.current?.focus();
    else if (answered && current) digOn.current?.focus();
  }, [answered, ended]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel burrow-panel">
      <div className="panel-head">
        <div>
          <h2>The burrow</h2>
          <div className="panel-sub">The crab digs under a {genre.name} loop. Every floor down, one chord is changed: say which. Deeper, only the new loop plays and you hold the old one in your ear.</div>
        </div>
        <div className="panel-actions">
          <span className="quiz-streak">deepest <strong>{best ?? '—'}</strong></span>
          {(!burrow || ended) && <button ref={digAgain} className="btn btn-spice" onClick={startBurrow} disabled={!canDig || busy}>{burrow ? 'Dig again' : 'Dig'}</button>}
          {burrow && !ended && burrow.answered && <button ref={digOn} className="btn btn-spice" onClick={digNext} disabled={busy}>{current ? 'Dig on' : 'Dig'}</button>}
          {burrow && !ended && <button className="btn" onClick={replayFloor} disabled={!burrow.replays || busy || !current}>Again · {burrow.replays} left</button>}
          {burrow && !ended && <button className="btn" onClick={leaveBurrow}>Come up</button>}
        </div>
      </div>

      {!canDig && <div className="practice-hint">Nothing to dig under here: every {genre.name} loop in this mode is longer than eight chords. Pick another genre or mode.</div>}

      {burrow && run && (
        <>
          <div className="burrow-shaft">
            <span className="burrow-crab" style={{ transform: `translateY(${crabTop}px)` }}>
              <PixelCrab size={24} walking={busy} className={ended ? 'px-crab-ink' : ''} title={ended ? 'the crab has stopped digging' : 'the crab, digging'} />
            </span>
            <div className="quiz-rows">
              {burrow.symbols.map((row, r) => {
                const floor = r === 0 ? undefined : floors[r - 1];
                const isCurrent = !!floor && r === floors.length;
                const live = burrow.phase !== null && (r === floors.length ? burrow.phase === 'B' : r === floors.length - 1 && burrow.phase === 'A');
                const gear = !!floor?.gear;
                const revealed = !floor || gear || !isCurrent || burrow.answered || ended;
                const pairHint = !!floor && floor.wanted === 2 && floors[r - 2]?.wanted !== 2;
                return (
                  <div key={r} ref={(el) => { rows.current[r] = el; }}>
                    <div className={`ab-row ${floor ? 'burrow-floor' : ''} ${live ? 'ab-live' : ''} ${isCurrent || (!floor && !floors.length) ? 'burrow-current' : ''} ${gear ? 'burrow-gear' : ''}`}>
                      <span className="ab-side">{floor ? `${floor.depth} · ${floor.strata}` : 'surface'}</span>
                      {row.map((sym, i) => {
                        const now = live && burrow.at === i;
                        if (revealed) {
                          const changed = !!floor && !gear && floor.changed.includes(i);
                          const wrong = ended && run.ended === 'miss' && isCurrent && !!run.missed?.includes(i) && !changed;
                          return <span key={i} className={`ab-chip ${now ? 'ab-now' : ''} ${changed ? 'ab-changed' : ''} ${wrong ? 'quiz-wrong' : ''}`}>{sym}</span>;
                        }
                        const picked = burrow.picks.includes(i);
                        return (
                          <button key={i} className={`ab-chip quiz-pick ${now ? 'ab-now' : ''} ${picked ? 'burrow-picked' : ''}`} aria-pressed={picked} onClick={() => answerFloor(i)}>
                            {i + 1}
                          </button>
                        );
                      })}
                      {floor && revealed && <span className="burrow-move">{gear ? 'up a step' : floor.steps.map((s) => s.spiceName).join(' + ')}</span>}
                    </div>
                    {floor && isCurrent && gear && <div className="burrow-hint">The burrow turns: a whole step up. No question, just hear it.</div>}
                    {floor && isCurrent && !ended && !gear && floor.depth === firstMemory && <div className="burrow-hint">Only the new loop plays from here. The old one is in your ear.</div>}
                    {floor && isCurrent && !ended && !gear && pairHint && <div className="burrow-hint">Two chords changed on this floor. Pick both.</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {(ended || (current && burrow.answered)) && (
            <div className={`quiz-reveal ${ended && run.ended === 'miss' ? '' : 'quiz-right'}`} aria-live="polite">
              {current?.steps.map((s, k) => <div key={k}><strong>{s.spiceName}:</strong> {s.explanation}</div>)}
              {ended && <div className="burrow-closing">{closingLine(run, dugIn.name, dugIn.spices.length).text}</div>}
            </div>
          )}
          {!current && !ended && <div className="practice-hint">{burrow.answered ? 'The surface was cut short. Dig when you are ready.' : 'The surface, once. Then the crab digs.'}</div>}
        </>
      )}
    </section>
  );
}
