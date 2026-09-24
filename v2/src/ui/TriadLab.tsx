// The Triad Lab: every chord as three notes on three strings (or under one
// hand on the keys). The neck view shows all the shapes of the chord in focus
// climbing the neck, with the path's choice lit and the next chord's shape
// ghosted in — so the move between them is something you can see. The strip
// underneath is the whole path, with what each voice does at every change.

import { Fragment } from 'react';
import { useApp } from '../state/AppContext';
import { chordSymbol } from '../theory/chords';
import { mod12 } from '../theory/notes';
import { PATH_MODES, TriadVoicing, describeMove, inversionLabel, triadMoves } from '../theory/triads';
import { Fret } from '../guitar/shapes';
import { audio } from '../audio/engine';
import { FretboardChord } from './Fretboard';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { PianoKeyboard } from './PianoKeyboard';
import { TriadModel } from './triadModel';

const DEGREE_TAG: Record<number, string> = { 1: 'R', 2: '2', 3: '3', 4: '4', 5: '5', 7: '7' };
const degreeKind = (degree: number): string => (degree === 1 ? 'root' : degree === 5 ? 'fifth' : degree === 7 ? 'seventh' : 'third');

interface NeckProps {
  neck: NonNullable<TriadModel['neck']>;
  shapes: TriadVoicing[];
  chosen?: TriadVoicing;
  next?: TriadVoicing;
  pinned: boolean;
  lefty: boolean;
  cursorMidi: number | null;
  heldMidis: number[];
  onShape: (index: number) => void;
}

