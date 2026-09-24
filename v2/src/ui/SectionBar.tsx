// Song sections: tabs pick the section on the bench; the order row is the arrangement.

import { useApp } from '../state/AppContext';

export function SectionBar() {
  const { state, dispatch, genre, playSong, stopPlayback, songAt } = useApp();
  const { sections, arrangement, activeSection } = state;
  const songOn = songAt !== null;
  return (
    <div className="section-bar">
      <span className="control-label">Song</span>
      <div className="section-tabs">
        {sections.map((sec, i) => (
          <button key={i} className={`section-tab ${i === activeSection ? 'section-tab-on' : ''}`} onClick={() => dispatch({ type: 'section-select', idx: i })}>
            <strong>{sec.name}</strong>
            {sections.length > 1 && i === activeSection && (
              <span className="section-x" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'section-remove', idx: i }); }}>×</span>
            )}
          </button>
        ))}
        <button className="chip" disabled={sections.length >= 8} onClick={() => dispatch({ type: 'section-add', copy: true, genre })}>+ copy</button>
        <button className="chip" disabled={sections.length >= 8} onClick={() => dispatch({ type: 'section-add', copy: false, genre })}>+ new</button>
      </div>
      {sections.length > 1 && (
        <>
          <span className="control-label band-label">Order</span>
          <div className="arrangement">
            {arrangement.map((secIdx, i) => (
              <button key={i} className={`arr-chip ${songAt === i ? 'arr-now' : ''}`} title="remove"
                onClick={() => dispatch({ type: 'arrangement', order: arrangement.filter((_, k) => k !== i) })}>
                {sections[secIdx]?.name}
              </button>
            ))}
            {sections.map((sec, i) => (
              <button key={`add${i}`} className="chip arr-add" onClick={() => dispatch({ type: 'arrangement', order: [...arrangement, i] })}>+{sec.name}</button>
            ))}
          </div>
          <button className={`btn ${songOn ? 'btn-on' : ''}`} onClick={songOn ? stopPlayback : playSong}>{songOn ? '■ Song' : '▶ Play song'}</button>
        </>
      )}
    </div>
  );
}
