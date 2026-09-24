// The right-hand page in Write: the journal (what the app told you, with the
// time it said it, today and the days before), what could come next (by
// intention), and the full palette of the key.

import { useRef } from 'react';
import { useApp } from '../state/AppContext';
import { chordSymbol } from '../theory/chords';
import { keyLabel } from '../theory/progression';
import { prettyNumeral, resolveNumeral } from '../theory/roman';
import { INTENTS } from '../theory/suggest';
import { styleChord } from '../state/reducer';
import { journalDays } from '../state/journal';
import { timeLabel } from '../state/dates';

export function NextChordPanel() {
  const { nextOptions, addNextChord, realized } = useApp();
  const last = realized[realized.length - 1];
  return (
    <section className="panel next-panel">
      <div className="panel-head">
        <div>
          <h2>What next</h2>
          <div className="panel-sub">after {last ? chordSymbol(last.chord) : 'silence'}</div>
        </div>
      </div>
      {INTENTS.map((intent) => {
        const options = nextOptions.filter((o) => o.intent === intent.id);
        if (!options.length) return null;
        return (
          <div key={intent.id} className="next-row" title={intent.blurb}>
            <span className="next-intent">{intent.name}</span>
            <div className="next-options">
              {options.map((o) => (
                <button key={o.numeral} className={`pal-chord next-chord numeral-${o.chord.func}`} title={o.why} onClick={() => addNextChord(o)}>
                  <span className="pal-numeral">{prettyNumeral(o.numeral)}</span>
                  <span className="pal-symbol">{chordSymbol(o.chord)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function JournalPanel() {
  const { journal } = useApp();
  // lines written since this page was opened get inked in; older ones are simply there
  const opened = useRef(new Set(journal.map((e) => e.id)));
  const days = journalDays(journal);
  return (
    <section className="panel journal-panel">
      <div className="panel-head">
        <div>
          <h2>Journal</h2>
          <div className="panel-sub">every move, explained — and kept</div>
        </div>
      </div>
      <div className="journal">
        {!days.length && <div className="journal-empty">Nothing written yet. Spice a chord, pick what comes next, mirror the song — the reasons land here.</div>}
        {days.map((d, di) => (
          <div key={d.day} className="journal-day">
            {(di > 0 || d.label !== 'Today') && <div className="journal-dayhead">{d.label}</div>}
            {d.entries.map((e) => (
              <div key={e.id} className={`journal-entry journal-${e.kind} ${opened.current.has(e.id) ? '' : 'journal-new'}`}>
                <span className="journal-time">{timeLabel(e.at)}</span>
                <div className="journal-title">{e.title}</div>
                <div className="journal-text">{e.text}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PalettePanel() {
  const { key, genre, palette, shelf, jazzyPalette, addPaletteChord, fakeSlot } = useApp();
  return (
    <section className="panel palette-panel">
      <div className="panel-head"><h2>Chords in {keyLabel(key)}</h2></div>
      <div className="palette">
        {palette.map((p) => {
          const numeral = jazzyPalette ? p.seventhNumeral : p.numeral;
          const c = resolveNumeral(numeral, key);
          return (
            <button key={p.numeral} className="pal-chord" onClick={() => addPaletteChord(numeral)}>
              <span className="pal-numeral">{prettyNumeral(numeral)}</span>
              <span className="pal-symbol">{chordSymbol(styleChord(fakeSlot(numeral), c, genre))}</span>
            </button>
          );
        })}
      </div>
      <div className="shelf-head">Borrow shelf</div>
      <div className="palette">
        {shelf.map((s) => {
          const c = resolveNumeral(s.numeral, key);
          return (
            <button key={s.numeral} className="pal-chord pal-borrowed" onClick={() => addPaletteChord(s.numeral, s.hook)} title={s.hook}>
              <span className="pal-numeral">{prettyNumeral(s.numeral)}</span>
              <span className="pal-symbol">{chordSymbol(c)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
