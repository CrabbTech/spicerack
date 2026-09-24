// The studio's three rooms, one nav. Same component in every header so the
// app reads as one instrument: build progressions, learn songs, drill hands.

export type ViewId = 'home' | 'playground' | 'songs' | 'drills';

const TABS: { id: ViewId; label: string; title: string }[] = [
  { id: 'home', label: '⌂ HOME', title: 'streaks, records, and today\'s session' },
  { id: 'playground', label: 'PLAYGROUND', title: 'build and study progressions' },
  { id: 'songs', label: '♪ SONGS', title: 'transcribed scores as OP-1 tab' },
  { id: 'drills', label: '🎯 DRILLS', title: 'flashcard sprints for the hands' },
];

export function NavTabs({ active, onNav }: { active: ViewId; onNav: (view: ViewId) => void }) {
  return (
    <nav className="nav-tabs" aria-label="views">
      {TABS.map((tab) => (
        <button key={tab.id} title={tab.title}
          className={`nav-tab${tab.id === active ? ' nav-tab-on' : ''}`}
          onClick={() => tab.id !== active && onNav(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
