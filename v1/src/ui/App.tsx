import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  midiLabel, mod12, noteLabel, notePc, simplify, spellPcSimple,
} from '../theory/notes';
import {
  Key, MODE_NAMES, ModeId, SCALES, TONIC_CHOICES, flatLeaning, scalePcs, spellScale,
} from '../theory/scales';
import { Chord, QUALITIES, chordSymbol } from '../theory/chords';
import { prettyNumeral, resolveNumeral } from '../theory/roman';
import {
  RealizedSlot, Slot, borrowShelf, diatonicPalette, keyLabel, newSlot, realizeSlot,
} from '../theory/progression';
import {
  SPICES, SpiceApplication, SpiceContext, SpiceId, findAllApplications, pickRandomApplication,
} from '../theory/spices';
import { GENRES, GENRE_LIST, Genre, GenreId, pickTemplate, scaleRecsFor } from '../data/genres';
import {
  GuitarVoicing, chooseVoicingIndices, chordTabText, chordVoicings,
  scaleBox, scaleFretboard, scaleTabText,
} from '../guitar/voicing';
import { Op1Voicing, op1ChordVoicing, op1RangeLabel, op1ScaleKeys } from '../op1/op1';
import { InstrumentId, audio } from '../audio/engine';
import { ChordCard } from './ChordCard';
import { FretboardScale } from './Fretboard';
import { LitKey, Op1Keyboard } from './Op1Keyboard';

// --- state -----------------------------------------------------------------

interface LogEntry {
  id: number;
  icon: string;
  title: string;
  text: string;
  kind: 'spice' | 'info';
}

interface AppState {
  tonicIdx: number;
  genreId: GenreId;
  mode: ModeId;
  instrument: InstrumentId;
  octaveShift: number;
  templateName: string;
  templateNote?: string;
  meter?: string;
  slots: Slot[];
  baseSlots: Slot[];
  modulate: number | null;
  log: LogEntry[];
  lastSpiceId?: SpiceId;
  voicingSel: Record<number, number>;
  scaleIdx: number;
  playingSlot: number | null;
  playing: boolean;
  muted: boolean;
  bpm: number | null;
}

let logId = 1;
const entry = (icon: string, title: string, text: string, kind: LogEntry['kind'] = 'info'): LogEntry =>
  ({ id: logId++, icon, title, text, kind });

function freshProgression(genre: Genre, mode: ModeId, avoidName?: string) {
  const t = pickTemplate(genre, mode, avoidName);
  return {
    templateName: t.name,
    templateNote: t.note,
    meter: t.meter,
    slots: t.numerals.map((n, i) => newSlot(n, t.bars?.[i] ?? 1)),
  };
}

type Action =
  | { type: 'tonic'; idx: number }
  | { type: 'genre'; id: GenreId }
  | { type: 'mode'; mode: ModeId }
  | { type: 'new-progression' }
  | { type: 'apply'; app: SpiceApplication }
  | { type: 'reset-spice' }
  | { type: 'no-spice' }
  | { type: 'add-numeral'; numeral: string; spiceId?: string; log?: LogEntry }
  | { type: 'remove-slot'; slotId: number }
  | { type: 'cycle-voicing'; slotId: number; next: number }
  | { type: 'instrument'; id: InstrumentId }
  | { type: 'octave'; delta: number }
  | { type: 'scale'; idx: number }
  | { type: 'playing'; playing: boolean }
  | { type: 'playing-slot'; idx: number | null }
  | { type: 'muted'; muted: boolean }
  | { type: 'bpm'; bpm: number | null };

