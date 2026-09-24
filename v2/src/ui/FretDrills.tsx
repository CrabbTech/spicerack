// Neck drills: ten-card sprints on a bare fretboard. Click the answer — or,
// with Listen on, play it on the guitar. Right answers move on by themselves;
// a miss stops and shows the rule, because the rule is the point.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { FRET_DRILLS, FretCard, FretPos, checkClick, checkPlayed, makeCard, scoreSprint } from '../practice/fretDrills';
import { OPEN_MIDI, STRING_NAMES } from '../guitar/shapes';
import { MAX_FRET } from '../guitar/voicing';
import { BASS_MAX_FRET, BASS_OPEN_MIDI, BASS_STRING_NAMES } from '../bass/bass';
import { audio } from '../audio/engine';

const SPRINT = 10;

interface NeckProps {
  card: FretCard;
  names: string[];
  maxFret: number;
  lefty: boolean;
  revealed: boolean;
  wrong: FretPos | null;
  onPick: (pos: FretPos) => void;
}

function DrillNeck({ card, names, maxFret, lefty, revealed, wrong, onPick }: NeckProps) {
  const strings = names.length;
  const fw = 46;
  const openW = 32;
  const left = 22;
  const rowH = 27;
  const top = 16;
  const width = left + openW + maxFret * fw + 14;
  const height = top + (strings - 1) * rowH + 36;
  const flip = (x: number) => (lefty ? width - x : x);
  const cellX = (fret: number) => (fret === 0 ? left : left + openW + (fret - 1) * fw);
  const cellW = (fret: number) => (fret === 0 ? openW : fw);
  const xOf = (fret: number) => flip(cellX(fret) + cellW(fret) / 2);
  const yOf = (string: number) => top + (strings - 1 - string) * rowH;
  const x0 = flip(cellX(card.window.lo));
  const x1 = flip(cellX(card.window.hi) + cellW(card.window.hi));

  return (
    <svg className="fb-scale drill-neck" width="100%" style={{ maxWidth: width * 1.5 }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      <rect x={Math.min(x0, x1)} y={top - 12} width={Math.abs(x1 - x0)} height={(strings - 1) * rowH + 24} rx={8} className="dn-window" />
      {Array.from({ length: strings }, (_, s) => (
        <g key={s}>
          <text x={flip(left - 10)} y={yOf(s) + 3.5} className="fb-string-name" textAnchor="middle">{names[s]}</text>
          <line x1={flip(left + openW)} y1={yOf(s)} x2={flip(left + openW + maxFret * fw)} y2={yOf(s)} stroke="currentColor" strokeWidth={s < strings / 2 ? 1.6 : 1.1} opacity={0.4} />
        </g>
      ))}
      {Array.from({ length: maxFret + 1 }, (_, f) => (
        <line key={f} x1={flip(left + openW + f * fw)} y1={top} x2={flip(left + openW + f * fw)} y2={top + (strings - 1) * rowH}
          stroke="currentColor" strokeWidth={f === 0 ? 3 : 1} opacity={f === 0 ? 0.7 : 0.2} />
      ))}
      {[3, 5, 7, 9, 12, 15].filter((f) => f <= maxFret).map((f) => (
        <text key={f} x={xOf(f)} y={top + (strings - 1) * rowH + 22} className="fb-marker" textAnchor="middle">{f === 12 ? '12 ··' : f}</text>
      ))}
      {/* every string × fret is a target */}
      {!revealed && card.kind !== 'degree' && Array.from({ length: strings }, (_, s) => Array.from({ length: maxFret + 1 }, (_, f) => (
        <rect key={`${s}:${f}`} x={Math.min(flip(cellX(f)), flip(cellX(f) + cellW(f)))} y={yOf(s) - rowH / 2} width={cellW(f)} height={rowH}
          className="dn-cell" onClick={() => onPick({ string: s, fret: f })} />
      )))}
      {revealed && card.answers.map((a) => (
        <g key={`a${a.string}:${a.fret}`} className="dn-answer">
          <circle cx={xOf(a.fret)} cy={yOf(a.string)} r={10.5} />
          <text x={xOf(a.fret)} y={yOf(a.string) + 3.4} textAnchor="middle">{card.answerLabel}</text>
        </g>
      ))}
      {card.given.map((g, i) => (
        <g key={`g${i}`} className={g.label === 'R' ? 'dn-given dn-root' : 'dn-given'}>
          <circle cx={xOf(g.fret)} cy={yOf(g.string)} r={10.5} />
          <text x={xOf(g.fret)} y={yOf(g.string) + 3.4} textAnchor="middle">{revealed && g.label === '?' ? card.answerLabel : g.label}</text>
        </g>
      ))}
      {wrong && (
        <g className="dn-wrong">
          <circle cx={xOf(wrong.fret)} cy={yOf(wrong.string)} r={10.5} />
          <text x={xOf(wrong.fret)} y={yOf(wrong.string) + 3.6} textAnchor="middle">✕</text>
        </g>
      )}
    </svg>
  );
}

export function FretDrills() {
  const { state, dispatch, drillKind, setDrillKind, progress, finishSprint, held, lefty, preferFlat, inputSource, lastSprint } = useApp();
  const strings = state.instrument === 'guitar' || state.instrument === 'bass';
  const bass = state.instrument === 'bass';
  const tuning = useMemo(() => ({
    openMidi: bass ? BASS_OPEN_MIDI : OPEN_MIDI, names: bass ? BASS_STRING_NAMES : STRING_NAMES,
    maxFret: bass ? BASS_MAX_FRET : MAX_FRET, preferFlat,
  }), [bass, preferFlat]);

  const [card, setCard] = useState<FretCard | null>(null);
  const [revealed, setRevealed] = useState<'right' | 'wrong' | null>(null);
  const [wrong, setWrong] = useState<FretPos | null>(null);
  const [done, setDone] = useState(false);
  const log = useRef<{ tag: string; right: boolean; seconds: number }[]>([]);
  const startedAt = useRef(0);
  const timer = useRef(0);
  const missesRef = useRef(progress.fretMisses);
  missesRef.current = progress.fretMisses;

  const deal = () => {
    setCard(makeCard(drillKind, { ...tuning, misses: missesRef.current }));
    setRevealed(null);
    setWrong(null);
    startedAt.current = performance.now();
  };

  const start = () => {
    log.current = [];
    setDone(false);
    deal();
  };

  const next = () => {
    window.clearTimeout(timer.current);
    if (log.current.length >= SPRINT) {
      finishSprint(scoreSprint(drillKind, log.current), log.current);
      setDone(true);
      setCard(null);
      return;
    }
    deal();
  };

  const settle = (right: boolean, at?: FretPos) => {
    if (!card || revealed) return;
    log.current.push({ tag: card.tag, right, seconds: (performance.now() - startedAt.current) / 1000 });
    setRevealed(right ? 'right' : 'wrong');
    setWrong(right ? null : at ?? null);
    // hear the relationship that was just asked about: the reference, then the answer
    const ref = card.given[0];
    const answer = card.kind === 'degree' ? card.given[1] : card.answers[0];
    const voice = bass ? 'bass' : 'guitar';
    if (ref) audio.note(tuning.openMidi[ref.string] + ref.fret, voice, 0.7);
    if (answer) window.setTimeout(() => audio.note(tuning.openMidi[answer.string] + answer.fret, voice, 0.9), ref ? 260 : 0);
    if (right) timer.current = window.setTimeout(next, 950);
  };

  // a new drill, or a different neck, abandons the sprint in progress
  useEffect(() => {
    window.clearTimeout(timer.current);
    setCard(null);
    setDone(false);
    log.current = [];
  }, [drillKind, bass]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // played answers: only a right note counts — a mic hears too many stray pitches to punish wrong ones
  const newest = held[held.length - 1];
  useEffect(() => {
    if (newest !== undefined && card && !revealed && card.kind !== 'degree' && checkPlayed(card, newest)) settle(true);
  }, [newest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter / space-free advance after a miss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && revealed === 'wrong') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const drill = FRET_DRILLS.find((d) => d.id === drillKind)!;
  const best = progress.fretBest[drillKind];
  const trouble = Object.entries(progress.fretMisses).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag.replace('ct:', 'chord ').replace('uni:4', 'G→B unison').replace('uni:5', 'unisons').replace(/^note:(\d)$/, (_, s) => `${tuning.names[Number(s)]} string`));

  if (!strings) {
    return (
      <section className="panel scale-panel">
        <div className="panel-head"><div><h2>Neck drills</h2></div></div>
        <div className="listen-idle">
          These drills live on a fretboard.{' '}
          <button className="chip" onClick={() => dispatch({ type: 'instrument', id: 'guitar' })}>Switch to guitar</button>{' '}
          <button className="chip" onClick={() => dispatch({ type: 'instrument', id: 'bass' })}>or bass</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel scale-panel drill-panel">
      <div className="panel-head">
        <div>
          <h2>Neck drills</h2>
        </div>
        <div className="panel-actions">
          {best !== undefined && <span className="quiz-streak">best <strong>{best}</strong></span>}
          <button className="btn btn-spice" onClick={start}>{card || done ? 'Restart sprint' : 'Start sprint'}</button>
        </div>
      </div>

      <div className="triad-controls">
        {FRET_DRILLS.map((d) => (
          <button key={d.id} className={`chip ${d.id === drillKind ? 'chip-on' : ''}`} title={d.blurb} onClick={() => setDrillKind(d.id)}>
            {d.name}{progress.fretBest[d.id] !== undefined ? ` · ${progress.fretBest[d.id]}` : ''}
          </button>
        ))}
      </div>

      {!card && !done && (
        <div className="drill-intro">
          <strong>{drill.name}.</strong> {drill.blurb}
          <div className="practice-hint">
            Click the fretboard{inputSource === 'off' ? ', or answer on your instrument through Listen' : `, or play the answer (${inputSource})`}.
            {trouble.length > 0 && <> Still sticky: <strong>{trouble.join(' · ')}</strong>.</>}
          </div>
        </div>
      )}

      {card && (
        <>
          <div className="drill-head">
            <span className="drill-count">{Math.min(SPRINT, log.current.length + (revealed ? 0 : 1))} / {SPRINT}</span>
            <span className="drill-prompt">{card.prompt}</span>
            <span className="drill-dots">{log.current.map((o, i) => <i key={i} className={o.right ? 'dd-right' : 'dd-wrong'} />)}</span>
          </div>
          <DrillNeck card={card} names={tuning.names} maxFret={tuning.maxFret} lefty={lefty} revealed={!!revealed} wrong={wrong}
            onPick={(pos) => settle(checkClick(card, pos), pos)} />
          {card.choices && (
            <div className="drill-choices">
              {card.choices.map((c) => (
                <button key={c} disabled={!!revealed}
                  className={`chip drill-choice ${revealed && c === card.correctChoice ? 'chip-on' : ''}`}
                  onClick={() => settle(c === card.correctChoice)}>{c}</button>
              ))}
            </div>
          )}
          {revealed && (
            <div className={`drill-explain ${revealed === 'right' ? 'drill-right' : 'drill-miss'}`}>
              <span>{revealed === 'right' ? '✓' : '✕'} {card.explain}</span>
              {revealed === 'wrong' && <button className="btn" onClick={next}>Next ↵</button>}
            </div>
          )}
        </>
      )}

      {done && lastSprint && (
        <div className="grade drill-result">
          <div className={`grade-score ${lastSprint.score >= 80 ? 'grade-great' : lastSprint.score >= 55 ? 'grade-ok' : 'grade-low'}`}>
            {lastSprint.score}<span>score</span>
          </div>
          <div className="grade-body">
            <div className="grade-line"><strong>{lastSprint.correct} / {lastSprint.total}</strong> right at <strong>{lastSprint.pace.toFixed(1)} s</strong> a card. {lastSprint.pace <= 3 ? 'That is fluent speed.' : lastSprint.pace <= 5 ? 'Accurate — now chase speed: under 3 seconds means you have stopped counting frets.' : 'Still counting frets, which is fine for now. The shapes get faster than the counting.'}</div>
            {trouble.length > 0 && <div className="grade-line">Coming back next time: {trouble.join(' · ')}.</div>}
          </div>
        </div>
      )}
    </section>
  );
}
