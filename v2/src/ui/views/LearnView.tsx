// LEARN: paths of short steps. Each step stages the bench and sends you to
// the workspace where the doing happens; what you finish stays finished.

import { useApp } from '../../state/AppContext';
import { PATHS } from '../../data/lessons';
import { LENSES } from '../../theory/solo';
import { FRET_DRILLS } from '../../practice/fretDrills';
import { streak } from '../../practice/progress';

function EarQuiz() {
  const { quiz, quizStreak, newQuizRound, answerQuiz, replayQuiz, genre, state } = useApp();
  const right = quiz && quiz.answered !== null && quiz.answered === quiz.round.changed;
  return (
    <section className="panel quiz-panel">
      <div className="panel-head">
        <div>
          <h2>Ear quiz</h2>
          <div className="panel-sub">A {genre.name} loop plays twice. One chord in the second pass is spiced — which?</div>
        </div>
        <div className="panel-actions">
          <span className="quiz-streak">streak <strong>{quizStreak}</strong></span>
          <button className="btn btn-spice" onClick={() => newQuizRound()} disabled={state.playing && !!quiz?.phase}>{quiz ? 'Next round' : 'Start'}</button>
          {quiz && <button className="btn" onClick={replayQuiz}>Again</button>}
        </div>
      </div>
      {quiz && (
        <>
          <div className="quiz-rows">
            {(['A', 'B'] as const).map((side) => (
              <div key={side} className={`ab-row ${quiz.phase === side ? 'ab-live' : ''}`}>
                <span className="ab-side">{side === 'A' ? 'first' : 'second'}</span>
                {quiz.before.map((_, i) => {
                  const revealed = quiz.answered !== null;
                  const symbol = side === 'A' ? quiz.before[i] : quiz.after[i];
                  const now = quiz.phase === side && quiz.at === i;
                  if (side === 'A') return <span key={i} className={`ab-chip ${now ? 'ab-now' : ''}`}>{revealed ? symbol : i + 1}</span>;
                  return (
                    <button key={i} disabled={revealed}
                      className={`ab-chip quiz-pick ${now ? 'ab-now' : ''} ${revealed && i === quiz.round.changed ? 'ab-changed' : ''} ${revealed && quiz.answered === i && !right ? 'quiz-wrong' : ''}`}
                      onClick={() => answerQuiz(i)}>
                      {revealed ? symbol : i + 1}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {quiz.answered !== null && (
            <div className={`quiz-reveal ${right ? 'quiz-right' : ''}`}>
              <strong>{right ? 'Yes.' : `It was chord ${quiz.round.changed + 1}.`} {quiz.round.spiceName}:</strong> {quiz.round.explanation}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const GOAL_LABEL = (goal: (typeof PATHS)[number]['steps'][number]['goal']): string => {
  switch (goal.kind) {
    case 'score': return `play ${goal.min}+`;
    case 'fret': return `sprint ${goal.min}+`;
    case 'crab': return `crab ${goal.min}+`;
    case 'coach': return 'coach';
    case 'quiz': return 'quiz';
    case 'check': return 'check';
  }
};

export function LearnView() {
  const { progress, lessonDone, startLesson, lessonId } = useApp();
  const days = streak(progress);
  return (
    <main className="learn">
      <section className="panel learn-intro">
        <div>
          <h2>Learn by doing</h2>
          <div className="panel-sub">Each step sets the bench up and asks for one thing. Where the app can hear you, it checks the step off itself.</div>
        </div>
        <div className="learn-stats">
          <div><strong>{progress.lessons.length}</strong><span>steps done</span></div>
          <div><strong>{days}</strong><span>day streak</span></div>
          <div><strong>{Object.values(progress.drillPasses).reduce((a, b) => a + (b ?? 0), 0)}</strong><span>graded passes</span></div>
        </div>
      </section>

      <div className="paths">
        {PATHS.map((path) => {
          const done = path.steps.filter((s) => lessonDone(s.id)).length;
          const upNext = path.steps.find((s) => !lessonDone(s.id));
          return (
            <section key={path.id} className="panel path">
              <div className="path-head">
                <span className="path-icon" />
                <div>
                  <h2>{path.name}</h2>
                  <div className="panel-sub">{path.blurb}</div>
                </div>
              </div>
              <div className="path-meter"><i style={{ width: `${(done / path.steps.length) * 100}%` }} /></div>
              <ol className="steps">
                {path.steps.map((step) => (
                  <li key={step.id} className={`step ${lessonDone(step.id) ? 'step-done' : ''} ${step.id === lessonId ? 'step-on' : ''} ${step === upNext ? 'step-next' : ''}`}>
                    <button className="step-go" onClick={() => startLesson(step)}>
                      <span className="step-mark">{lessonDone(step.id) ? '✓' : step === upNext ? '▶' : '○'}</span>
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

      <EarQuiz />

      <section className="panel">
        <div className="panel-head"><div><h2>Records</h2><div className="panel-sub">best graded pass per drill, best sprint per neck drill</div></div></div>
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
        </div>
      </section>
    </main>
  );
}
