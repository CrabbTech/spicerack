// WRITE: the left page is the bench — key and genre, the song's sections, the
// chords with every harmonic tool, the melody workbench and the crab canon.
// The right page is the journal, what could come next, and the key's palette.

import { useApp } from '../../state/AppContext';
import { noteLabel } from '../../theory/notes';
import { MODE_NAMES, TONIC_CHOICES } from '../../theory/scales';
import { Spread } from '../Spread';
import { LessonBanner } from '../LessonBanner';
import { ProgressionPanel } from '../ProgressionPanel';
import { SectionBar } from '../SectionBar';
import { MelodyWorkbench } from '../MelodyWorkbench';
import { CrabCanon } from '../CrabCanon';
import { JournalPanel, NextChordPanel, PalettePanel } from '../SidePanels';
import { SoloPanel } from '../SoloPanel';

export function KeyGenreControls() {
  const { state, dispatch, genre, allGenres, customGenres, setLabEditing, setModal } = useApp();
  return (
    <section className="controls">
      <div className="control-row">
        <span className="control-label">Key</span>
        <div className="key-picker">
          {TONIC_CHOICES.map((t, i) => (
            <button key={i} className={i === state.tonicIdx ? 'key-on' : ''} onClick={() => dispatch({ type: 'tonic', idx: i })}>{noteLabel(t)}</button>
          ))}
        </div>
        <div className="mode-picker">
          {genre.modes.map((m) => (
            <button key={m} className={`chip ${m === state.mode ? 'chip-on' : ''}`} onClick={() => dispatch({ type: 'mode', mode: m, genre })}>{MODE_NAMES[m]}</button>
          ))}
        </div>
      </div>
      <div className="control-row">
        <span className="control-label">Genre</span>
        <div className="genre-picker">
          {allGenres.map((g) => (
            <button key={g.id} className={`chip genre-chip ${g.id === state.genreId ? 'chip-on' : ''}`} onClick={() => dispatch({ type: 'genre', genre: g })} title={g.tagline}>
              {g.name}
              {g.id.startsWith('custom-') && (
                <span className="chip-edit" onClick={(e) => { e.stopPropagation(); setLabEditing(customGenres.find((c) => c.id === g.id)); setModal('lab'); }}>edit</span>
              )}
            </button>
          ))}
          <button className="chip chip-lab" onClick={() => { setLabEditing(undefined); setModal('lab'); }}>Genre lab</button>
        </div>
      </div>
    </section>
  );
}

export function WriteView() {
  return (
    <Spread folio={5}
      left={
        <>
          <LessonBanner />
          <KeyGenreControls />
          <div className="col-left">
            <SectionBar />
            <ProgressionPanel editing />
            <MelodyWorkbench />
            <CrabCanon />
            <SoloPanel compact />
          </div>
        </>
      }
      right={
        <div className="col-right">
          <JournalPanel />
          <NextChordPanel />
          <PalettePanel />
        </div>
      }
    />
  );
}
