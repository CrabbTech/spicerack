// The shell: one controller, a desk, and a book open at one of three pages —
// Learn (one lesson, one task), Jam (instrument in hand, eyes on the
// diagram) and Write (chords, melody, song). The tabs turn the page.

import { useAppController } from '../state/controller';
import { AppContext } from '../state/AppContext';
import { GENRE_LIST } from '../data/genres';
import { materializeGenre } from '../data/customGenres';
import { Tabs } from './Tabs';
import { LearnView } from './views/LearnView';
import { JamView } from './views/JamView';
import { WriteView } from './views/WriteView';
import { GenreLab } from './GenreLab';
import { LibraryModal, saveLibrary } from './LibraryModal';
import { ComposeModal } from './ComposeModal';
import { CoverModal } from './CoverModal';

export default function App() {
  const app = useAppController();
  const { state, dispatch, modal, setModal } = app;

  return (
    <AppContext.Provider value={app}>
      <div className={`desk view-${state.view}`}>
        <Tabs />
        <div className="book">
          {state.view === 'learn' && <LearnView />}
          {state.view === 'jam' && <JamView />}
          {state.view === 'write' && <WriteView />}
        </div>

        {modal === 'cover' && <CoverModal onClose={() => setModal(null)} />}
        {modal === 'compose' && (
          <ComposeModal settings={app.composeSettings} onChange={app.setComposeSettings}
            onGenerate={app.composeNow} onClose={() => setModal(null)} />
        )}
        {modal === 'lab' && (
          <GenreLab editing={app.labEditing} onSave={app.saveCustomGenre} onDelete={app.deleteCustomGenre} onClose={() => setModal(null)} />
        )}
        {modal === 'library' && (
          <LibraryModal
            items={app.library}
            genreName={(id) => app.allGenres.find((g) => g.id === id)?.name ?? 'lost genre'}
            onLoad={(item) => {
              const g = app.allGenres.find((x) => x.id === item.genreId)
                ?? app.customGenres.map(materializeGenre).find((x) => x.id === item.genreId) ?? GENRE_LIST[0];
              dispatch({ type: 'load-save', item, genre: g });
            }}
            onDelete={(id) => {
              const next = app.library.filter((x) => x.id !== id);
              app.setLibrary(next);
              saveLibrary(next);
            }}
            onUpdate={(item) => {
              const next = app.library.map((x) => (x.id === item.id ? item : x));
              app.setLibrary(next);
              saveLibrary(next);
            }}
            onImport={(items) => {
              const next = [...items, ...app.library].slice(0, 120);
              app.setLibrary(next);
              saveLibrary(next);
            }}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}
