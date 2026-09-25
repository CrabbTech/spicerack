// The lesson that's in progress, pinned above whichever workspace it sent you to.

import { useApp } from '../state/AppContext';
import { PATHS } from '../data/lessons';

export function LessonBanner() {
  const { lesson, lessonDone, completeLesson, startLesson, setLessonId, dispatch, grade, lens, lastSprint, crabReport, burrow } = useApp();
  if (!lesson) return null;
  const path = PATHS.find((p) => p.steps.some((s) => s.id === lesson.id))!;
  const at = path.steps.findIndex((s) => s.id === lesson.id);
  const next = path.steps[at + 1];
  const done = lessonDone(lesson.id);
  const goal = lesson.goal;
  return (
    <div className={`lesson-banner ${done ? 'lesson-done' : ''}`}>
      <div className="lesson-main">
        <div className="lesson-kicker">{path.name} · step {at + 1} of {path.steps.length}</div>
        <div className="lesson-title">{lesson.title}{done && <span className="lesson-done-tag">done</span>}</div>
        <div className="lesson-teach">{lesson.teach}</div>
        <div className="lesson-task">{lesson.task}</div>
      </div>
      <div className="lesson-side">
        {goal.kind === 'score' && (
          <div className="lesson-goal">
            pass mark <strong>{goal.min}</strong>
            {grade && lens === goal.lens && <> · last pass <strong>{grade.score}</strong></>}
          </div>
        )}
        {goal.kind === 'fret' && (
          <div className="lesson-goal">
            pass mark <strong>{goal.min}</strong>
            {lastSprint && lastSprint.kind === goal.drill && <> · last sprint <strong>{lastSprint.score}</strong></>}
          </div>
        )}
        {goal.kind === 'coach' && <div className="lesson-goal">done when every chord change lands</div>}
        {goal.kind === 'burrow' && <div className="lesson-goal">floor <strong>{burrow?.reached ?? 0}</strong> / {goal.depth}</div>}
        {goal.kind === 'crab' && (
          <div className="lesson-goal">
            crab score <strong>{crabReport?.score ?? '—'}</strong> / {goal.min}
            {crabReport && <> · overlap <strong>{Math.round(crabReport.together * 100)}%</strong> / 25</>}
          </div>
        )}
        <div className="panel-actions">
          {!done && <button className="btn" onClick={() => completeLesson(lesson.id)}>I did it</button>}
          {done && next && <button className="btn btn-spice" onClick={() => startLesson(next)}>Next: {next.title}</button>}
          <button className="btn" onClick={() => dispatch({ type: 'view', view: 'learn' })}>All lessons</button>
          <button className="btn" onClick={() => setLessonId(null)}>×</button>
        </div>
      </div>
    </div>
  );
}
