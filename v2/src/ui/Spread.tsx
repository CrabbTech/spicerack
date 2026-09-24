// The open book: two pages and the gutter between them. The left page carries
// the wordmark and the transport in its running head, the right page today's
// date; each has a folio at the foot. Views only decide what goes on the pages.

import { ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { BRAND } from '../brand';
import { audio } from '../audio/engine';
import { op1RangeLabel } from '../op1/op1';
import { pianoRangeLabel } from '../piano/piano';
import { streak } from '../practice/progress';
import { dateline, dayOfYear, daysInYear, isoWeek } from '../state/dates';
import { PixelCrab } from './PixelCrab';

const SHORTCUTS: Record<string, string> = {
  learn: 'space play · j jam · every key: inside the cover',
  jam: 'space play · l lick · j write · d drums · b bass · m mute · 1–4 instrument · esc clear · every key: inside the cover',
  write: 'space play · n new · c compose · s spice · u undo · x a/b · r reset · l lick · k crab · j jam · every key: inside the cover',
};

function Transport() {
  const { state, dispatch, bpm, startPlayback, stopPlayback } = useApp();
  return (
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
    </div>
  );
}

function HeadLeft() {
  const { state, setModal } = useApp();
  return (
    <header className="running-head">
      <button className="brand" title="the inside cover" onClick={() => setModal('cover')}>
        <PixelCrab size={40} title={BRAND.name} walking={state.playing} />
        <div className="brand-words">
          <span className="brand-name">{BRAND.mark}</span>
          <span className="brand-tag">{BRAND.tagline}</span>
        </div>
      </button>
      <Transport />
    </header>
  );
}

function HeadRight() {
  const { progress, setModal } = useApp();
  const days = streak(progress);
  const now = new Date();
  return (
    <header className="running-head running-head-right">
      <div className="dateline-block">
        <div className="dateline">{dateline(now)}</div>
        <div className="dayline">
          day {dayOfYear(now)} · week {isoWeek(now)}
          {days > 0 && <> · <strong>{days} day{days === 1 ? '' : 's'} running</strong></>}
        </div>
      </div>
      <button className="btn" onClick={() => setModal('library')}>Library</button>
    </header>
  );
}

export function Spread({ left, right, folio }: { left: ReactNode; right: ReactNode; /** the left page's number; the right page is the next one */ folio: number }) {
  const { state, inputSource } = useApp();
  const now = new Date();
  return (
    <>
      <div className="page page-left">
        <HeadLeft />
        <div className="page-body">{left}</div>
        <footer className="running-foot">
          <span className="foot-note">{SHORTCUTS[state.view]}{inputSource === 'qwerty' ? ' · letter shortcuts pause while the keyboard is a piano' : ''}</span>
          <span className="folio">{folio}</span>
        </footer>
      </div>
      <div className="gutter" aria-hidden="true" />
      <div className="page page-right">
        <HeadRight />
        <div className="page-body">{right}</div>
        <footer className="running-foot">
          <span className="folio">{folio + 1}</span>
          <span className="foot-note">{dayOfYear(now)} of {daysInYear(now)}</span>
        </footer>
      </div>
    </>
  );
}
