// The right-hand column in Write: what could come next (by intention), what
// just happened (the teaching log), and the full palette of the key.

import { useApp } from '../state/AppContext';
import { chordSymbol } from '../theory/chords';
import { keyLabel } from '../theory/progression';
import { prettyNumeral, resolveNumeral } from '../theory/roman';
import { INTENTS } from '../theory/suggest';
import { styleChord } from '../state/reducer';

export function NextChordPanel() {
  const { nextOptions, addNextChord, realized } = useApp();
  const last = realized[realized.length - 1];
  return (
    <section className="panel next-panel">
      <div className="panel-head">
        <div>
          <h2>What next?</h2>
          <div className="panel-sub">after {last ? chordSymbol(last.chord) : 'silence'} — choose by what you want to happen</div>
        </div>
      </div>
      {INTENTS.map((intent) => {
        const options = nextOptions.filter((o) => o.intent === intent.id);
        if (!options.length) return null;
        return (
          <div key={intent.id} className="next-row" title={intent.blurb}>
            <span className="next-intent">{intent.icon} {intent.name}</span>
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
      <div className="palette-hint">hover for the reason · click to hear it and add it — the reason lands in the log</div>
    </section>
  );
}

export function LogPanel() {
  const { state } = useApp();
  return (
    <section className="panel log-panel">
      <div className="panel-head"><h2>What just happened</h2></div>
      <div className="log">
        {state.log.map((e) => (
          <div key={e.id} className={`log-entry log-${e.kind}`}>
            <div className="log-title">{e.icon} {e.title}</div>
            <div className="log-text">{e.text}</div>
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
      <div className="panel-head">
        <h2>Chords in {keyLabel(key)}</h2>
      </div>
      <div className="palette">
        {palette.map((p) => {
          const numeral = jazzyPalette ? p.seventhNumeral : p.numeral;
          const c = resolveNumeral(numeral, key);
          return (
            <button key={p.numeral} className="pal-chord" onClick={() => addPaletteChord(numeral)} title={`add ${chordSymbol(c)}`}>
              <span className="pal-numeral">{prettyNumeral(numeral)}</span>
              <span className="pal-symbol">{chordSymbol(styleChord(fakeSlot(numeral), c, genre))}</span>
            </button>
          );
        })}
      </div>
      <div className="shelf-head">BORROW SHELF <span>(out-of-key flavor)</span></div>
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
      <div className="palette-hint">click to hear & append — shelf chords explain themselves in the log</div>
    </section>
  );
}
