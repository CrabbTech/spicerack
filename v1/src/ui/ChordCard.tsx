// One chord in the progression: numeral, symbol, diagram, voicing controls
// and per-chord spice actions.

import { RealizedSlot } from '../theory/progression';
import { chordToneLabels, chordTones } from '../theory/chords';
import { prettyNumeral } from '../theory/roman';
import { SpiceApplication } from '../theory/spices';
import { GuitarVoicing } from '../guitar/voicing';
import { Op1Voicing, midiToKeyIndex } from '../op1/op1';
import { FretboardChord } from './Fretboard';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { noteLabel, notePc, simplify } from '../theory/notes';

export interface ChordCardProps {
  realized: RealizedSlot;
  symbol: string;
  instrument: 'guitar' | 'op1';
  guitarVoicing?: GuitarVoicing;
  guitarVoicingCount: number;
  op1Voicing?: Op1Voicing;
  isActive: boolean;
  apps: SpiceApplication[];
  canRemove: boolean;
  onStrum: () => void;
  onCycleVoicing: (dir: 1 | -1) => void;
  onApply: (app: SpiceApplication) => void;
  onRemove: () => void;
}

const FUNC_LABEL: Record<string, string> = {
  tonic: 'tonic', subdominant: 'subdom', dominant: 'dominant',
  borrowed: 'borrowed', secondary: 'secondary',
};

export function ChordCard(p: ChordCardProps) {
  const { chord } = p.realized;
  const slot = p.realized.slot;
  const op1Lit = new Map<number, LitKey>();
  if (p.instrument === 'op1' && p.op1Voicing) {
    const labelByPc = new Map<number, string>();
    chordTones(chord).forEach((n) => labelByPc.set(notePc(n), noteLabel(simplify(n))));
    const rootPc = notePc(chord.root);
    for (const m of p.op1Voicing.midis) {
      const pc = ((m % 12) + 12) % 12;
      op1Lit.set(midiToKeyIndex(m), { label: labelByPc.get(pc) ?? '', isRoot: pc === rootPc });
    }
  }

  return (
    <div className={`card func-${chord.func}${p.isActive ? ' card-active' : ''}${slot.spiceId ? ' card-spiced' : ''}`}
      onClick={p.onStrum} role="button" tabIndex={0}>
      <div className="card-head">
        <span className={`numeral numeral-${chord.func}`}>{prettyNumeral(slot.numeral)}</span>
        <span className="func-tag">{FUNC_LABEL[chord.func]}</span>
        {slot.bars > 1 && <span className="bars-tag">×{slot.bars}</span>}
        {slot.spiceId && <span className="spice-tag" title="added by spice">🌶</span>}
      </div>
      <div className="card-symbol">{p.symbol}</div>
      <div className="card-tones">{chordToneLabels(chord).join(' · ')}</div>
      {slot.annotation && <div className="card-note">{slot.annotation}</div>}
      <div className="card-diagram">
        {p.instrument === 'guitar' && p.guitarVoicing && <FretboardChord voicing={p.guitarVoicing} />}
        {p.instrument === 'op1' && p.op1Voicing && <Op1Keyboard lit={op1Lit} compact />}
      </div>
      {p.instrument === 'guitar' && p.guitarVoicing && (
        <div className="card-voicing" onClick={(e) => e.stopPropagation()}>
          <button className="mini" onClick={() => p.onCycleVoicing(-1)} disabled={p.guitarVoicingCount < 2} title="previous voicing">‹</button>
          <span>{p.guitarVoicing.label}</span>
          <button className="mini" onClick={() => p.onCycleVoicing(1)} disabled={p.guitarVoicingCount < 2} title="next voicing">›</button>
        </div>
      )}
      {p.instrument === 'op1' && p.op1Voicing && (
        <div className="card-voicing">
          <span>
            {p.op1Voicing.label}
            {p.op1Voicing.omitted.length > 0 && ` · no ${p.op1Voicing.omitted.map((d) => `${d}th`).join('/')}`}
          </span>
        </div>
      )}
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        {p.apps.map((app) => (
          <button key={app.spiceId + app.label} className="chip chip-action" title={`${app.spiceName}: ${app.label}`}
            onClick={() => p.onApply(app)}>
            {appIcon(app)}
          </button>
        ))}
        {p.canRemove && (
          <button className="chip chip-remove" title="remove chord" onClick={p.onRemove}>×</button>
        )}
      </div>
    </div>
  );
}

function appIcon(app: SpiceApplication): string {
  const icons: Record<string, string> = {
    'secondary-dominant': '🎯', 'tritone-sub': '🃏', 'half-step-slide': '🛝',
    'sus-tension': '⏳', 'passing-dim': '🪜', 'borrowed-iv': '🌧',
    'flat-seven': '🍺', 'mario': '🍄', 'picardy': '🌅', 'andalusian': '💃',
    'backdoor': '🚪', 'line-cliche': '🕵️', 'phrygian-bite': '🦈',
    'tritone-riff': '😈', 'harmonic-minor-v': '🧛',
  };
  return icons[app.spiceId] ?? '🌶';
}
