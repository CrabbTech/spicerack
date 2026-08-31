// Home: the studio's front door. Your streak, your records, and a suggested
// session assembled from what the app remembers — then one click into the
// right room.

import { useMemo } from 'react';
import { keyLabel } from '../theory/harmony';
import { SONGS } from '../data/songs';
import {
  collectProgress, dayStamp, readDays, readTakes, readTrouble, sparkPoints, storageEntries,
  readLast, streakOf, suggestSession, takesFor, topTrouble,
} from '../practice/progress';
import { keyTag } from '../op1/op1';
import { NavTabs, ViewId } from './NavTabs';

export interface HomeViewProps {
  onNav: (view: ViewId) => void;
  onOpenSong: (songId: string, view: 'songs' | 'drills') => void;
}

export function HomeView({ onNav, onOpenSong }: HomeViewProps) {
  const progress = useMemo(() => collectProgress(storageEntries()), []);
  const takes = useMemo(() => readTakes(), []);
  const days = useMemo(() => readDays(), []);
  const streak = useMemo(() => streakOf(days, dayStamp()), [days]);
  const steps = useMemo(() => suggestSession(SONGS, progress), [progress]);

  const bestFor = (songId: string) =>
    progress.songBests.filter((b) => b.songId === songId)
      .sort((a, b) => b.tempoPct - a.tempoPct || b.accuracy - a.accuracy)[0];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">F4</div>
          <div>
            <div className="brand-name">OP-1 FIELD STUDIO</div>
            <div className="brand-sub">
              {SONGS.length} songs · {progress.songBests.length} graded takes on record
            </div>
          </div>
        </div>
        <div className="transport">
          <NavTabs active="home" onNav={onNav} />
        </div>
      </header>

      <main className="home-grid">
        <section className="home-hero">
          <div className="home-streak">
            <span className="home-streak-num">{streak}</span>
            <span className="home-streak-label">day streak</span>
            <span className="meta-line">
              {days.length === 0
                ? 'a graded take or a drill run starts the log'
                : streak === 0
                  ? `${days.length} practice days logged — pick it back up today`
                  : 'any graded take or drill run keeps it alive'}
            </span>
          </div>
          <div className="home-session">
            {(() => {
              const last = readLast();
              const song = last && SONGS.find((s) => s.id === last.songId);
              if (!song) return null;
              const section = song.sections[last.sectionIdx] ?? song.sections[0];
              return (
                <button className="primary-btn home-resume" onClick={() => onOpenSong(song.id, 'songs')}>
                  ▶ Resume {song.title} — {section.name} @ {last.tempoPct}%
                </button>
              );
            })()}
            <h2>Today's session</h2>
            {steps.map((step, i) => (
              <button key={i} className="session-step"
                onClick={() => (step.go.songId ? onOpenSong(step.go.songId, step.go.view) : onNav(step.go.view))}>
                <span className="session-num">{i + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.why}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-shelf">
          <div className="section-head">
            <div>
              <h1>Song shelf</h1>
              <div className="meta-line">click to open on the practice stand</div>
            </div>
          </div>
          <div className="shelf-grid">
            {SONGS.map((song) => {
              const best = bestFor(song.id);
              return (
                <button key={song.id} className="shelf-card" onClick={() => onOpenSong(song.id, 'songs')}>
                  <strong>{song.title}</strong>
                  <em>{keyLabel(song.key)} · ♩={song.bpm}</em>
                  {best
                    ? <span className="shelf-best">best {best.accuracy}% @ {best.tempoPct}% tempo</span>
                    : <span className="shelf-best shelf-untried">no graded take yet</span>}
                  {(() => {
                    const history = takesFor(takes, song.id).slice(-12);
                    if (history.length < 2) return null;
                    return (
                      <svg className="shelf-spark" viewBox="0 0 84 22" width={84} height={22}
                        aria-label={`last ${history.length} takes`}>
                        <polyline points={sparkPoints(history.map((t) => t.accuracy), 84, 20)} />
                      </svg>
                    );
                  })()}
                  {(() => {
                    const worst = topTrouble(readTrouble(song.id), 2);
                    return worst.length
                      ? <span className="shelf-trouble">watch {worst.map((t) => keyTag(t.index)).join(' · ')}</span>
                      : null;
                  })()}
                  <span className="shelf-actions">
                    <span className="chip" onClick={(e) => { e.stopPropagation(); onOpenSong(song.id, 'drills'); }}>
                      🎯 drill its grabs
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {progress.drillBests.length > 0 && (
          <section className="home-shelf">
            <div className="section-head compact-head">
              <div>
                <h2>Drill records</h2>
                <div className="meta-line">seconds + 2s per wrong press — lower is better</div>
              </div>
            </div>
            <div className="drill-records">
              {progress.drillBests.slice(0, 8).map((d, i) => (
                <div key={i} className="drill-record">
                  <strong>{d.seconds}s</strong>
                  <span>{d.songId ? `song grabs · ${SONGS.find((s) => s.id === d.songId)?.title ?? d.songId}` : d.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
