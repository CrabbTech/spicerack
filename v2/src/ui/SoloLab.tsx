// The Solo Lab: the scale panel, grown up. The diagram re-colors itself for
// whichever chord is sounding (or selected), exercises switch most of it off
// so there is something concrete to do, and a demo lick shows each exercise
// played — with a cursor walking the diagram note by note.

import { useState } from 'react';
import { PitchClass, mod12, noteLabel, notePc, simplify } from '../theory/notes';
import { Key, SCALES } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { RealizedSlot } from '../theory/progression';
import { chordSymbol } from '../theory/chords';
import { LENSES, LensId, simpleInterval } from '../theory/solo';
import { cagedForm, cagedText, gripInPosition } from '../guitar/caged';
import { ScaleRec } from '../data/genres';
import { OPEN_MIDI, OPEN_PC } from '../guitar/shapes';
import { MAX_FRET, boxWindow, scaleFretboard } from '../guitar/voicing';
import { BASS_MAX_FRET, BASS_OPEN_MIDI, BASS_OPEN_PC, BASS_STRING_NAMES } from '../bass/bass';
import { OP1_BASE_MIDI, OP1_KEY_COUNT, op1RangeLabel } from '../op1/op1';
import { PIANO_BASE_MIDI, PIANO_KEY_COUNT, pianoRangeLabel } from '../piano/piano';
import { InstrumentId } from '../audio/engine';
import { FretboardScale } from './Fretboard';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { PianoKeyboard } from './PianoKeyboard';
import { NotePaint, ROLE_LEGEND } from './paint';
import { qwertyLabel } from '../input/qwerty';
import { SoloModel } from './soloModel';

export interface SoloLabProps {
  instrument: InstrumentId;
  octaveShift: number;
  musicKey: Key;
  recs: ScaleRec[];
  scaleIdx: number;
  why?: string;
  solo?: SoloModel;
  realized: RealizedSlot[];
  /** slot the map is following: the one sounding, else the one selected */
  focusIdx: number | null;
  playing: boolean;
  lens: LensId;
  demoOn: boolean;
  both: boolean;
  /** jam view: big now/next readout, less reading */
  jam: boolean;
  /** note the demo lick is sounding right now */
  leadMidi: number | null;
  tips: string[];
  copied: boolean;
  onScale: (idx: number) => void;
  onFocus: (idx: number | null) => void;
  onLens: (lens: LensId) => void;
  onDemo: () => void;
  onReroll: () => void;
  onBoth: () => void;
  onHearScale: () => void;
  onCopyTab?: () => void;
  /** `string` is set when the note was clicked on a fretboard */
  onNote: (midi: number, instrument: InstrumentId, string?: number) => void;
  /** connected neck positions (string instruments): labels, which one is up, and how to move */
  positions?: { label: string }[];
  position?: number;
  onPosition?: (index: number) => void;
  /** notes being played right now through the mic / MIDI / keyboard */
  heldMidis?: number[];
  /** dots read as letters, or as numbers against the chord in focus (R ♭3 5…) — the guitarist's grammar */
  labelMode?: 'names' | 'numbers';
  onLabelMode?: (mode: 'names' | 'numbers') => void;
  /** base midi of the computer-keyboard piano, when it is the input — keys get their key-cap letters */
  qwertyBase?: number;
  /** just the follow strip, the lesson line and the diagram — for the Write bench */
  compact?: boolean;
  /** mirror the neck for left-handed players */
  lefty?: boolean;
  onLefty?: () => void;
}

/** The second diagram in "both" view: keys for string players, strings for the OP-1. */
const partnerOf = (instrument: InstrumentId): InstrumentId => (instrument === 'op1' ? 'guitar' : 'op1');

