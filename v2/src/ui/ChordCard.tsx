// One chord in the progression: numeral, symbol, diagram, voicing controls
// and per-chord spice actions.

import { MouseEvent } from 'react';
import { RealizedSlot } from '../theory/progression';
import { Chord, chordToneLabels, chordTones } from '../theory/chords';
import { prettyNumeral } from '../theory/roman';
import { SpiceApplication } from '../theory/spices';
import { GuitarVoicing } from '../guitar/voicing';
import { Op1Voicing, OP1_KEY_COUNT, midiToKeyIndex } from '../op1/op1';
import { PIANO_KEY_COUNT, PianoVoicing, midiToPianoIndex } from '../piano/piano';
import { BassShape } from '../bass/bass';
import { InstrumentId } from '../audio/engine';
import { FretboardChord } from './Fretboard';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { PianoKeyboard } from './PianoKeyboard';
import { midiLabel, noteLabel, notePc, simplify } from '../theory/notes';

export interface ChordCardProps {
  realized: RealizedSlot;
  symbol: string;
  instrument: InstrumentId;
  guitarVoicing?: GuitarVoicing;
  guitarVoicingCount: number;
  op1Voicing?: Op1Voicing;
  pianoVoicing?: PianoVoicing;
  bassShape?: BassShape;
  isActive: boolean;
  /** the solo lab is pointed at this chord */
  isFocus?: boolean;
  /** when a practice loop is set: is this card inside it? */
  loopState?: 'in' | 'out';
  apps: SpiceApplication[];
  canRemove: boolean;
  onStrum: (e: MouseEvent) => void;
  onCycleVoicing: (dir: 1 | -1) => void;
  onCycleBars: () => void;
  onApply: (app: SpiceApplication) => void;
  onRemove: () => void;
}

const FUNC_LABEL: Record<string, string> = {
  tonic: 'tonic', subdominant: 'subdom', dominant: 'dominant',
  borrowed: 'borrowed', secondary: 'secondary',
};

/** Light up keyboard-window keys for a voicing, labelled with chord tones. */
function keysLit(chord: Chord, midis: number[], toIndex: (m: number) => number, keyCount: number): Map<number, LitKey> {
  const lit = new Map<number, LitKey>();
  const labelByPc = new Map<number, string>();
  chordTones(chord).forEach((n) => labelByPc.set(notePc(n), noteLabel(simplify(n))));
  const rootPc = notePc(chord.root);
  for (const m of midis) {
    const idx = toIndex(m);
    if (idx < 0 || idx >= keyCount) continue;
    const pc = ((m % 12) + 12) % 12;
    lit.set(idx, { label: labelByPc.get(pc) ?? '', isRoot: pc === rootPc });
  }
  return lit;
}

export function ChordCard(p: ChordCardProps) {
  const { chord } = p.realized;
  const slot = p.realized.slot;
  const op1Lit = p.instrument === 'op1' && p.op1Voicing
    ? keysLit(chord, p.op1Voicing.midis, midiToKeyIndex, OP1_KEY_COUNT)
    : new Map<number, LitKey>();
  const pianoLit = p.instrument === 'piano' && p.pianoVoicing
    ? keysLit(chord, p.pianoVoicing.midis, midiToPianoIndex, PIANO_KEY_COUNT)
    : new Map<number, LitKey>();

  return (
    <div className={`card func-${chord.func}${p.isActive ? ' card-active' : ''}${p.isFocus ? ' card-focus' : ''}${slot.spiceId ? ' card-spiced' : ''}${p.loopState ? ` card-loop-${p.loopState}` : ''}`}
      onClick={p.onStrum} role="button" tabIndex={0}>
      <div className="card-head">
        <span className={`numeral numeral-${chord.func}`}>{prettyNumeral(slot.numeral)}</span>
        <span className="func-tag">{FUNC_LABEL[chord.func]}</span>
        <button className="bars-tag" title="bars" onClick={(e) => { e.stopPropagation(); p.onCycleBars(); }}>
          ×{slot.bars === 0.5 ? '½' : slot.bars}
        </button>
        {slot.spiceId && <span className="spice-tag">spiced</span>}
        {p.loopState === 'in' && <span className="spice-tag">loop</span>}
      </div>
      <div className="card-symbol">{p.symbol}</div>
      <div className="card-tones">{chordToneLabels(chord).join(' · ')}</div>
      {slot.annotation && <div className="card-note">{slot.annotation}</div>}
      <div className="card-diagram">
        {p.instrument === 'guitar' && p.guitarVoicing && <FretboardChord voicing={p.guitarVoicing} />}
        {p.instrument === 'bass' && p.bassShape && <FretboardChord voicing={p.bassShape} />}
        {p.instrument === 'piano' && p.pianoVoicing && <PianoKeyboard lit={pianoLit} compact />}
        {p.instrument === 'op1' && p.op1Voicing && <Op1Keyboard lit={op1Lit} compact />}
      </div>
      {p.instrument === 'guitar' && p.guitarVoicing && (
        <div className="card-voicing" onClick={(e) => e.stopPropagation()}>
          <button className="mini" onClick={() => p.onCycleVoicing(-1)} disabled={p.guitarVoicingCount < 2}>‹</button>
          <span>{p.guitarVoicing.label}</span>
          <button className="mini" onClick={() => p.onCycleVoicing(1)} disabled={p.guitarVoicingCount < 2}>›</button>
        </div>
      )}
      {p.instrument === 'bass' && p.bassShape && (
        <div className="card-voicing"><span>R · 5 · 8 — {p.bassShape.label}</span></div>
      )}
      {p.instrument === 'piano' && p.pianoVoicing && (
        <div className="card-voicing">
          <span>
            {p.pianoVoicing.label} · LH {midiLabel(p.pianoVoicing.lhMidi)}
            {p.pianoVoicing.omitted.length > 0 && ` · no ${p.pianoVoicing.omitted.map((d) => `${d}th`).join('/')}`}
          </span>
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
          <button key={app.spiceId + app.label} className="chip chip-action" title={app.spiceName} onClick={() => p.onApply(app)}>
            {app.label}
          </button>
        ))}
        {p.canRemove && <button className="chip chip-remove" onClick={p.onRemove}>×</button>}
      </div>
    </div>
  );
}