function init(): AppState {
  // optional deep-link params: ?genre=neo-soul&tonic=Eb&instrument=op1
  const params = new URLSearchParams(window.location.search);
  const genreParam = params.get('genre') as GenreId | null;
  const genre = (genreParam && GENRES[genreParam]) || GENRES['classic-rock'];
  const mode = genre.modes[0];
  const tonicParam = params.get('tonic');
  const tonicIdx = Math.max(0, TONIC_CHOICES.findIndex(
    (t) => noteLabel(t).replace('♭', 'b').replace('♯', '#') === (tonicParam ?? 'A')));
  const fresh = freshProgression(genre, mode);
  return {
    tonicIdx,
    genreId: genre.id,
    mode,
    instrument: params.get('instrument') === 'op1' ? 'op1' : 'guitar',
    octaveShift: 0,
    ...fresh,
    baseSlots: fresh.slots,
    modulate: null,
    log: [
      entry(genre.emoji, genre.name, genre.tip),
      entry('👋', 'Welcome to the rack', 'Pick a key and a genre, roll new progressions, then hit “Spice it up” — every trick gets explained right here. Click any chord to hear it.'),
    ],
    voicingSel: {},
    scaleIdx: 0,
    playingSlot: null,
    playing: false,
    muted: false,
    bpm: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'tonic':
      return { ...state, tonicIdx: action.idx };
    case 'genre': {
      if (action.id === state.genreId) return state;
      const genre = GENRES[action.id];
      const mode = genre.modes[0];
      const fresh = freshProgression(genre, mode);
      return {
        ...state, genreId: action.id, mode, ...fresh, baseSlots: fresh.slots,
        modulate: null, voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined, bpm: null,
        log: [entry(genre.emoji, genre.name, genre.tip), ...state.log].slice(0, 40),
      };
    }
    case 'mode': {
      if (action.mode === state.mode) return state;
      const genre = GENRES[state.genreId];
      const fresh = freshProgression(genre, action.mode);
      return {
        ...state, mode: action.mode, ...fresh, baseSlots: fresh.slots,
        modulate: null, voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined,
      };
    }
    case 'new-progression': {
      const genre = GENRES[state.genreId];
      const fresh = freshProgression(genre, state.mode, state.templateName);
      return {
        ...state, ...fresh, baseSlots: fresh.slots,
        modulate: null, voicingSel: {}, lastSpiceId: undefined,
      };
    }
    case 'apply': {
      const patch = action.app.apply();
      return {
        ...state,
        slots: patch.slots ?? state.slots,
        modulate: patch.modulate !== undefined ? patch.modulate : state.modulate,
        lastSpiceId: action.app.spiceId,
        voicingSel: {},
        log: [entry(SPICES[action.app.spiceId].icon, action.app.spiceName, action.app.explanation, 'spice'), ...state.log].slice(0, 40),
      };
    }
    case 'reset-spice':
      return {
        ...state, slots: state.baseSlots, modulate: null, voicingSel: {}, lastSpiceId: undefined,
        log: [entry('↺', 'Rinsed', 'Back to the plain progression. The spice rack is restocked.'), ...state.log].slice(0, 40),
      };
    case 'no-spice':
      return {
        ...state,
        log: [entry('🧂', 'Fully seasoned', 'No spice currently fits this progression — roll a new one or reset and try a different path.'), ...state.log].slice(0, 40),
      };
    case 'add-numeral': {
      const slots = [...state.slots, newSlot(action.numeral, 1, { spiceId: action.spiceId })];
      return {
        ...state, slots,
        log: action.log ? [action.log, ...state.log].slice(0, 40) : state.log,
      };
    }
    case 'remove-slot': {
      if (state.slots.length <= 2) return state;
      return { ...state, slots: state.slots.filter((s) => s.id !== action.slotId) };
    }
    case 'cycle-voicing':
      return { ...state, voicingSel: { ...state.voicingSel, [action.slotId]: action.next } };
    case 'instrument':
      return { ...state, instrument: action.id };
    case 'octave':
      return { ...state, octaveShift: Math.max(-2, Math.min(2, state.octaveShift + action.delta)) };
    case 'scale':
      return { ...state, scaleIdx: action.idx };
    case 'playing':
      return { ...state, playing: action.playing, playingSlot: action.playing ? state.playingSlot : null };
    case 'playing-slot':
      return { ...state, playingSlot: action.idx };
    case 'muted':
      return { ...state, muted: action.muted };
    case 'bpm':
      return { ...state, bpm: action.bpm };
  }
}

