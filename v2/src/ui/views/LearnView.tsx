// LEARN: the left page is the contents — paths of short steps, each of which
// stages the bench and sends you to the page where the doing happens — and
// the burrow. The right page is today: the month of stamps and the records.

import { useApp } from '../../state/AppContext';
import { PATHS } from '../../data/lessons';
import { LENSES } from '../../theory/solo';
import { FRET_DRILLS } from '../../practice/fretDrills';
import { streak } from '../../practice/progress';
import { Spread } from '../Spread';
import { Stamps } from '../Stamps';
import { Burrow } from '../Burrow';

const GOAL_LABEL = (goal: (typeof PATHS)[number]['steps'][number]['goal']): string => {
  switch (goal.kind) {
    case 'score': return `play ${goal.min}+`;
    case 'fret': return `sprint ${goal.min}+`;
    case 'crab': return `crab ${goal.min}+`;
    case 'burrow': return `floor ${goal.depth}`;
    case 'coach': return 'coach';
    case 'check': return 'check';
  }
};

/** A hand-drawn tick, so a finished step looks ticked off rather than typeset. */
function Tick() {
  return (
    <svg className="tick" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path className="tick-path" d="M2.5 8.8 C4.5 10.5 5.6 12 6.4 13.2 C8 9.5 10.5 6 14 2.8" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LearnView() {
  const { progress, lessonDone, startLesson, lessonId, allGenres } = useApp();
  const days = streak(progress);
  const stepsDone = progress.lessons.length;
  const stepsAll = PATHS.reduce((n, p) => n + p.steps.length, 0);
  return (
    <Spread folio={1}
      left={
        <div className="learn">
          <section className="panel learn-intro">
            <div className="panel-head">
              <div>
                <h2>Contents</h2>
                <div className="panel-sub">Each step sets the bench up and asks for one thing. Where the app can hear you, it ticks the step off itself.</div>
              </div>
            </div>
          </section>
          <div className="paths">
            {PATHS.map((path) => {
              const done = path.steps.filter((s) => lessonDone(s.id)).length;
              const upNext = path.steps.find((s) => !lessonDone(s.id));
              return (
                <section key={path.id} className="panel path">
                  <div className="path-head">
                    <div>
                      <h2>{path.name}</h2>
                      <div className="panel-sub">{path.blurb}</div>
                    </div>
                    <span className="path-count">{done}/{path.steps.length}</span>
                  </div>
                  <ol className="steps">
                    {path.steps.map((step) => (
                      <li key={step.id} className={`step ${lessonDone(step.id) ? 'step-done' : ''} ${step.id === lessonId ? 'step-on' : ''} ${step === upNext ? 'step-next' : ''}`}>
                        <button className="step-go" onClick={() => startLesson(step)}>
                          <span className="step-mark">{lessonDone(step.id) ? <Tick /> : step === upNext ? '▶' : '○'}</span>
                          <span className="step-title">{step.title}</span>
                          <span className="step-goal">{GOAL_LABEL(step.goal)}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
          <Burrow />
        </div>
      }
      right={
        <div className="col-right">
          <section className="panel today-panel">
            <div className="panel-head"><div><h2>Today</h2><div className="panel-sub">what the book says so far</div></div></div>
            <div className="learn-stats">
              <div><strong>{stepsDone}</strong><span>of {stepsAll} steps</span></div>
              <div><strong>{days}</strong><span>day streak</span></div>
              <div><strong>{Object.values(progress.drillPasses).reduce((a, b) => a + (b ?? 0), 0)}</strong><span>graded passes</span></div>
            </div>
            <Stamps progress={progress} />
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Records</h2><div className="panel-sub">best graded pass per drill, best sprint per neck drill, deepest burrow per genre</div></div></div>
            <div className="records">
              {LENSES.map((l) => (
                <div key={l.id} className="record">
                  <span>{l.name}</span>
                  <span className="record-bar"><i style={{ width: `${progress.drillBest[l.id] ?? 0}%` }} /></span>
                  <strong>{progress.drillBest[l.id] ?? '—'}</strong>
                </div>
              ))}
              {FRET_DRILLS.map((d) => (
                <div key={d.id} className="record">
                  <span>{d.name}</span>
                  <span className="record-bar"><i style={{ width: `${progress.fretBest[d.id] ?? 0}%` }} /></span>
                  <strong>{progress.fretBest[d.id] ?? '—'}</strong>
                </div>
              ))}
              {allGenres.filter((g) => progress.burrowBest[g.id]).map((g) => (
                <div key={`burrow-${g.id}`} className="record">
                  <span>{g.name} · burrow</span>
                  <span className="record-bar"><i style={{ width: `${Math.min(100, (progress.burrowBest[g.id] / 12) * 100)}%` }} /></span>
                  <strong>{progress.burrowBest[g.id]}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      }
    />
  );
}
