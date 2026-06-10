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
  BOLD_SPICES, GENTLE_SPICES, ProgressionPatch, SPICES, SpiceApplication, SpiceContext, SpiceId,
  findAllApplications, pickRandomApplication,
} from '../theory/spices';
import { ComposedResult, composeProgression } from '../theory/compose';
import { GENRES, GENRE_LIST, Genre, GenreId, ProgressionTemplate, pickTemplate, scaleRecsFor } from '../data/genres';
import {
  CustomGenreData, loadCustomGenres, materializeGenre, saveCustomGenres,
} from '../data/customGenres';
import {
  GuitarVoicing, chooseVoicingIndices, chordTabText, chordVoicings,
  scaleBox, scaleFretboard, scaleTabText,
} from '../guitar/voicing';
import { Op1Voicing, op1ChordVoicing, op1RangeLabel, op1ScaleKeys } from '../op1/op1';
import { PianoVoicing, pianoChordVoicing, pianoRangeLabel, pianoScaleKeys } from '../piano/piano';
import {
  BASS_MAX_FRET, BASS_OPEN_MIDI, BASS_STRING_NAMES, BassShape, bassScaleBox, bassScaleFretboard, bassShape,
} from '../bass/bass';
import { InstrumentId, audio } from '../audio/engine';
import { buildMidiFile, midiFilename } from '../audio/midi';
import { ChordCard } from './ChordCard';
import { FretboardScale } from './Fretboard';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { PianoKeyboard } from './PianoKeyboard';
import { CrabLogo } from './CrabLogo';
import { UiSettings, applySettings, loadSettings, saveSettings } from './themes';
import { SettingsModal } from './SettingsModal';
import { GenreLab } from './GenreLab';
import { LibraryModal, SavedProgression, loadLibrary, saveLibrary } from './LibraryModal';
import { ComposeModal, ComposeSettings } from './ComposeModal';

// --- state -----------------------------------------------------------------

interface LogEntry {
  id: number;
  icon: string;
  title: string;
  text: string;
  kind: 'spice' | 'info';
}

interface Snapshot {
  slots: Slot[];
  modulate: number | null;
}

interface AppState {
  tonicIdx: number;
  genreId: string;
  mode: ModeId;
  instrument: InstrumentId;
  octaveShift: number;
  templateName: string;
  templateNote?: string;
  meter?: string;
  slots: Slot[];
  baseSlots: Slot[];
  modulate: number | null;
  history: Snapshot[];
  heat: 1 | 2 | 3;
  log: LogEntry[];
  lastSpiceId?: SpiceId;
  voicingSel: Record<number, number>;
  scaleIdx: number;
  playingSlot: number | null;
  playing: boolean;
  muted: boolean;
  drumsOn: boolean;
  bpm: number | null;
}

interface SpiceStep {
  spiceId: SpiceId;
  spiceName: string;
  explanation: string;
  patch: ProgressionPatch;
}

const pushHistory = (state: AppState): Snapshot[] =>
  [...state.history, { slots: state.slots, modulate: state.modulate }].slice(-24);

let logId = 1;
const entry = (icon: string, title: string, text: string, kind: LogEntry['kind'] = 'info'): LogEntry =>
  ({ id: logId++, icon, title, text, kind });

function progressionFrom(t: ProgressionTemplate) {
  return {
    templateName: t.name,
    templateNote: t.note,
    meter: t.meter,
    slots: t.numerals.map((n, i) => newSlot(n, t.bars?.[i] ?? 1)),
  };
}

const freshProgression = (genre: Genre, mode: ModeId, avoidName?: string) =>
  progressionFrom(pickTemplate(genre, mode, avoidName));