function TriadNeck({ neck, shapes, chosen, next, pinned, lefty, cursorMidi, heldMidis, onShape }: NeckProps) {
  const strings = neck.names.length;
  const set = neck.sets[neck.setIdx];
  const fw = 44;
  const openW = 30;
  const left = 22;
  const rowH = 24;
  const top = 30; // headroom for the inversion label above the top string set
  const width = left + openW + neck.maxFret * fw + 14;
  const height = top + (strings - 1) * rowH + 34;
  const flip = (x: number) => (lefty ? width - x : x);
  const xOf = (fret: number) => flip(fret === 0 ? left + openW / 2 : left + openW + (fret - 0.5) * fw);
  const yOf = (string: number) => top + (strings - 1 - string) * rowH;

  return (
    <svg className="fb-scale triad-neck" width="100%" style={{ maxWidth: width * 1.5 }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      {Array.from({ length: strings }, (_, s) => (
        <g key={s} className={set.includes(s) ? 'tn-string-on' : 'tn-string'}>
          <text x={flip(left - 10)} y={yOf(s) + 3.5} className="fb-string-name" textAnchor="middle">{neck.names[s]}</text>
          <line x1={flip(left + openW)} y1={yOf(s)} x2={flip(left + openW + neck.maxFret * fw)} y2={yOf(s)} />
        </g>
      ))}
      {Array.from({ length: neck.maxFret + 1 }, (_, f) => (
        <line key={f} x1={flip(left + openW + f * fw)} y1={top} x2={flip(left + openW + f * fw)} y2={top + (strings - 1) * rowH}
          stroke="currentColor" strokeWidth={f === 0 ? 3 : 1} opacity={f === 0 ? 0.7 : 0.18} />
      ))}
      {[3, 5, 7, 9, 12, 15].filter((f) => f <= neck.maxFret).map((f) => (
        <text key={f} x={xOf(f)} y={top + (strings - 1) * rowH + 20} className="fb-marker" textAnchor="middle">{f === 12 ? '12 ··' : f}</text>
      ))}

      {/* where the next chord will be: ghost rings, and an arrow along each string that has to move */}
      {next && chosen && next.frets!.map((f, i) => {
        const from = chosen.frets![i];
        const y = yOf(next.strings![i]);
        const held = from === f;
        return (
          <g key={`n${i}`} className="tn-next">
            {!held && <line x1={xOf(from) + (xOf(f) > xOf(from) ? 11 : -11)} y1={y} x2={xOf(f) + (xOf(f) > xOf(from) ? -13 : 13)} y2={y} markerEnd="url(#tn-arrow)" />}
            <circle cx={xOf(f)} cy={y} r={held ? 13 : 10.5} />
          </g>
        );
      })}
      <defs>
        <marker id="tn-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" className="tn-arrowhead" />
        </marker>
      </defs>

      {shapes.map((v, k) => {
        const on = v === chosen;
        const pts = v.frets!.map((f, i) => `${xOf(f)},${yOf(v.strings![i])}`).join(' ');
        const labelX = (xOf(Math.min(...v.frets!)) + xOf(Math.max(...v.frets!))) / 2;
        return (
          <g key={k} className={`tn-shape ${on ? 'tn-shape-on' : ''}`} onClick={() => onShape(k)}>
            <polyline points={pts} className="tn-link" />
            {v.frets!.map((f, i) => {
              const midi = v.midis[i];
              const cx = xOf(f);
              const cy = yOf(v.strings![i]);
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={9.5} className={`tn-dot tn-${degreeKind(v.tones[i].degree)}`} />
                  <text x={cx} y={cy + 3.2} textAnchor="middle" className={`tn-tag tn-tag-${degreeKind(v.tones[i].degree)}`}>{DEGREE_TAG[v.tones[i].degree] ?? v.tones[i].degree}</text>
                  {on && cursorMidi === midi && <circle cx={cx} cy={cy} r={13} className="fb-cursor" />}
                  {heldMidis.includes(midi) && <circle cx={cx} cy={cy} r={13} className="fb-held" />}
                </g>
              );
            })}
            {on && (
              <text x={labelX} y={yOf(set[2]) - 15} textAnchor="middle" className="tn-label">
                {pinned ? 'pinned · ' : ''}{['root pos', '1st inv', '2nd inv'][v.inversion]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** A triad as a little chord grid: the three fretted strings, everything else muted. */
function miniFrets(v: TriadVoicing, stringCount: number): Fret[] {
  const frets: Fret[] = Array.from({ length: stringCount }, () => 'x' as Fret);
  v.strings!.forEach((s, i) => { frets[s] = v.frets![i]; });
  return frets;
}

export function TriadLab() {
  const app = useApp();
  const {
    state, triads, liveRealized: realized, focusIdx, triadMode, setTriadMode, triadUpper, setTriadUpper, triadComp, setTriadComp,
    setTriadSet, triadPins, setTriadPins, demoOn, setDemoOn, leadMidi, held, lefty, setLefty, setFocusId,
  } = app;
  const at = focusIdx ?? 0;
  const n = realized.length;
  const nextAt = (at + 1) % n;
  const chosen = triads.chosen[at];
  const next = n > 1 ? triads.chosen[nextAt] : undefined;
  const spec = triads.specs[at];
  const unit = triads.neck ? 'fret' : 'key';
  const voiced = triads.keys?.piano ? 'piano' : state.instrument;
  const anyUpper = triads.specs.some((s) => s.source === 'upper');
  const pinCount = Object.keys(triadPins).length;

  const hear = (v: TriadVoicing) => audio.strum(v.midis, voiced === 'bass' ? 'guitar' : voiced, undefined, 0.9, 1.4);
  const pick = (slotIdx: number, k: number) => {
    const slotId = realized[slotIdx].slot.id;
    hear(triads.candidates[slotIdx][k]);
    setTriadPins((cur) => {
      const nextPins = { ...cur };
      if (cur[slotId] === k) delete nextPins[slotId];
      else nextPins[slotId] = k;
      return nextPins;
    });
  };

  const keyboard = () => {
    if (!triads.keys) return null;
    const { base, count, piano } = triads.keys;
    const lit = new Map<number, LitKey>();
    const heldKeys = new Set<number>();
    chosen?.midis.forEach((m, i) => {
      const tone = chosen.tones[i];
      lit.set(m - base, { label: tone.label, isRoot: tone.degree === 1, paint: { label: tone.label, role: tone.degree === 1 ? 'root' : 'chord', isRoot: tone.degree === 1 } });
    });
    next?.midis.forEach((m, i) => {
      const key = m - base;
      const cur = lit.get(key);
      if (cur?.paint) lit.set(key, { ...cur, paint: { ...cur.paint, landing: true } });
      else lit.set(key, { label: next.tones[i].label, isRoot: false, paint: { label: next.tones[i].label, role: 'ghost', isRoot: false, landing: true } });
    });
    for (const m of held) {
      const exact = m - base;
      if (exact >= 0 && exact < count) heldKeys.add(exact);
      else for (let i = 0; i < count; i++) if (mod12(base + i) === mod12(m)) { heldKeys.add(i); break; }
    }
    const cursor = leadMidi !== null && leadMidi - base >= 0 && leadMidi - base < count ? leadMidi - base : null;
    const Kb = piano ? PianoKeyboard : Op1Keyboard;
    return <Kb lit={lit} large cursor={cursor} held={heldKeys} onKey={(i) => audio.note(base + i, state.instrument)} />;
  };

  return (
    <section className="panel scale-panel triad-panel">
      <div className="panel-head">
        <div>
          <h2>Triad lab</h2>
        </div>
        <div className="panel-actions">
          <button className={`btn ${demoOn ? 'btn-on' : ''}`} onClick={() => { setDemoOn(!demoOn); if (!demoOn && !state.playing) app.startPlayback(); }}>
            {demoOn ? '■ Demo arpeggio' : '▶ Demo arpeggio'}
          </button>
          <button className={`btn ${triadComp ? 'btn-on' : ''}`} onClick={() => setTriadComp(!triadComp)}>Comp with these</button>
        </div>
      </div>

      <div className="triad-controls">
        {triads.neck && (
          <>
            <span className="control-label">Strings</span>
            {triads.neck.setNames.map((name, i) => (
              <button key={name} className={`chip ${i === triads.neck!.setIdx ? 'chip-on' : ''}`} onClick={() => setTriadSet(i)}>
                {name}
              </button>
            ))}
          </>
        )}
        <span className={`control-label ${triads.neck ? 'band-label' : ''}`}>Path</span>
        {PATH_MODES.map((m) => (
          <button key={m.id} className={`chip ${m.id === triadMode ? 'chip-on' : ''}`} title={m.blurb} onClick={() => setTriadMode(m.id)}>
            {m.name}
          </button>
        ))}
        <button className={`chip ${triadUpper ? 'chip-on' : ''}`} onClick={() => setTriadUpper(!triadUpper)}>
          3-5-7
        </button>
        {pinCount > 0 && <button className="chip" onClick={() => setTriadPins({})}>{pinCount} pinned ×</button>}
        {triads.neck && <button className={`chip ${lefty ? 'chip-on' : ''}`} onClick={() => setLefty(!lefty)}>Lefty</button>}
      </div>

      <div className="triad-stat">
        {triads.travel === 0 && triads.rootTravel === 0
          ? 'One chord, nothing to travel.'
          : triadMode === 'root'
            ? <>Root position everywhere: your hand travels <strong>{triads.rootTravel} {unit}s</strong> every time round. Now try <em>Stay close</em>.</>
            : <>This path travels <strong>{triads.travel} {unit}s</strong> per loop, all three voices added up — root position everywhere would travel <strong>{triads.rootTravel}</strong>.</>}
        {triadUpper && !anyUpper && ' (No seventh chords here, so 3-5-7 has nothing to find — try a jazzier genre or spice in some extensions.)'}
      </div>

      <div className="follow-row">
        <span className="control-label">{state.playing ? 'Now' : 'Over'}</span>
        {realized.map((r, i) => (
          <button key={r.slot.id} className={`chip follow-chip numeral-${r.chord.func} ${i === at ? 'follow-on' : ''}`} onClick={() => setFocusId(r.slot.id)}>
            {chordSymbol(r.chord)}
          </button>
        ))}
      </div>

      <div className="solo-now">
        {chosen ? (
          <>
            <div className="solo-headline">
              {chordSymbol(realized[at].chord)}
              {spec.source === 'upper' ? <> — play {/^[AEF]/.test(spec.name) ? 'an' : 'a'} <strong>{spec.name}</strong> triad: it is this chord's 3rd, 5th and 7th, and the bass supplies the root</> : null}
              {' · '}{chosen.tones.map((t) => t.label).join(' – ')} · {inversionLabel(chosen)}
            </div>
            {next && n > 1 && <div className="solo-landing">↪ to {chordSymbol(realized[nextAt].chord)}: {describeMove(chosen, next, unit)}</div>}
          </>
        ) : <div className="solo-headline">No comfortable shape for {chordSymbol(realized[at].chord)} on this string set — try another set.</div>}
      </div>

      <div className="scale-diagram">
        {triads.neck
          ? (
            <TriadNeck neck={triads.neck} shapes={triads.candidates[at]} chosen={chosen} next={next}
              pinned={triadPins[realized[at].slot.id] !== undefined} lefty={lefty} cursorMidi={demoOn ? leadMidi : null}
              heldMidis={held} onShape={(k) => pick(at, k)} />
          )
          : keyboard()}
      </div>
      <div className="solo-legend">
        <span className="legend-item"><i className="legend-dot legend-root" />root</span>
        <span className="legend-item"><i className="legend-dot legend-chord" />3rd</span>
        <span className="legend-item"><i className="legend-dot legend-fifth" />5th</span>
        {anyUpper && <span className="legend-item"><i className="legend-dot legend-outside" />7th</span>}
        <span className="legend-item"><i className="legend-dot legend-landing" />where the next chord is</span>
        <span className="legend-hint">{triads.neck ? 'click a shape to pin it' : 'dashed keys: the next chord'}</span>
      </div>

      <div className="triad-strip">
        {realized.map((r, i) => {
          const v = triads.chosen[i];
          const to = triads.chosen[(i + 1) % n];
          return (
            <Fragment key={r.slot.id}>
              <button className={`triad-card ${i === at ? 'triad-card-on' : ''}`} onClick={() => { setFocusId(r.slot.id); if (v) hear(v); }}>
                <span className={`triad-symbol numeral-${r.chord.func}`}>{chordSymbol(r.chord)}</span>
                {triads.specs[i].source === 'upper' && <span className="triad-upper">play {triads.specs[i].name}</span>}
                {v && triads.neck && <FretboardChord voicing={{ frets: miniFrets(v, triads.neck.names.length) }} rootIndex={v.strings![v.tones.findIndex((t) => t.degree === 1)]} />}
                {v && !triads.neck && <span className="triad-notes">{v.tones.map((t) => t.label).join(' ')}</span>}
                <span className="triad-inv">{v ? ['root pos', '1st inv', '2nd inv'][v.inversion] : 'no shape'}{triadPins[r.slot.id] !== undefined ? ' · pinned' : ''}</span>
              </button>
              {n > 1 && v && to && (
                <span className="triad-moves" title={describeMove(v, to, unit)}>
                  {[...triadMoves(v, to)].reverse().map((m) => (
                    <i key={m.voice} className={m.semitones === 0 ? 'tm-hold' : Math.abs(m.semitones) <= 2 ? 'tm-step' : 'tm-leap'}>
                      {m.semitones === 0 ? '=' : `${m.semitones > 0 ? '↑' : '↓'}${Math.abs(m.semitones)}`}
                    </i>
                  ))}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
