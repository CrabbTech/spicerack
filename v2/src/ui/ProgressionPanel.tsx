// The progression bench: the cards, the arrows between them, and — in Write —
// every tool that changes the chords. Jam shows the same cards as a chart.

import { Fragment } from 'react';
import { useApp } from '../state/AppContext';
import { chordSymbol } from '../theory/chords';
import { keyLabel } from '../theory/progression';
import { ChordCard } from './ChordCard';
import { PracticeStrip } from './PracticeStrip';
import { TransitionPanel } from './TransitionPanel';

const HEAT = ['Mild', 'Medium', 'Hot'];

export function ProgressionPanel({ editing }: { editing: boolean }) {
  const app = useApp();
  const {
    state, dispatch, genre, key, realized, guitarCandidates, voicingIdx, op1Voicings, pianoVoicings, bassShapes, cardApps,
    templatesForMode, order, selIdx, xfer, setXfer, setXferTag, xferInsight, xferTag, loopingXfer, ab, copied,
    modulatedPreview, transposeNow,
  } = app;
  const sectionName = state.sections[state.activeSection]?.name;

  return (
    <section className="panel prog-panel">
      <div className="panel-head">
        <div>
          <h2>{state.sections.length > 1 && <span className="section-badge">{sectionName}</span>}{state.templateName}</h2>
          <div className="panel-sub">
            {keyLabel(key)}{state.meter ? ` · ${state.meter}` : ''} · {genre.name}
            {state.templateNote && <span className="tpl-note"> — {state.templateNote}</span>}
          </div>
        </div>
        {editing && (
          <div className="panel-actions">
            <button className="btn" onClick={() => app.setModal('compose')}>Compose</button>
            <select className="tpl-select"
              value={templatesForMode.some((t) => t.name === state.templateName) ? state.templateName : ''}
              onChange={(e) => {
                const t = templatesForMode.find((x) => x.name === e.target.value);
                if (t) dispatch({ type: 'pick-template', template: t });
              }}>
              <option value="" disabled>Progression…</option>
              {templatesForMode.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} · {t.numerals.slice(0, 6).join(' ')}{t.numerals.length > 6 ? '…' : ''}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => dispatch({ type: 'new-progression', genre })}>New</button>
            <button className="btn btn-spice" onClick={app.spiceItUp}>Spice it up</button>
            <div className="seg heat-seg">
              {([1, 2, 3] as const).map((h) => (
                <button key={h} className={state.heat === h ? 'seg-on' : ''} onClick={() => dispatch({ type: 'heat', heat: h })}>{HEAT[h - 1]}</button>
              ))}
            </div>
            <button className="btn" onClick={() => dispatch({ type: 'undo' })} disabled={state.history.length === 0}>Undo</button>
            <button className={`btn ${ab ? 'btn-on' : ''}`} onClick={ab ? app.stopPlayback : app.startAB} disabled={state.history.length === 0}>
              {ab ? '■ A/B' : 'A/B'}
            </button>
            <button className="btn" onClick={() => dispatch({ type: 'reset-spice' })} disabled={state.slots === state.baseSlots && state.modulate === null}>Reset</button>
            {state.instrument === 'guitar' && <button className="btn" onClick={app.copyTab}>{copied === 'tab' ? 'Copied' : 'Copy tab'}</button>}
            {state.instrument === 'bass' && <button className="btn" onClick={app.copyBassTab}>{copied === 'tab' ? 'Copied' : 'Copy tab'}</button>}
            {(state.instrument === 'piano' || state.instrument === 'op1') && <button className="btn" onClick={app.copyChart}>{copied === 'chart' ? 'Copied' : 'Copy chart'}</button>}
            <button className="btn" onClick={app.exportMidi}>{copied === 'midi' ? 'Saved' : 'MIDI'}</button>
            <button className="btn" onClick={app.saveToLibrary}>{copied === 'saved' ? 'Saved' : 'Save'}</button>
          </div>
        )}
      </div>
      <PracticeStrip />
      <div className="cards">
        {realized.map((r, i) => (
          <Fragment key={r.slot.id}>
            <ChordCard
              realized={r}
              symbol={chordSymbol(r.chord)}
              instrument={state.instrument}
              guitarVoicing={guitarCandidates[i][voicingIdx[i]]}
              guitarVoicingCount={guitarCandidates[i].length}
              op1Voicing={op1Voicings[i]}
              pianoVoicing={pianoVoicings[i]}
              bassShape={bassShapes[i]}
              isActive={state.playingSlot === i}
              isFocus={!state.playing && selIdx === i}
              loopState={order ? (order.includes(i) ? 'in' : 'out') : undefined}
              apps={editing ? cardApps.get(r.slot.id) ?? [] : []}
              canRemove={editing && state.slots.length > 2}
              onStrum={(e) => app.clickCard(i, e)}
              onCycleVoicing={(dir) => {
                const n = guitarCandidates[i].length;
                if (n) dispatch({ type: 'cycle-voicing', slotId: r.slot.id, next: (voicingIdx[i] + dir + n) % n });
              }}
              onCycleBars={() => app.cycleBars(r.slot.id, r.slot.bars)}
              onApply={(a) => dispatch({ type: 'apply-batch', steps: [app.asStep(a)] })}
              onRemove={() => dispatch({ type: 'remove-slot', slotId: r.slot.id })}
            />
            {realized.length > 1 && (
              <button className={`xfer-btn ${xfer === i ? 'xfer-btn-on' : ''}`}
                onClick={() => { setXfer(xfer === i ? null : i); setXferTag(null); }}>
                {i === realized.length - 1 ? '↻' : '→'}
              </button>
            )}
          </Fragment>
        ))}
      </div>
      {xferInsight && (
        <TransitionPanel insight={xferInsight} activeTag={xferTag} looping={loopingXfer}
          onHear={app.hearTransition} onLoop={app.loopTransition} onClose={() => setXfer(null)} />
      )}
      {ab && (
        <div className="ab-banner">
          {(['A', 'B'] as const).map((side) => (
            <div key={side} className={`ab-row ${ab.side === side ? 'ab-live' : ''}`}>
              <span className="ab-side">{side === 'A' ? 'before' : 'after'}</span>
              {(side === 'A' ? ab.before : ab.after).map((c, i) => (
                <span key={i} className={`ab-chip ${c.changed ? 'ab-changed' : ''} ${ab.side === side && ab.idx === i ? 'ab-now' : ''}`}>{c.symbol}</span>
              ))}
            </div>
          ))}
        </div>
      )}
      {modulatedPreview && (
        <div className={`modulation-banner ${transposeNow ? 'modulation-live' : ''}`}>
          {transposeNow ? 'Up a whole step: ' : 'Every other pass goes up a whole step: '}<strong>{modulatedPreview}</strong>
        </div>
      )}
    </section>
  );
}
