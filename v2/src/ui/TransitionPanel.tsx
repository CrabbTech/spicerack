// The gap between two chord cards, opened up: which voices hold, which slide,
// what the bass does and what the move means — with a demo that plays the
// change one voice at a time.

import { mod12 } from '../theory/notes';
import { TransitionInsight, VoiceMove } from '../theory/transitions';
import { SeqStep } from '../audio/engine';

export interface TransitionDemo {
  steps: SeqStep[];
  /** which move (index into insight.moves) each step belongs to; 'from'/'to' = the full chords */
  tags: (number | 'from' | 'to')[];
}

/** Chord, then each moving voice on its own (from → to), then the arrival chord. */
export function buildTransitionDemo(insight: TransitionInsight, fromMidis: number[], toMidis: number[]): TransitionDemo {
  const steps: SeqStep[] = [{ at: 0, midis: fromMidis, dur: 1.0, vel: 0.8 }];
  const tags: TransitionDemo['tags'] = ['from'];
  let at = 1.25;
  insight.moves.forEach((m, i) => {
    if (m.kind === 'hold') return;
    const from = 57 + mod12(m.fromPc - 9); // A3..G♯4 — every voice near middle C
    steps.push({ at, midis: [from], dur: 0.45, vel: 0.9 });
    steps.push({ at: at + 0.45, midis: [from + m.semitones], dur: 0.7, vel: 0.95 });
    tags.push(i, i);
    at += 1.35;
  });
  steps.push({ at, midis: toMidis, dur: 1.8, vel: 0.85 });
  tags.push('to');
  return { steps, tags };
}

export interface TransitionPanelProps {
  insight: TransitionInsight;
  /** tag of the demo step sounding right now */
  activeTag: number | 'from' | 'to' | null;
  looping: boolean;
  onHear: () => void;
  onLoop: () => void;
  onClose: () => void;
}

const W = 264;
const H = 176;
const PAD = 16;
const yOf = (semis: number): number => H - PAD - ((semis + 2) / 16) * (H - PAD * 2);

function VoiceDiagram({ insight, activeTag }: { insight: TransitionInsight; activeTag: TransitionPanelProps['activeTag'] }) {
  const rootPc = insight.fromTones[0]?.pc ?? 0;
  const fromY = new Map(insight.fromTones.map((t) => [t.pc, yOf(mod12(t.pc - rootPc))] as const));
  // an arriving note sits where its voice came from, so a half step LOOKS like a half step
  const toY = new Map<number, number>();
  for (const m of insight.moves) {
    if (!toY.has(m.toPc)) toY.set(m.toPc, yOf(mod12(m.fromPc - rootPc) + m.semitones));
  }
  for (const t of insight.toTones) {
    if (!toY.has(t.pc)) toY.set(t.pc, yOf(mod12(t.pc - rootPc)));
  }
  const x1 = 58;
  const x2 = W - 58;
  const cls = (m: VoiceMove, i: number) => `vl-line vl-${m.kind}${activeTag === i ? ' vl-active' : ''}`;
  return (
    <svg className="vl" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {insight.moves.map((m, i) => (
        <line key={i} x1={x1 + 12} y1={fromY.get(m.fromPc)} x2={x2 - 12} y2={toY.get(m.toPc)} className={cls(m, i)} />
      ))}
      {insight.fromTones.map((t) => (
        <g key={`f${t.pc}`} className={activeTag === 'from' ? 'vl-node vl-node-active' : 'vl-node'}>
          <circle cx={x1} cy={fromY.get(t.pc)} r={10} />
          <text x={x1} y={(fromY.get(t.pc) ?? 0) + 3.5} textAnchor="middle">{t.label}</text>
        </g>
      ))}
      {insight.toTones.map((t) => (
        <g key={`t${t.pc}`} className={activeTag === 'to' ? 'vl-node vl-node-active' : 'vl-node'}>
          <circle cx={x2} cy={toY.get(t.pc)} r={10} />
          <text x={x2} y={(toY.get(t.pc) ?? 0) + 3.5} textAnchor="middle">{t.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function TransitionPanel({ insight, activeTag, looping, onHear, onLoop, onClose }: TransitionPanelProps) {
  const halves = insight.moves.filter((m) => m.kind === 'half');
  const wholes = insight.moves.filter((m) => m.kind === 'whole');
  const holds = insight.moves.filter((m) => m.kind === 'hold');
  const arrow = (m: VoiceMove) => `${m.from} ${m.semitones > 0 ? '↗' : '↘'} ${m.to}`;
  return (
    <div className="xfer-panel">
      <div className="xfer-head">
        <h3>{insight.title}</h3>
        <div className="panel-actions">
          <button className="btn" onClick={onHear} title="the chord, each moving voice alone, then the arrival">▶ Hear the move</button>
          <button className={`btn ${looping ? 'btn-on' : ''}`} onClick={onLoop} title="loop just these two chords to practise the change">
            {looping ? '🔁 Looping this change' : '🔁 Loop this change'}
          </button>
          <button className="btn" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="xfer-body">
        <VoiceDiagram insight={insight} activeTag={activeTag} />
        <div className="xfer-text">
          <p>{insight.story}</p>
          <div className="xfer-moves">
            {halves.length > 0 && <span className="xfer-tag xfer-half" title="half steps: the strongest pull">½ step · {halves.map(arrow).join(' · ')}</span>}
            {wholes.length > 0 && <span className="xfer-tag xfer-whole">whole step · {wholes.map(arrow).join(' · ')}</span>}
            {holds.length > 0 && <span className="xfer-tag xfer-hold" title="common tones: the glue">holds · {holds.map((m) => m.from).join(' · ')}</span>}
          </div>
          <p className="xfer-bass">{insight.bass}</p>
          <p className="xfer-try">🎯 {insight.tryThis}</p>
        </div>
      </div>
    </div>
  );
}