type Action =
  | { type: 'tonic'; idx: number }
  | { type: 'genre'; genre: Genre }
  | { type: 'mode'; mode: ModeId; genre: Genre }
  | { type: 'new-progression'; genre: Genre }
  | { type: 'pick-template'; template: ProgressionTemplate }
  | { type: 'compose'; result: ComposedResult }
  | { type: 'apply-batch'; steps: SpiceStep[] }
  | { type: 'undo' }
  | { type: 'heat'; heat: 1 | 2 | 3 }
  | { type: 'set-bars'; slotId: number; bars: number }
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
  | { type: 'drums'; on: boolean }
  | { type: 'bpm'; bpm: number | null }
  | { type: 'load-save'; item: SavedProgression; genre: Genre };

const INSTRUMENTS: InstrumentId[] = ['guitar', 'bass', 'piano', 'op1'];

function init(): AppState {
  // optional deep-link params: ?genre=neo-soul&tonic=Eb&instrument=piano
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
    instrument: INSTRUMENTS.find((x) => x === params.get('instrument')) ?? 'guitar',
    octaveShift: 0,
    ...fresh,
    baseSlots: fresh.slots,
    modulate: null,
    history: [],
    heat: 2,
    log: [
      entry(genre.emoji, genre.name, genre.tip),
      entry('👋', 'Welcome to the rack', 'Pick a key and a genre, roll new progressions, then hit “Spice it up” — every trick gets explained right here. Click any chord to hear it.'),
    ],
    voicingSel: {},
    scaleIdx: 0,
    playingSlot: null,
    playing: false,
    muted: false,
    drumsOn: true,
    bpm: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'tonic':
      return { ...state, tonicIdx: action.idx };
    case 'genre': {
      if (action.genre.id === state.genreId) return state;
      const genre = action.genre;
      const mode = genre.modes[0];
      const fresh = freshProgression(genre, mode);
      return {
        ...state, genreId: genre.id, mode, ...fresh, baseSlots: fresh.slots,
        modulate: null, history: [], voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined, bpm: null,
        log: [entry(genre.emoji, genre.name, genre.tip), ...state.log].slice(0, 40),
      };
    }
    case 'mode': {
      if (action.mode === state.mode) return state;
      const fresh = freshProgression(action.genre, action.mode);
      return {
        ...state, mode: action.mode, ...fresh, baseSlots: fresh.slots,
        modulate: null, history: [], voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined,
      };
    }
    case 'new-progression': {
      const fresh = freshProgression(action.genre, state.mode, state.templateName);
      return {
        ...state, ...fresh, baseSlots: fresh.slots,
        modulate: null, history: [], voicingSel: {}, lastSpiceId: undefined,
      };
    }
    case 'pick-template': {
      const fresh = progressionFrom(action.template);
      return {
        ...state, ...fresh, baseSlots: fresh.slots,
        modulate: null, history: [], voicingSel: {}, lastSpiceId: undefined,
      };
    }
    case 'compose': {
      const slots = action.result.numerals.map((n, i) => newSlot(n, action.result.bars[i] ?? 1));
      return {
        ...state,
        templateName: action.result.name,
        templateNote: action.result.planText,
        meter: undefined,
        slots, baseSlots: slots,
        modulate: null, history: [], voicingSel: {}, lastSpiceId: undefined,
        log: [entry('✨', `Composed: ${action.result.name}`, action.result.planText, 'spice'), ...state.log].slice(0, 40),
      };
    }
    case 'load-save': {
      const slots = action.item.slots.map((s) =>
        newSlot(s.numeral, s.bars, { annotation: s.annotation, spiceId: s.spiceId, pedalBass: s.pedalBass }));
      return {
        ...state,
        genreId: action.genre.id,
        mode: (action.item.mode as ModeId) ?? action.genre.modes[0],
        tonicIdx: action.item.tonicIdx,
        templateName: action.item.name,
        templateNote: undefined,
        meter: undefined,
        slots,
        baseSlots: slots,
        modulate: action.item.modulate,
        bpm: action.item.bpm,
        history: [], voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined,
        log: [entry('📚', `Loaded “${action.item.name}”`, `${action.item.summary} — back on the bench.`), ...state.log].slice(0, 40),
      };
    }
    case 'apply-batch': {
      if (!action.steps.length) return state;
      let slots = state.slots;
      let modulate = state.modulate;
      const entries: LogEntry[] = [];
      for (const step of action.steps) {
        if (step.patch.slots) slots = step.patch.slots;
        if (step.patch.modulate !== undefined) modulate = step.patch.modulate;
        entries.unshift(entry(SPICES[step.spiceId].icon, step.spiceName, step.explanation, 'spice'));
      }
      return {
        ...state, slots, modulate,
        history: pushHistory(state),
        lastSpiceId: action.steps[action.steps.length - 1].spiceId,
        voicingSel: {},
        log: [...entries, ...state.log].slice(0, 40),
      };
    }
    case 'undo': {
      const prev = state.history[state.history.length - 1];
      if (!prev) return state;
      return {
        ...state, slots: prev.slots, modulate: prev.modulate,
        history: state.history.slice(0, -1), voicingSel: {}, lastSpiceId: undefined,
      };
    }
    case 'heat':
      return { ...state, heat: action.heat };
    case 'set-bars':
      return {
        ...state,
        history: pushHistory(state),
        slots: state.slots.map((s) => (s.id === action.slotId ? { ...s, bars: action.bars } : s)),
      };
    case 'reset-spice':
      return {
        ...state, slots: state.baseSlots, modulate: null, history: [], voicingSel: {}, lastSpiceId: undefined,
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
        history: pushHistory(state),
        log: action.log ? [action.log, ...state.log].slice(0, 40) : state.log,
      };
    }
    case 'remove-slot': {
      if (state.slots.length <= 2) return state;
      return {
        ...state,
        history: pushHistory(state),
        slots: state.slots.filter((s) => s.id !== action.slotId),
      };
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
    case 'drums':
      return { ...state, drumsOn: action.on };
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
  const [settings, setSettings] = useState<UiSettings>(loadSettings);
  const [customGenres, setCustomGenres] = useState<CustomGenreData[]>(loadCustomGenres);
  const [library, setLibrary] = useState<SavedProgression[]>(loadLibrary);
  const [modal, setModal] = useState<'settings' | 'lab' | 'library' | 'compose' | null>(null);
  const [labEditing, setLabEditing] = useState<CustomGenreData | undefined>(undefined);
  const [composeSettings, setComposeSettings] = useState<ComposeSettings>({
    length: 4, heat: 2, cadence: 'auto', startOnTonic: true,
  });

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  const allGenres = useMemo(
    () => [...GENRE_LIST, ...customGenres.map(materializeGenre)],
    [customGenres],
  );
  const genre = allGenres.find((g) => g.id === state.genreId) ?? GENRE_LIST[0];
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
  const pianoVoicings: PianoVoicing[] = useMemo(() => realized.map((r) => pianoChordVoicing(r.chord)), [realized]);
  const bassShapes: BassShape[] = useMemo(() => realized.map((r) => bassShape(r.chord)), [realized]);

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

  const templatesForMode = useMemo(
    () => genre.templates.filter((t) => t.mode === state.mode),
    [genre, state.mode],
  );

  const recs = useMemo(() => scaleRecsFor(genre, state.mode), [genre, state.mode]);
  const scaleIdx = Math.min(state.scaleIdx, Math.max(0, recs.length - 1));
  const rec = recs[scaleIdx];

  const bpm = state.bpm ?? genre.bpm;

  const midisFor = (i: number): number[] => {
    switch (state.instrument) {
      case 'guitar': return guitarCandidates[i][voicingIdx[i]]?.midis ?? [];
      case 'bass': return bassShapes[i].midis;
      case 'piano': return [pianoVoicings[i].lhMidi, ...pianoVoicings[i].midis].map((m) => m + 12 * state.octaveShift);
      case 'op1': return op1Voicings[i].midis.map((m) => m + 12 * state.octaveShift);
    }
  };

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
      drums: genre.drums,
      drumsOn: state.drumsOn,
      arp: genre.arp,
      onSlot: (idx) => dispatch({ type: 'playing-slot', idx }),
    });
    dispatch({ type: 'playing', playing: true });
  };

  // stop sound when the progression's identity changes under playback
  const progSignature = `${state.genreId}|${state.mode}|${state.tonicIdx}|${state.slots.map((s) => `${s.id}:${s.bars}`).join(',')}|${state.instrument}|${bpm}|${state.drumsOn}`;
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

  const asStep = (app: SpiceApplication): SpiceStep => ({
    spiceId: app.spiceId, spiceName: app.spiceName, explanation: app.explanation, patch: app.apply(),
  });

  const spiceItUp = () => {
    // heat 1: gentle color only · heat 2: anything · heat 3: bold move + a follow-up
    const gentle = allowedSpices.filter((s) => GENTLE_SPICES.has(s));
    const bold = allowedSpices.filter((s) => BOLD_SPICES.has(s));
    const firstPool = state.heat === 1 ? (gentle.length ? gentle : allowedSpices)
      : state.heat === 3 ? (bold.length ? bold : allowedSpices)
      : allowedSpices;
    const first = pickRandomApplication(state.slots, ctx, firstPool, state.lastSpiceId)
      ?? pickRandomApplication(state.slots, ctx, allowedSpices, state.lastSpiceId);
    if (!first) {
      dispatch({ type: 'no-spice' });
      return;
    }
    const steps: SpiceStep[] = [asStep(first)];
    if (state.heat === 3) {
      const afterSlots = steps[0].patch.slots ?? state.slots;
      const secondPool = allowedSpices.filter((s) =>
        s !== first.spiceId && !(s === 'truck-driver' && (steps[0].patch.modulate ?? state.modulate) !== null));
      const second = pickRandomApplication(afterSlots, ctx, secondPool, first.spiceId);
      if (second) steps.push(asStep(second));
    }
    dispatch({ type: 'apply-batch', steps });
  };

  const composeNow = () => {
    const result = composeProgression({
      genre, key,
      length: composeSettings.length,
      heat: composeSettings.heat,
      cadence: composeSettings.cadence,
      startOnTonic: composeSettings.startOnTonic,
    });
    dispatch({ type: 'compose', result });
  };

  const cycleBars = (slotId: number, current: number) => {
    const next = current === 1 ? 2 : current === 2 ? 4 : current === 4 ? 0.5 : 1;
    dispatch({ type: 'set-bars', slotId, bars: next });
  };

  const fakeSlot = (numeral: string, spiceId?: string): Slot => ({ id: -1, numeral, bars: 1, spiceId });

  const previewMidis = (styled: Chord): number[] => {
    switch (state.instrument) {
      case 'guitar': return chordVoicings(styled)[0]?.midis ?? [];
      case 'bass': return bassShape(styled).midis;
      case 'piano': {
        const v = pianoChordVoicing(styled);
        return [v.lhMidi, ...v.midis].map((m) => m + 12 * state.octaveShift);
      }
      case 'op1': return op1ChordVoicing(styled).midis.map((m) => m + 12 * state.octaveShift);
    }
  };

  const addPaletteChord = (numeral: string, hook?: string) => {
    const chord = resolveNumeral(numeral, key);
    const styled = styleChord(fakeSlot(numeral, hook ? 'shelf' : undefined), chord, genre);
    audio.strum(previewMidis(styled), state.instrument);
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

  const copyBassTab = () => {
    const entries = realized.map((r, i) => ({
      symbol: chordSymbol(r.chord),
      voicing: bassShapes[i],
    }));
    copyText('tab', `${state.templateName} — ${keyLabel(key)} (${genre.name}) · bass R·5·8\n` + chordTabText(entries, BASS_STRING_NAMES));
  };

  const copyChart = () => {
    const accidental = preferFlat ? 'flat' : 'sharp';
    const isPiano = state.instrument === 'piano';
    const lines = realized.map((r, i) => {
      const v = isPiano ? pianoVoicings[i] : op1Voicings[i];
      const names = v.midis.map((m) => midiLabel(m + 12 * state.octaveShift, accidental)).join(' ');
      const lh = isPiano ? `LH ${midiLabel(pianoVoicings[i].lhMidi + 12 * state.octaveShift, accidental)} · ` : '';
      return `${chordSymbol(r.chord).padEnd(10)} ${lh}${names}  (${v.label})`;
    });
    const range = isPiano
      ? `piano keys ${pianoRangeLabel(state.octaveShift)}`
      : `OP-1 keys ${op1RangeLabel(state.octaveShift)}`;
    copyText('chart', `${state.templateName} — ${keyLabel(key)} (${genre.name}) · ${range}\n` + lines.join('\n'));
  };

  const exportMidi = async () => {
    const slots = realized.map((r, i) => ({
      midis: midisFor(i),
      bars: r.slot.bars,
      rootPc: notePc(r.chord.bass ?? r.chord.root),
    }));
    const bytes = buildMidiFile(slots, {
      name: `${state.templateName} — ${keyLabel(key)} (${genre.name})`,
      bpm: Math.max(40, Math.min(244, bpm)),
      swing: genre.swing ?? 0,
      pattern: genre.pattern,
      drums: genre.drums,
      includeDrums: state.drumsOn,
      arp: !!genre.arp,
      instrument: state.instrument,
    });
    const filename = midiFilename(state.templateName, keyLabel(key));
    const flash = () => {
      setCopied('midi');
      window.setTimeout(() => setCopied(null), 1600);
    };
    if ('__TAURI_INTERNALS__' in window) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      const path = await save({ defaultPath: filename, filters: [{ name: 'MIDI', extensions: ['mid'] }] });
      if (path) {
        await invoke('save_file', { path, data: Array.from(bytes) });
        flash();
      }
    }
    else {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash();
    }
  };

  const saveToLibrary = () => {
    const item: SavedProgression = {
      id: `save-${Date.now().toString(36)}`,
      name: `${state.templateName} in ${keyLabel(key)}`,
      savedAt: Date.now(),
      genreId: state.genreId,
      mode: state.mode,
      tonicIdx: state.tonicIdx,
      bpm: state.bpm,
      modulate: state.modulate,
      slots: state.slots.map((s) => ({
        numeral: s.numeral, bars: s.bars, annotation: s.annotation, spiceId: s.spiceId, pedalBass: s.pedalBass,
      })),
      summary: realized.map((r) => chordSymbol(r.chord)).join(' — '),
    };
    const next = [item, ...library].slice(0, 60);
    setLibrary(next);
    saveLibrary(next);
    setCopied('saved');
    window.setTimeout(() => setCopied(null), 1600);
  };

  const saveCustomGenre = (data: CustomGenreData) => {
    const next = [...customGenres.filter((g) => g.id !== data.id), data];
    setCustomGenres(next);
    saveCustomGenres(next);
    dispatch({ type: 'genre', genre: materializeGenre(data) });
  };

  const deleteCustomGenre = (id: string) => {
    const next = customGenres.filter((g) => g.id !== id);
    setCustomGenres(next);
    saveCustomGenres(next);
    if (state.genreId === id) dispatch({ type: 'genre', genre: GENRE_LIST[0] });
  };

  // keyboard shortcuts (skip while typing or in a modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (modal) {
        if (e.key === 'Escape') setModal(null);
        return;
      }
      switch (e.key) {
        case ' ': e.preventDefault(); state.playing ? stopPlayback() : startPlayback(); break;
        case 'n': dispatch({ type: 'new-progression', genre }); break;
        case 's': spiceItUp(); break;
        case 'u': dispatch({ type: 'undo' }); break;
        case 'c': setModal('compose'); break;
        case 'r': dispatch({ type: 'reset-spice' }); break;
        case 'm': audio.setMuted(!state.muted); dispatch({ type: 'muted', muted: !state.muted }); break;
        case 'd': dispatch({ type: 'drums', on: !state.drumsOn }); break;
        case '1': dispatch({ type: 'instrument', id: 'guitar' }); break;
        case '2': dispatch({ type: 'instrument', id: 'bass' }); break;
        case '3': dispatch({ type: 'instrument', id: 'piano' }); break;
        case '4': dispatch({ type: 'instrument', id: 'op1' }); break;
        case 't': setModal('settings'); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
    const bassBox = bassScaleBox(rootPc, pcs);
    return {
      def, root, rootPc, pcs,
      name: `${noteLabel(simplify(root))} ${def.name}`,
      noteNames: spelled.map((n) => noteLabel(simplify(n))),
      labelOf: (pc: number) => labelByPc.get(pc) ?? '',
      map: scaleFretboard(rootPc, pcs),
      box,
      boxSet: new Set(box.map((n) => `${n.string}:${n.fret}`)),
      bassMap: bassScaleFretboard(rootPc, pcs),
      bassBox,
      bassBoxSet: new Set(bassBox.map((n) => `${n.string}:${n.fret}`)),
      op1Keys: op1ScaleKeys(rootPc, pcs),
      pianoKeys: pianoScaleKeys(rootPc, pcs),
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
    else if (state.instrument === 'bass') {
      const notes = [...scaleData.bassBox].sort((a, b) => a.string - b.string || a.fret - b.fret);
      audio.playScale(notes.map((n) => BASS_OPEN_MIDI[n.string] + n.fret), 'bass', Math.max(96, bpm));
    }
    else if (state.instrument === 'piano') {
      const midis = scaleData.pianoKeys.map((k) => 60 + k.index + 12 * state.octaveShift);
      audio.playScale(midis, 'piano', Math.max(96, bpm));
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
          <CrabLogo size={34} />
          <span className="brand-name">SPICERACK<span className="brand-two">2</span></span>
          <span className="brand-sub">chords · scales · spice</span>
        </div>
        <div className="transport">
          <div className="seg">
            <button className={state.instrument === 'guitar' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'guitar' })}>GUITAR</button>
            <button className={state.instrument === 'bass' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'bass' })}>BASS</button>
            <button className={state.instrument === 'piano' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'piano' })}>PIANO</button>
            <button className={state.instrument === 'op1' ? 'seg-on' : ''} onClick={() => dispatch({ type: 'instrument', id: 'op1' })}>OP-1 FIELD</button>
          </div>
          {(state.instrument === 'op1' || state.instrument === 'piano') && (
            <div className="octave">
              <button className="mini" onClick={() => dispatch({ type: 'octave', delta: -1 })} disabled={state.octaveShift <= -2}>−</button>
              <span title="octave shift">
                {state.instrument === 'piano' ? pianoRangeLabel(state.octaveShift) : op1RangeLabel(state.octaveShift)}
              </span>
              <button className="mini" onClick={() => dispatch({ type: 'octave', delta: 1 })} disabled={state.octaveShift >= 2}>+</button>
            </div>
          )}
          <label className="bpm">
            <input type="number" min={40} max={240} value={bpm}
              onChange={(e) => dispatch({ type: 'bpm', bpm: Number(e.target.value) || null })} />
            <span>BPM</span>
          </label>
          <button className={`btn drums ${state.drumsOn ? '' : 'muted'}`} title={`drums ${state.drumsOn ? 'on' : 'off'} (d)`}
            onClick={() => dispatch({ type: 'drums', on: !state.drumsOn })}>
            🥁
          </button>
          <button className={`btn play ${state.playing ? 'btn-stop' : ''}`} onClick={state.playing ? stopPlayback : startPlayback}>
            {state.playing ? '■ STOP' : '▶ PLAY'}
          </button>
          <button className={`btn mute ${state.muted ? 'muted' : ''}`}
            onClick={() => { audio.setMuted(!state.muted); dispatch({ type: 'muted', muted: !state.muted }); }}
            title={state.muted ? 'unmute' : 'mute'}>
            {state.muted ? '🔇' : '🔊'}
          </button>
          <button className="btn" onClick={() => setModal('library')} title="saved progressions">📚</button>
          <button className="btn" onClick={() => setModal('settings')} title="look & feel (t)">🎨</button>
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
                onClick={() => dispatch({ type: 'mode', mode: m, genre })}>
                {MODE_NAMES[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-row">
          <span className="control-label">GENRE</span>
          <div className="genre-picker">
            {allGenres.map((g) => (
              <button key={g.id} className={`chip genre-chip ${g.id === state.genreId ? 'chip-on' : ''}`}
                onClick={() => dispatch({ type: 'genre', genre: g })} title={g.tagline}>
                {g.emoji} {g.name}
                {g.id.startsWith('custom-') && (
                  <span className="chip-edit" title="edit in Genre Lab"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLabEditing(customGenres.find((c) => c.id === g.id));
                      setModal('lab');
                    }}> ✎</span>
                )}
              </button>
            ))}
            <button className="chip chip-lab" onClick={() => { setLabEditing(undefined); setModal('lab'); }}
              title="cook up your own genre">
              🧪 Genre Lab
            </button>
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
                <button className="btn" onClick={() => setModal('compose')} title="generate a progression from harmonic function">✨ Compose</button>
                <select
                  className="tpl-select"
                  title="pick a progression"
                  value={templatesForMode.some((t) => t.name === state.templateName) ? state.templateName : ''}
                  onChange={(e) => {
                    const t = templatesForMode.find((x) => x.name === e.target.value);
                    if (t) dispatch({ type: 'pick-template', template: t });
                  }}>
                  <option value="" disabled>— pick a progression —</option>
                  {templatesForMode.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} · {t.numerals.slice(0, 6).join(' ')}{t.numerals.length > 6 ? '…' : ''}
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={() => dispatch({ type: 'new-progression', genre })}>🎲 New</button>
                <button className="btn btn-spice" onClick={spiceItUp}>🌶 Spice it up</button>
                <div className="seg heat-seg" title="spice heat: mild / medium / heavy (heavy chains two moves)">
                  {([1, 2, 3] as const).map((h) => (
                    <button key={h} className={state.heat === h ? 'seg-on' : ''}
                      onClick={() => dispatch({ type: 'heat', heat: h })}>
                      {'🌶'.repeat(h)}
                    </button>
                  ))}
                </div>
                <button className="btn" onClick={() => dispatch({ type: 'undo' })}
                  disabled={state.history.length === 0} title="undo last change">↩ Undo</button>
                <button className="btn" onClick={() => dispatch({ type: 'reset-spice' })}
                  disabled={state.slots === state.baseSlots && state.modulate === null}>↺ Reset</button>
                {state.instrument === 'guitar' && <button className="btn" onClick={copyTab}>{copied === 'tab' ? '✓ Copied' : '📋 Copy tab'}</button>}
                {state.instrument === 'bass' && <button className="btn" onClick={copyBassTab}>{copied === 'tab' ? '✓ Copied' : '📋 Copy tab'}</button>}
                {(state.instrument === 'piano' || state.instrument === 'op1') && <button className="btn" onClick={copyChart}>{copied === 'chart' ? '✓ Copied' : '📋 Copy chart'}</button>}
                <button className="btn" onClick={exportMidi}>{copied === 'midi' ? '✓ Saved' : '🎹 MIDI'}</button>
                <button className="btn" onClick={saveToLibrary}>{copied === 'saved' ? '✓ Saved' : '💾 Save'}</button>
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
                  pianoVoicing={pianoVoicings[i]}
                  bassShape={bassShapes[i]}
                  isActive={state.playingSlot === i}
                  apps={cardApps.get(r.slot.id) ?? []}
                  canRemove={state.slots.length > 2}
                  onStrum={() => strumCard(i)}
                  onCycleVoicing={(dir) => {
                    const n = guitarCandidates[i].length;
                    if (n) dispatch({ type: 'cycle-voicing', slotId: r.slot.id, next: (voicingIdx[i] + dir + n) % n });
                  }}
                  onCycleBars={() => cycleBars(r.slot.id, r.slot.bars)}
                  onApply={(app) => dispatch({ type: 'apply-batch', steps: [asStep(app)] })}
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
                {state.instrument === 'bass' && scaleData && (
                  <button className="btn"
                    onClick={() => copyText('scale', scaleTabText(`${scaleData.name} — position box (bass)`, scaleData.bassBox, BASS_STRING_NAMES))}>
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
                    && <FretboardScale notes={scaleData.map} box={scaleData.boxSet} labelOf={scaleData.labelOf} />}
                  {state.instrument === 'bass'
                    && <FretboardScale notes={scaleData.bassMap} box={scaleData.bassBoxSet} labelOf={scaleData.labelOf}
                      names={BASS_STRING_NAMES} maxFret={BASS_MAX_FRET} />}
                  {state.instrument === 'piano'
                    && <PianoKeyboard lit={new Map<number, LitKey>(scaleData.pianoKeys.map((k) => [k.index, { label: scaleData.labelOf(mod12(60 + k.index)), isRoot: k.isRoot }]))} />}
                  {state.instrument === 'op1'
                    && <Op1Keyboard lit={new Map<number, LitKey>(scaleData.op1Keys.map((k) => [k.index, { label: scaleData.labelOf(mod12(65 + k.index)), isRoot: k.isRoot }]))} />}
                  {state.instrument === 'guitar' && <div className="scale-hint">solid dots = position box around the low-E root · faint dots = the rest of the neck</div>}
                  {state.instrument === 'bass' && <div className="scale-hint">solid dots = position box around the low-E root · faint dots = the rest of the neck</div>}
                  {state.instrument === 'piano' && <div className="scale-hint">lit keys = the scale across two octaves ({pianoRangeLabel(state.octaveShift)}) · ring = root</div>}
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

      <footer className="footer">
        <span>⌨ space play · n new · c compose · s spice · u undo · r reset · d drums · m mute · 1-4 instrument · t themes</span>
      </footer>

      {modal === 'settings' && (
        <SettingsModal settings={settings} onChange={setSettings} onClose={() => setModal(null)} />
      )}
      {modal === 'compose' && (
        <ComposeModal settings={composeSettings} onChange={setComposeSettings}
          onGenerate={composeNow} onClose={() => setModal(null)} />
      )}
      {modal === 'lab' && (
        <GenreLab editing={labEditing} onSave={saveCustomGenre} onDelete={deleteCustomGenre} onClose={() => setModal(null)} />
      )}
      {modal === 'library' && (
        <LibraryModal
          items={library}
          genreName={(id) => allGenres.find((g) => g.id === id)?.name ?? 'lost genre'}
          onLoad={(item) => {
            const g = allGenres.find((x) => x.id === item.genreId) ?? GENRE_LIST[0];
            dispatch({ type: 'load-save', item, genre: g });
          }}
          onDelete={(id) => {
            const next = library.filter((x) => x.id !== id);
            setLibrary(next);
            saveLibrary(next);
          }}
          onClose={() => setModal(null)}
        />
      )}
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