export function SoloLab(p: SoloLabProps) {
  const [pinnedPc, setPinnedPc] = useState<PitchClass | null>(null);
  const { solo } = p;
  const focusMap = solo && p.focusIdx !== null ? solo.maps[p.focusIdx] : undefined;
  const view = solo && p.focusIdx !== null ? solo.views[p.focusIdx] : undefined;
  const lens = LENSES.find((l) => l.id === p.lens) ?? LENSES[0];

  const numbers = p.labelMode === 'numbers';
  const paintOf = (pc: PitchClass): NotePaint | undefined => {
    if (!solo) return undefined;
    if (!focusMap || !view) {
      const name = solo.labelOf(pc);
      // with no chord in focus, numbers count from the scale's own root
      const label = numbers && name ? simpleInterval(pc - solo.rootPc, solo.def.id === 'lydian') : name;
      return label ? { label, role: 'plain', isRoot: pc === solo.rootPc } : undefined;
    }
    const n = focusMap.byPc.get(pc);
    if (!n) {
      // the next chord's landing note may belong to neither this chord nor the scale — show where it is anyway
      const land = focusMap.landing;
      if (!land || land.pc !== pc) return undefined;
      return { label: numbers ? simpleInterval(pc - notePc(focusMap.chord.root)) : land.label, role: 'ghost', isRoot: false, landing: true };
    }
    return {
      label: numbers ? (n.interval === '1' ? 'R' : n.interval) : n.label, role: n.role, isRoot: n.role === 'root', outside: !n.inScale,
      off: !view.lit.has(pc),
      target: view.targets.size < view.lit.size && view.targets.has(pc),
      landing: focusMap.landing?.pc === pc,
    };
  };

  const shownPcs = focusMap
    ? [...focusMap.notes.map((n) => n.pc), ...(focusMap.landing && !focusMap.byPc.has(focusMap.landing.pc) ? [focusMap.landing.pc] : [])]
    : solo?.pcs ?? [];

  const hit = (midi: number, instrument: InstrumentId, string?: number) => {
    p.onNote(midi, instrument, string);
    setPinnedPc((prev) => (prev === mod12(midi) ? null : mod12(midi)));
  };

  const diagram = (instrument: InstrumentId, primary: boolean) => {
    if (!solo) return null;
    if (instrument === 'guitar' || instrument === 'bass') {
      const bass = instrument === 'bass';
      const openPc = bass ? BASS_OPEN_PC : OPEN_PC;
      const openMidi = bass ? BASS_OPEN_MIDI : OPEN_MIDI;
      const maxFret = bass ? BASS_MAX_FRET : MAX_FRET;
      const w = (primary ? solo.window : undefined) ?? boxWindow(solo.rootPc, openPc);
      const notes = scaleFretboard(solo.rootPc, shownPcs, maxFret, openPc);
      const box = new Set(notes.filter((n) => n.fret >= w.lo && n.fret <= w.hi).map((n) => `${n.string}:${n.fret}`));
      // a partner diagram may not own the exact pitch — fall back to the same note name inside the box
      let cursor = p.leadMidi;
      if (cursor !== null && !primary) {
        const exact = notes.some((n) => box.has(`${n.string}:${n.fret}`) && openMidi[n.string] + n.fret === cursor);
        if (!exact) {
          const twin = notes.find((n) => box.has(`${n.string}:${n.fret}`) && n.pc === mod12(cursor!));
          cursor = twin ? openMidi[twin.string] + twin.fret : null;
        }
      }
      // the grip the player already owns, inside this box — guitar only, and only on the main diagram
      const known = primary && instrument === 'guitar' && focusMap ? gripInPosition(focusMap.chord, w) : undefined;
      return (
        <FretboardScale notes={notes} box={box} paintOf={paintOf} grip={known?.tones} openMidi={openMidi} cursorMidi={cursor}
          pinnedPc={pinnedPc} onNote={(m, string) => hit(m, instrument, primary ? string : undefined)} heldMidis={p.heldMidis} lefty={p.lefty}
          names={bass ? BASS_STRING_NAMES : undefined} maxFret={maxFret} />
      );
    }
    const piano = instrument === 'piano';
    const base = (piano ? PIANO_BASE_MIDI : OP1_BASE_MIDI) + 12 * p.octaveShift;
    const count = piano ? PIANO_KEY_COUNT : OP1_KEY_COUNT;
    const lit = new Map<number, LitKey>();
    const pinned = new Set<number>();
    for (let i = 0; i < count; i++) {
      const pc = mod12(base + i);
      const paint = paintOf(pc);
      if (paint) lit.set(i, { label: paint.label, isRoot: paint.isRoot, paint });
      if (pc === pinnedPc) pinned.add(i);
    }
    let cursor: number | null = null;
    if (p.leadMidi !== null) {
      const exact = p.leadMidi - base;
      cursor = exact >= 0 && exact < count ? exact
        : Array.from({ length: count }, (_, i) => i).find((i) => mod12(base + i) === mod12(p.leadMidi!)) ?? null;
    }
    // what's being played shows up on its own key when it fits, else on the same note name
    const held = new Set<number>();
    for (const m of p.heldMidis ?? []) {
      const exact = m - base;
      if (exact >= 0 && exact < count) held.add(exact);
      else for (let i = 0; i < count; i++) if (mod12(base + i) === mod12(m)) { held.add(i); break; }
    }
    const caps = new Map<number, string>();
    if (p.qwertyBase !== undefined && primary) {
      for (let i = 0; i < count; i++) {
        const cap = qwertyLabel(base + i, p.qwertyBase);
        if (cap) caps.set(i, cap);
      }
    }
    const Kb = piano ? PianoKeyboard : Op1Keyboard;
    return <Kb lit={lit} large cursor={cursor} pinned={pinned} held={held} caps={caps} onKey={(i) => hit(base + i, instrument)} />;
  };

  const pinned = pinnedPc === null ? undefined : focusMap?.byPc.get(pinnedPc);
  const pinnedPlain = pinnedPc !== null && !focusMap ? solo?.labelOf(pinnedPc) : undefined;
  const legendKinds = new Set<string>();
  if (focusMap) {
    for (const n of focusMap.notes) legendKinds.add(n.inScale ? n.role : 'outside');
  }

  return (
    <section className="panel scale-panel">
      <div className="panel-head">
        <div>
          <h2>{p.compact ? 'On the instrument' : 'Solo lab'}</h2>
          <div className="panel-sub">{p.compact ? 'where the melody lives under your fingers — it follows playback' : 'what to play over this progression — and when'}</div>
        </div>
        <div className="panel-actions">
          <button className={`btn ${p.demoOn ? 'btn-on' : ''}`} onClick={p.onDemo} disabled={!solo}
            title="play the loop with a demo lick for this exercise (l)">
            {p.demoOn ? '■ Demo lick' : '▶ Demo lick'}
          </button>
          {p.demoOn && <button className="btn" onClick={p.onReroll} title="a different lick, same rules">🎲</button>}
          <button className="btn" onClick={p.onHearScale} disabled={!solo}>▶ Hear scale</button>
          {p.onLabelMode && (
            <div className="seg" title="what the dots say: note names, or numbers counted from the chord that's sounding (R, ♭3, 5…) — the same fret changes number as the chords change, and that is the lesson">
              <button className={!numbers ? 'seg-on' : ''} onClick={() => p.onLabelMode!('names')}>ABC</button>
              <button className={numbers ? 'seg-on' : ''} onClick={() => p.onLabelMode!('numbers')}>123</button>
            </div>
          )}
          <button className={`btn ${p.both ? 'btn-on' : ''}`} onClick={p.onBoth}
            title="show the same notes on strings and keys at once">
            🎸+🎹 Both
          </button>
          {p.onCopyTab && solo && <button className="btn" onClick={p.onCopyTab}>{p.copied ? '✓ Copied' : '📋 Copy tab'}</button>}
        </div>
      </div>

      {!p.compact && <div className="scale-chips">
        {p.recs.map((r, i) => (
          <button key={`${r.scale}:${r.root}`} className={`chip ${i === p.scaleIdx ? 'chip-on' : ''}`} onClick={() => p.onScale(i)}>
            {noteLabel(simplify(resolveNumeral(r.root, p.musicKey).root))} {SCALES[r.scale].name}
          </button>
        ))}
      </div>}

      {solo && (
        <>
          {!p.compact && <div className="scale-why">
            <strong>{solo.name}</strong> <span className="scale-formula">({solo.def.formula})</span>
            <span className="scale-notes"> · {solo.noteNames.join(' ')}</span>
            {p.why && <p>{p.why}</p>}
          </div>}

          {!p.compact && <div className="lens-row">
            <span className="control-label">DRILL</span>
            {LENSES.map((l) => (
              <button key={l.id} className={`chip lens-chip ${l.id === p.lens ? 'chip-on' : ''}`} onClick={() => p.onLens(l.id)} title={l.goal}>
                {l.level > 0 && <span className="lens-level">{l.level}</span>}{l.icon} {l.name}
              </button>
            ))}
          </div>}
          {!p.compact && lens.level > 0 && <div className="lens-goal"><strong>{lens.icon} {lens.name}.</strong> {lens.goal}</div>}

          <div className="follow-row">
            <span className="control-label">{p.playing ? 'NOW' : 'OVER'}</span>
            {p.realized.map((r, i) => (
              <button key={r.slot.id} className={`chip follow-chip numeral-${r.chord.func} ${i === p.focusIdx ? 'follow-on' : ''}`}
                onClick={() => p.onFocus(i === p.focusIdx && !p.playing ? null : i)}>
                {chordSymbol(r.chord)}
              </button>
            ))}
            {!p.playing && p.focusIdx !== null && (
              <button className="chip" onClick={() => p.onFocus(null)} title="back to the plain scale">whole loop</button>
            )}
          </div>

          {p.jam && focusMap && (
            <div className="jam-now">
              <div className="jam-cell">
                <span className="jam-label">{p.playing ? 'NOW' : 'OVER'}</span>
                <span className={`jam-chord numeral-${focusMap.chord.func}`}>{chordSymbol(focusMap.chord)}</span>
              </div>
              {focusMap.next && (
                <div className="jam-cell jam-cell-next">
                  <span className="jam-label">NEXT</span>
                  <span className="jam-chord">{chordSymbol(focusMap.next)}</span>
                </div>
              )}
              {focusMap.landing && (
                <div className="jam-cell jam-cell-next">
                  <span className="jam-label">LAND ON</span>
                  <span className="jam-chord jam-land">{focusMap.landing.label}</span>
                </div>
              )}
            </div>
          )}

          {focusMap ? (
            <div className="solo-now">
              <div className="solo-headline">{focusMap.headline}</div>
              {focusMap.landing && <div className="solo-landing">↪ {focusMap.landing.text}</div>}
            </div>
          ) : (
            <div className="solo-now solo-now-idle">
              Press play — or pick a chord above — and the map re-colors itself for that chord: where home is, what rubs, and where to land next.
            </div>
          )}

          {p.positions && p.positions.length > 1 && p.onPosition && (
            <div className="position-row">
              <span className="control-label">NECK</span>
              {p.positions.map((pos, i) => (
                <button key={i} className={`chip ${i === (p.position ?? 0) ? 'chip-on' : ''}`} onClick={() => p.onPosition!(i)}
                  title={i === 0 ? 'the home box, on the low-string root' : 'the next connected position up the neck'}>
                  {i === 0 ? '⌂ ' : ''}{pos.label}
                </button>
              ))}
              <span className="practice-hint">five boxes, one neck — the demo lick and drills follow the box you pick</span>
              {p.onLefty && <button className={`chip ${p.lefty ? 'chip-on' : ''}`} onClick={p.onLefty} title="mirror the neck: nut on the right">🫲 Lefty</button>}
            </div>
          )}

          {p.instrument === 'guitar' && focusMap && solo.window && (
            <div className="caged-line">
              🖐 {cagedText(focusMap.chord, cagedForm(notePc(focusMap.chord.root), solo.window), gripInPosition(focusMap.chord, solo.window))}
            </div>
          )}

          <div className="scale-diagram">
            {diagram(p.instrument, true)}
            {p.both && <div className="scale-partner">{diagram(partnerOf(p.instrument), false)}</div>}
          </div>

          {focusMap ? (
            <div className="solo-legend">
              {ROLE_LEGEND.filter((r) => legendKinds.has(r.kind)).map((r) => (
                <span key={r.kind} className="legend-item" title={r.what}><i className={`legend-dot legend-${r.kind}`} />{r.name}</span>
              ))}
              {view && view.targets.size < view.lit.size && <span className="legend-item" title="be here when the chord arrives"><i className="legend-dot legend-target" />land here</span>}
              {focusMap.landing && <span className="legend-item" title="the next chord's 3rd — start heading for it"><i className="legend-dot legend-landing" />next landing</span>}
              <span className="legend-hint">click any note to hear it</span>
            </div>
          ) : (
            <div className="scale-hint">
              {(p.instrument === 'guitar' || p.instrument === 'bass') && 'solid dots = position box around the low-E root · faint dots = the rest of the neck'}
              {p.instrument === 'piano' && `lit keys = the scale across two octaves (${pianoRangeLabel(p.octaveShift)}) · ring = root`}
              {p.instrument === 'op1' && `lit keys = the scale across both octaves (${op1RangeLabel(p.octaveShift)}) · orange ring = root`}
              {' · click any note to hear it'}
            </div>
          )}

          {(pinned || pinnedPlain) && (
            <div className="solo-pinned">
              📍 {pinned
                ? <><strong>{pinned.label}</strong> is the {pinned.interval === '1' ? 'root' : pinned.interval} of {chordSymbol(focusMap!.chord)} — {ROLE_LEGEND.find((r) => r.kind === (pinned.inScale ? pinned.role : 'outside'))?.what}.</>
                : <><strong>{pinnedPlain}</strong> — every copy of it is ringed. Pick a chord to see what it means there.</>}
            </div>
          )}

          {!p.compact && p.tips.length > 0 && (
            <div className="solo-tips">
              {p.tips.map((t, i) => <div key={i} className="solo-tip">💡 {t}</div>)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
