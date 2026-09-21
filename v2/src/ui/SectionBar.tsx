// Song sections: a loop becomes a song when something contrasts with it.
// Tabs pick the section on the bench; the order row is the arrangement.

import { useApp } from '../state/AppContext';

export function SectionBar() {
  const { state, dispatch, genre, playSong, stopPlayback, songAt } = useApp();
  const { sections, arrangement, activeSection } = state;
  const songOn = songAt !== null;
  return (
    <div className="section-bar">
      <span className="control-label">SONG</span>
      <div className="section-tabs">
        {sections.map((sec, i) => (
          <button key={i} className={`section-tab ${i === activeSection ? 'section-tab-on' : ''}`}
            onClick={() => dispatch({ type: 'section-select', idx: i })}
            title={`${i === activeSection ? state.templateName : sec.templateName} — ${(i === activeSection ? state.slots : sec.slots).length} chords`}>
            <strong>{sec.name}</strong>
            {sections.length > 1 && i === activeSection && (
              <span className="section-x" title="remove this section"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'section-remove', idx: i }); }}>×</span>
            )}
          </button>
        ))}
        <button className="chip" disabled={sections.length >= 8} title="a copy of this section to vary — the quickest way to a second verse"
          onClick={() => dispatch({ type: 'section-add', copy: true, genre })}>＋ copy</button>
        <button className="chip" disabled={sections.length >= 8} title="a fresh progression for contrast — a chorus, a bridge"
          onClick={() => dispatch({ type: 'section-add', copy: false, genre })}>＋ new</button>
      </div>
      {sections.length > 1 && (
        <>
          <span className="control-label band-label">ORDER</span>
          <div className="arrangement">
            {arrangement.map((secIdx, i) => (
              <button key={i} className={`arr-chip ${songAt === i ? 'arr-now' : ''}`} title="click to remove from the order"
                onClick={() => dispatch({ type: 'arrangement', order: arrangement.filter((_, k) => k !== i) })}>
                {sections[secIdx]?.name}
              </button>
            ))}
            {sections.map((sec, i) => (
              <button key={`add${i}`} className="chip arr-add" title={`add ${sec.name} to the end`}
                onClick={() => dispatch({ type: 'arrangement', order: [...arrangement, i] })}>+{sec.name}</button>
            ))}
          </div>
          <button className={`btn ${songOn ? 'btn-on' : ''}`} onClick={songOn ? stopPlayback : playSong}
            title="play every section in order — the bench follows along">
            {songOn ? '■ Song' : '▶ Play song'}
          </button>
        </>
      )}
    </div>
  );
}
