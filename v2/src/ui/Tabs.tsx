// The index tabs along the top edge of the book: Learn, Jam, Write. The one
// you're on is cut from the same paper as the page and joins it.

import { useApp } from '../state/AppContext';
import { ViewId } from '../state/reducer';

export const VIEWS: { id: ViewId; name: string; note: string }[] = [
  { id: 'learn', name: 'Learn', note: 'lessons, drills, the ear' },
  { id: 'jam', name: 'Jam', note: 'instrument in hand' },
  { id: 'write', name: 'Write', note: 'chords, melody, song' },
];

export function Tabs() {
  const { state, dispatch } = useApp();
  return (
    <nav className="tabs" aria-label="pages">
      {VIEWS.map((v) => (
        <button key={v.id} className={`tab ${state.view === v.id ? 'tab-on' : ''}`} title={v.note}
          aria-current={state.view === v.id ? 'page' : undefined} onClick={() => dispatch({ type: 'view', view: v.id })}>
          {v.name}
        </button>
      ))}
    </nav>
  );
}
