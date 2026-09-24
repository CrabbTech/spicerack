// WRITE: key and genre, the song's sections, the chord bench with every
// harmonic tool, and the melody workbench — with the reasons alongside.

import { useApp } from '../../state/AppContext';
import { noteLabel } from '../../theory/notes';
import { MODE_NAMES, TONIC_CHOICES } from '../../theory/scales';
import { ProgressionPanel } from '../ProgressionPanel';
import { SectionBar } from '../SectionBar';
import { MelodyWorkbench } from '../MelodyWorkbench';
import { CrabCanon } from '../CrabCanon';
import { LogPanel, NextChordPanel, PalettePanel } from '../SidePanels';
import { SoloPanel } from '../SoloPanel';

export function KeyGenreControls() {
  const { state, dispatch, genre, allGenres, customGenres, setLabEditing, setModal } = useApp();
  return (
    <section className="controls">
      <div className="control-row">
        <span className="control-label">KEY</span>
        <div className="key-picker">
          {TONIC_CHOICES.map((t, i) => (
            <button key={i} className={i === state.tonicIdx ? 'key-on' : ''} onClick={() => dispatch({ type: 'tonic', idx: i })}>
              {noteLabel(t)}
            </button>
          ))}
        </div>
        <div className="mode-picker">
          {genre.modes.map((m) => (
            <button key={m} className={`chip ${m === state.mode ? 'chip-on' : ''}`} onClick={() => dispatch({ type: 'mode', mode: m, genre })}>
              {MODE_NAMES[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="control-row">
        <span className="control-label">GENRE</span>
        <div className="genre-picker">
          {allGenres.map((g) => (
            <button key={g.id} className={`chip genre-chip ${g.id === state.genreId ? 'chip-on' : ''}`}
              onClick={() => dispatch({ type: 'genre', genre: g })} title={g.tagline}>
              {g.emoji} {g.name}
              {g.id.startsWith('custom-') && (
                <span className="chip-edit" title="edit in Genre Lab"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLabEditing(customGenres.find((c) => c.id === g.id));
                    setModal('lab');
                  }}> ✎</span>
              )}
            </button>
          ))}
          <button className="chip chip-lab" onClick={() => { setLabEditing(undefined); setModal('lab'); }} title="cook up your own genre">
            🧪 Genre Lab
          </button>
        </div>
      </div>
    </section>
  );
}

export function WriteView() {
  return (
    <>
      <KeyGenreControls />
      <main className="main">
        <div className="col-left">
          <SectionBar />
          <ProgressionPanel editing />
          <MelodyWorkbench />
          <CrabCanon />
          <SoloPanel compact />
        </div>
        <div className="col-right">
          <NextChordPanel />
          <LogPanel />
          <PalettePanel />
        </div>
      </main>
    </>
  );
}
