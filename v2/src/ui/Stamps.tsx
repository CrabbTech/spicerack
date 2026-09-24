// The month, as a stamp card: every day with practice in it gets the crab,
// pressed in vermilion — each one sits a little differently, the way stamps
// do. Today is ringed; the streak is the run of stamps ending here.

import { Progress } from '../practice/progress';
import { dayKeyOf, monthGrid, monthName } from '../state/dates';
import { PixelCrab } from './PixelCrab';

/** A small, stable tilt per day, so a wall of stamps never looks printed. */
const tilt = (day: string): number => {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 13) - 6;
};

export function Stamps({ progress, today = new Date() }: { progress: Progress; today?: Date }) {
  const cells = monthGrid(today.getFullYear(), today.getMonth());
  const done = new Set(progress.days);
  const todayKey = dayKeyOf(today);
  const thisMonth = progress.days.filter((d) => d.startsWith(todayKey.slice(0, 7))).length;
  return (
    <div className="stamps">
      <div className="stamps-head">
        <span className="stamps-month">{monthName(today.getFullYear(), today.getMonth())}</span>
        <span className="stamps-count">{thisMonth} day{thisMonth === 1 ? '' : 's'} stamped</span>
      </div>
      <div className="stamps-grid" role="grid" aria-label="practice days this month">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="stamps-dow">{d}</span>)}
        {cells.map((day, i) => (
          day === null
            ? <span key={i} className="stamp-cell stamp-blank" />
            : (
              <span key={day} className={`stamp-cell ${day === todayKey ? 'stamp-today' : ''} ${done.has(day) ? 'stamp-done' : ''}`} title={day}>
                <span className="stamp-num">{Number(day.slice(-2))}</span>
                {done.has(day) && (
                  <span className={`stamp ${day === todayKey ? 'stamp-fresh' : ''}`} style={{ transform: `rotate(${tilt(day)}deg)` }}>
                    <PixelCrab size={18} className="px-crab-stamp" title="practised" />
                  </span>
                )}
              </span>
            )
        ))}
      </div>
    </div>
  );
}