/** Genre styling: thrash/pop-punk render plain triads as power chords. */
function styleChord(slot: Slot, chord: Chord, genre: Genre): Chord {
  const convert =
    genre.powerChords === 'all' || (genre.powerChords === 'plain' && !slot.spiceId);
  if (convert && (chord.quality.id === 'maj' || chord.quality.id === 'min')) {
    return { ...chord, quality: QUALITIES.pow };
  }
  return chord;
}

// --- the app ---------------------------------------------------------------

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const stopRef = useRef<(() => void) | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const genre = GENRES[state.genreId];
  const key: Key = useMemo(() => ({ tonic: TONIC_CHOICES[state.tonicIdx], mode: state.mode }), [state.tonicIdx, state.mode]);
  const preferFlat = useMemo(() => flatLeaning(key), [key]);

  const realized: RealizedSlot[] = useMemo(
    () => state.slots.map((s) => {
      const r = realizeSlot(s, key);
      return { slot: r.slot, chord: styleChord(s, r.chord, genre) };
    }),
    [state.slots, key, genre],
  );

  const guitarCandidates: GuitarVoicing[][] = useMemo(
    () => realized.map((r) => chordVoicings(r.chord)),
    [realized],
  );
  const defaultVoicingIdx = useMemo(
    () => chooseVoicingIndices(guitarCandidates, { preferOpen: genre.preferOpen, position: genre.position }),
    [guitarCandidates, genre],
  );
  const voicingIdx = realized.map((r, i) => {
    const sel = state.voicingSel[r.slot.id];
    const n = guitarCandidates[i].length;
    return n === 0 ? 0 : Math.min(sel ?? defaultVoicingIdx[i], n - 1);
  });
  const op1Voicings: Op1Voicing[] = useMemo(() => realized.map((r) => op1ChordVoicing(r.chord)), [realized]);

  const ctx: SpiceContext = useMemo(() => ({ key, flavor: genre.flavor }), [key, genre]);
  const allowedSpices = useMemo(
    () => genre.spices.filter((s) => !(s === 'truck-driver' && state.modulate !== null)),
    [genre, state.modulate],
  );
  const cardApps = useMemo(() => {
    const map = new Map<number, SpiceApplication[]>();
    for (const app of findAllApplications(state.slots, ctx, allowedSpices)) {
      if (app.targetSlotId === undefined) continue;
      const list = map.get(app.targetSlotId) ?? [];
      if (list.length < 2 && !list.some((a) => a.spiceId === app.spiceId)) list.push(app);
      map.set(app.targetSlotId, list);
    }
    return map;
  }, [state.slots, ctx, allowedSpices]);

  const palette = useMemo(() => diatonicPalette(key), [key]);
  const shelf = useMemo(() => borrowShelf(key), [key]);
  const jazzyPalette = genre.flavor.ladder.maj === 'maj7' || genre.flavor.ladder.min === 'm7' || genre.flavor.ladder.min === 'm9';

  const recs = useMemo(() => scaleRecsFor(genre, state.mode), [genre, state.mode]);
  const scaleIdx = Math.min(state.scaleIdx, Math.max(0, recs.length - 1));
  const rec = recs[scaleIdx];

  const bpm = state.bpm ?? genre.bpm;

  const midisFor = (i: number): number[] =>
    state.instrument === 'guitar'
      ? guitarCandidates[i][voicingIdx[i]]?.midis ?? []
      : op1Voicings[i].midis.map((m) => m + 12 * state.octaveShift);

  const stopPlayback = () => {
    stopRef.current?.();
    stopRef.current = null;
    audio.stop();
    dispatch({ type: 'playing', playing: false });
    dispatch({ type: 'playing-slot', idx: null });
  };

  const startPlayback = () => {
    stopRef.current?.();
    const slots = realized.map((r, i) => ({ midis: midisFor(i), bars: r.slot.bars }));
    stopRef.current = audio.play(slots, {
      bpm: Math.max(40, Math.min(244, bpm)),
      swing: genre.swing,
      pattern: genre.pattern,
      instrument: state.instrument,
      onSlot: (idx) => dispatch({ type: 'playing-slot', idx }),
    });
    dispatch({ type: 'playing', playing: true });
  };

  // stop sound when the progression's identity changes under playback
  const progSignature = `${state.genreId}|${state.mode}|${state.tonicIdx}|${state.slots.map((s) => s.id).join(',')}|${state.instrument}|${bpm}`;
  const lastSig = useRef(progSignature);
  useEffect(() => {
    if (lastSig.current !== progSignature) {
      lastSig.current = progSignature;
      if (state.playing) stopPlayback();
    }
  });

  const strumCard = (i: number) => {
    audio.strum(midisFor(i), state.instrument);
  };

  const spiceItUp = () => {
    const app = pickRandomApplication(state.slots, ctx, allowedSpices, state.lastSpiceId);
    if (!app) dispatch({ type: 'no-spice' });
    else dispatch({ type: 'apply', app });
  };

  const fakeSlot = (numeral: string, spiceId?: string): Slot => ({ id: -1, numeral, bars: 1, spiceId });

  const addPaletteChord = (numeral: string, hook?: string) => {
    const chord = resolveNumeral(numeral, key);
    const styled = styleChord(fakeSlot(numeral, hook ? 'shelf' : undefined), chord, genre);
    audio.strum(state.instrument === 'guitar'
      ? chordVoicings(styled)[0]?.midis ?? []
      : op1ChordVoicing(styled).midis.map((m) => m + 12 * state.octaveShift), state.instrument);
    dispatch({
      type: 'add-numeral', numeral, spiceId: hook ? 'shelf' : undefined,
      log: hook ? entry('🛒', `Borrowed ${chordSymbol(chord)}`, `${chordSymbol(chord)} (${prettyNumeral(numeral)}): ${hook}.`) : undefined,
    });
  };

  const copyText = (label: string, text: string) => {
    const done = () => {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    };
    navigator.clipboard?.writeText(text).then(done).catch(() => {
      // WKWebView fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    });
  };

  const copyTab = () => {
    const entries = realized.map((r, i) => ({
      symbol: chordSymbol(r.chord),
      voicing: guitarCandidates[i][voicingIdx[i]],
    })).filter((e) => e.voicing);
    copyText('tab', `${state.templateName} — ${keyLabel(key)} (${genre.name})\n` + chordTabText(entries));
  };

  const copyChart = () => {
    const lines = realized.map((r, i) => {
      const v = op1Voicings[i];
      const names = v.midis.map((m) => midiLabel(m + 12 * state.octaveShift, preferFlat ? 'flat' : 'sharp')).join(' ');
      return `${chordSymbol(r.chord).padEnd(10)} ${names}  (${v.label})`;
    });
    copyText('chart', `${state.templateName} — ${keyLabel(key)} (${genre.name}) · OP-1 keys ${op1RangeLabel(state.octaveShift)}\n` + lines.join('\n'));
  };

  // --- scale panel data ---
  const scaleData = useMemo(() => {
    if (!rec) return undefined;
    const def = SCALES[rec.scale];
    const root = resolveNumeral(rec.root, key).root;
    const rootPc = notePc(root);
    const spelled = spellScale(root, def);
    const labelByPc = new Map<number, string>();
    spelled.forEach((n) => labelByPc.set(notePc(n), noteLabel(simplify(n))));
    const pcs = scalePcs(root, def);
    const box = scaleBox(rootPc, pcs);
    return {
      def, root, rootPc, pcs,
      name: `${noteLabel(simplify(root))} ${def.name}`,
      noteNames: spelled.map((n) => noteLabel(simplify(n))),
      labelOf: (pc: number) => labelByPc.get(pc) ?? '',
      map: scaleFretboard(rootPc, pcs),
      box,
      boxSet: new Set(box.map((n) => `${n.string}:${n.fret}`)),
      op1Keys: op1ScaleKeys(rootPc, pcs),
    };
  }, [rec, key]);

  const soloTips = useMemo(() => buildSoloTips(realized, key), [realized, key]);

  const playScale = () => {
    if (!scaleData) return;
    audio.stop();
    if (state.instrument === 'guitar') {
      const notes = [...scaleData.box].sort((a, b) => a.string - b.string || a.fret - b.fret);
      audio.playScale(notes.map((n) => [40, 45, 50, 55, 59, 64][n.string] + n.fret), 'guitar', Math.max(96, bpm));
    }
    else {
      const midis = scaleData.op1Keys.map((k) => 65 + k.index + 12 * state.octaveShift);
      audio.playScale(midis, 'op1', Math.max(96, bpm));
    }
  };

  const modulatedPreview = state.modulate
    ? realized.map((r) => chordSymbol({
      ...r.chord,
      root: spellPcSimple(mod12(notePc(r.chord.root) + state.modulate!), preferFlat ? 'flat' : 'sharp'),
      bass: undefined,
    })).join(' — ')
    : null;

  // --- render ---
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">SPICERACK</span>
          <span className="brand-sub">chords · scales · spice</span>
        </div>
        <div className="transport">
          <div className="seg">
            <button className={state.instrument === 'guitar' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'guitar' })}>GUITAR</button>
            <button className={state.instrument === 'op1' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'op1' })}>OP-1 FIELD</button>
          </div>
          {state.instrument === 'op1' && (
            <div className="octave">
              <button className="mini" onClick={() => dispatch({ type: 'octave', delta: -1 })} disabled={state.octaveShift <= -2}>−</button>
              <span title="octave shift">{op1RangeLabel(state.octaveShift)}</span>
              <button className="mini" onClick={() => dispatch({ type: 'octave', delta: 1 })} disabled={state.octaveShift >= 2}>+</button>
            </div>
          )}
          <label className="bpm">
            <input type="number" min={40} max={240} value={bpm}
              onChange={(e) => dispatch({ type: 'bpm', bpm: Number(e.target.value) || null })} />
            <span>BPM</span>
          </label>
          <button className={`btn play ${state.playing ? 'btn-stop' : ''}`} onClick={state.playing ? stopPlayback : startPlayback}>
            {state.playing ? '■ STOP' : '▶ PLAY'}
          </button>
          <button className={`btn mute ${state.muted ? 'muted' : ''}`}
            onClick={() => { audio.setMuted(!state.muted); dispatch({ type: 'muted', muted: !state.muted }); }}
            title={state.muted ? 'unmute' : 'mute'}>
            {state.muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <section className="controls">
        <div className="control-row">
          <span className="control-label">KEY</span>
          <div className="key-picker">
            {TONIC_CHOICES.map((t, i) => (
              <button key={i} className={i === state.tonicIdx ? 'key-on' : ''}
                onClick={() => dispatch({ type: 'tonic', idx: i })}>
                {noteLabel(t)}
              </button>
            ))}
          </div>
          <div className="mode-picker">
            {genre.modes.map((m) => (
              <button key={m} className={`chip ${m === state.mode ? 'chip-on' : ''}`}
                onClick={() => dispatch({ type: 'mode', mode: m })}>
                {MODE_NAMES[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-row">
          <span className="control-label">GENRE</span>
          <div className="genre-picker">
            {GENRE_LIST.map((g) => (
              <button key={g.id} className={`chip genre-chip ${g.id === state.genreId ? 'chip-on' : ''}`}
                onClick={() => dispatch({ type: 'genre', id: g.id })} title={g.tagline}>
                {g.emoji} {g.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="main">
        <div className="col-left">
          <section className="panel prog-panel">
            <div className="panel-head">
              <div>
                <h2>{state.templateName}</h2>
                <div className="panel-sub">
                  {keyLabel(key)}{state.meter ? ` · ${state.meter}` : ''} · {genre.name}
                  {state.templateNote && <span className="tpl-note"> — {state.templateNote}</span>}
                </div>
              </div>
              <div className="panel-actions">
                <button className="btn" onClick={() => dispatch({ type: 'new-progression' })}>🎲 New</button>
                <button className="btn btn-spice" onClick={spiceItUp}>🌶 Spice it up</button>
                <button className="btn" onClick={() => dispatch({ type: 'reset-spice' })}
                  disabled={state.slots === state.baseSlots && state.modulate === null}>↺ Reset</button>
                {state.instrument === 'guitar'
                  ? <button className="btn" onClick={copyTab}>{copied === 'tab' ? '✓ Copied' : '📋 Copy tab'}</button>
                  : <button className="btn" onClick={copyChart}>{copied === 'chart' ? '✓ Copied' : '📋 Copy chart'}</button>}
              </div>
            </div>
            <div className="cards">
              {realized.map((r, i) => (
                <ChordCard
                  key={r.slot.id}
                  realized={r}
                  symbol={chordSymbol(r.chord)}
                  instrument={state.instrument}
                  guitarVoicing={guitarCandidates[i][voicingIdx[i]]}
                  guitarVoicingCount={guitarCandidates[i].length}
                  op1Voicing={op1Voicings[i]}
                  isActive={state.playingSlot === i}
                  apps={cardApps.get(r.slot.id) ?? []}
                  canRemove={state.slots.length > 2}
                  onStrum={() => strumCard(i)}
                  onCycleVoicing={(dir) => {
                    const n = guitarCandidates[i].length;
                    if (n) dispatch({ type: 'cycle-voicing', slotId: r.slot.id, next: (voicingIdx[i] + dir + n) % n });
                  }}
                  onApply={(app) => dispatch({ type: 'apply', app })}
                  onRemove={() => dispatch({ type: 'remove-slot', slotId: r.slot.id })}
                />
              ))}
            </div>
            {modulatedPreview && (
              <div className="modulation-banner">
                🚚 On the repeat, take it up a whole step: <strong>{modulatedPreview}</strong>
              </div>
            )}
          </section>

          <section className="panel scale-panel">
            <div className="panel-head">
              <div>
                <h2>Scales for solos</h2>
                <div className="panel-sub">what to play over this progression</div>
              </div>
              <div className="panel-actions">
                <button className="btn" onClick={playScale} disabled={!scaleData}>▶ Hear it</button>
                {state.instrument === 'guitar' && scaleData && (
                  <button className="btn"
                    onClick={() => copyText('scale', scaleTabText(`${scaleData.name} — position box`, scaleData.box))}>
                    {copied === 'scale' ? '✓ Copied' : '📋 Copy tab'}
                  </button>
                )}
              </div>
            </div>
            <div className="scale-chips">
              {recs.map((r, i) => (
                <button key={`${r.scale}:${r.root}`} className={`chip ${i === scaleIdx ? 'chip-on' : ''}`}
                  onClick={() => dispatch({ type: 'scale', idx: i })}>
                  {noteLabel(simplify(resolveNumeral(r.root, key).root))} {SCALES[r.scale].name}
                </button>
              ))}
            </div>
            {scaleData && rec && (
              <>
                <div className="scale-why">
                  <strong>{scaleData.name}</strong> <span className="scale-formula">({scaleData.def.formula})</span>
                  <span className="scale-notes"> · {scaleData.noteNames.join(' ')}</span>
                  <p>{rec.why}</p>
                </div>
                <div className="scale-diagram">
                  {state.instrument === 'guitar'
                    ? <FretboardScale notes={scaleData.map} box={scaleData.boxSet} labelOf={scaleData.labelOf} />
                    : <Op1Keyboard lit={new Map<number, LitKey>(scaleData.op1Keys.map((k) => [k.index, { label: scaleData.labelOf(mod12(65 + k.index)), isRoot: k.isRoot }]))} />}
                  {state.instrument === 'guitar' && <div className="scale-hint">solid dots = position box around the low-E root · faint dots = the rest of the neck</div>}
                  {state.instrument === 'op1' && <div className="scale-hint">lit keys = the scale across both octaves ({op1RangeLabel(state.octaveShift)}) · orange ring = root</div>}
                </div>
                {soloTips.length > 0 && (
                  <div className="solo-tips">
                    {soloTips.map((t, i) => <div key={i} className="solo-tip">💡 {t}</div>)}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="col-right">
          <section className="panel log-panel">
            <div className="panel-head"><h2>What just happened</h2></div>
            <div className="log">
              {state.log.map((e) => (
                <div key={e.id} className={`log-entry log-${e.kind}`}>
                  <div className="log-title">{e.icon} {e.title}</div>
                  <div className="log-text">{e.text}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel palette-panel">
            <div className="panel-head">
              <h2>Chords in {keyLabel(key)}</h2>
            </div>
            <div className="palette">
              {palette.map((p) => {
                const numeral = jazzyPalette ? p.seventhNumeral : p.numeral;
                const c = resolveNumeral(numeral, key);
                return (
                  <button key={p.numeral} className="pal-chord" onClick={() => addPaletteChord(numeral)}
                    title={`add ${chordSymbol(c)}`}>
                    <span className="pal-numeral">{prettyNumeral(numeral)}</span>
                    <span className="pal-symbol">{chordSymbol(styleChord(fakeSlot(numeral), c, genre))}</span>
                  </button>
                );
              })}
            </div>
            <div className="shelf-head">BORROW SHELF <span>(out-of-key flavor)</span></div>
            <div className="palette">
              {shelf.map((s) => {
                const c = resolveNumeral(s.numeral, key);
                return (
                  <button key={s.numeral} className="pal-chord pal-borrowed" onClick={() => addPaletteChord(s.numeral, s.hook)}
                    title={s.hook}>
                    <span className="pal-numeral">{prettyNumeral(s.numeral)}</span>
                    <span className="pal-symbol">{chordSymbol(c)}</span>
                  </button>
                );
              })}
            </div>
            <div className="palette-hint">click to hear & append — shelf chords explain themselves in the log</div>
          </section>
        </div>
      </main>
    </div>
  );
}

/** Context-aware soloing tips derived from what's actually in the progression. */
function buildSoloTips(realized: RealizedSlot[], key: Key): string[] {
  const tips: string[] = [];
  const seen = new Set<string>();
  for (const r of realized) {
    const c = r.chord;
    if (c.func === 'secondary' && !seen.has('sec')) {
      seen.add('sec');
      const third = c.quality.tones.find((t) => t.degree === 3);
      if (third) {
        const thirdName = noteLabel(simplify(spellPcSimple(mod12(notePc(c.root) + third.semitones), 'sharp')));
        tips.push(`When ${chordSymbol(c)} hits, lean on ${thirdName} (its 3rd) — it's outside the key on purpose, and it's the note that makes the pull work.`);
      }
    }
    if (c.numeral === 'iv' && key.mode === 'major' && !seen.has('iv')) {
      seen.add('iv');
      tips.push(`Over the borrowed ${chordSymbol(c)}, flat your 6th for that one bar — minor-key rain inside a major-key song.`);
    }
    if (c.numeral.startsWith('bVII') && key.mode === 'major' && !seen.has('bvii')) {
      seen.add('bvii');
      tips.push(`Over ${chordSymbol(c)} you're briefly in Mixolydian: flat the 7th while it lasts, then put it back.`);
    }
    if (c.numeral.startsWith('bII7') && !seen.has('tritone')) {
      seen.add('tritone');
      tips.push(`Over ${chordSymbol(c)}, its arpeggio is maximum tension against the home key — ride it, then resolve down a half step.`);
    }
    if ((c.numeral === 'V7' || c.numeral === 'V') && (key.mode === 'minor' || key.mode === 'phrygian') && !seen.has('hm')) {
      seen.add('hm');
      tips.push(`Over ${chordSymbol(c)} in a minor key, switch to harmonic minor for that bar — the raised 7th is the chord's whole argument.`);
    }
  }
  return tips.slice(0, 3);
}
