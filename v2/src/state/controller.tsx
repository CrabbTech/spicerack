// The controller: every piece of app behaviour in one hook — derived music,
// playback, practice tools, persistence. Views stay dumb: they read this
// through useApp() and call what they need.

import { MouseEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { midiLabel, mod12, notePc, spellPcSimple } from '../theory/notes';
import { LENSES, LensId } from '../theory/solo';
import { explainTransition } from '../theory/transitions';
import { Key, TONIC_CHOICES, flatLeaning } from '../theory/scales';
import { Chord, chordSymbol } from '../theory/chords';
import { prettyNumeral, resolveNumeral } from '../theory/roman';
import {
  RealizedSlot, Slot, borrowShelf, diatonicPalette, keyLabel, newSlot, realizeSlot,
} from '../theory/progression';
import {
  BOLD_SPICES, GENTLE_SPICES, SpiceApplication, SpiceContext, findAllApplications, pickRandomApplication,
} from '../theory/spices';
import { composeProgression } from '../theory/compose';
import { GENRE_LIST, scaleRecsFor } from '../data/genres';
import {
  CustomGenreData, loadCustomGenres, materializeGenre, saveCustomGenres,
} from '../data/customGenres';
import { GuitarVoicing, chooseVoicingIndices, chordTabText, chordVoicings, scaleBox } from '../guitar/voicing';
import { OPEN_MIDI } from '../guitar/shapes';
import { OP1_BASE_MIDI, Op1Voicing, op1ChordVoicing, op1RangeLabel, op1ScaleKeys } from '../op1/op1';
import { PIANO_BASE_MIDI, PianoVoicing, pianoChordVoicing, pianoRangeLabel, pianoScaleKeys } from '../piano/piano';
import { BASS_OPEN_MIDI, BASS_STRING_NAMES, BassShape, bassScaleBox, bassShape } from '../bass/bass';
import { InstrumentId, PassInfo, audio } from '../audio/engine';
import { Meter, beatsPerBar } from '../audio/groove';
import { buildMidiFile, midiFilename } from '../audio/midi';
import { buildSoloModel } from '../ui/soloModel';
import { buildTransitionDemo } from '../ui/TransitionPanel';
import { SavedProgression, loadLibrary, saveLibrary } from '../ui/LibraryModal';
import { ComposeSettings } from '../ui/ComposeModal';

import { Action, SpiceStep, ViewId, buildSoloTips, entry, init, linkParam, reducer, stash, styleChord } from './reducer';
import {
  MelNote, MelodyContext, analyzeMelody, newNoteId, quantize, sortNotes, toLead,
} from '../theory/melody';
import { LeadNote } from '../theory/lick';
import { CrabMode, analyzeCanon, crabProof, mirrorLead, mirrorSpec, movedNotes } from '../theory/crab';
import { TakeGrade, gradeTake } from '../practice/grade';
import { Progress, loadProgress, recordLesson, recordPass, recordSprint, saveProgress } from '../practice/progress';
import { storageKey } from './storage';
import { JournalEntry, appendJournal, loadJournal, saveJournal } from './journal';
import { turnPage } from '../ui/pageTurn';
import { EarRound, buildEarRound } from '../practice/earQuiz';
import { ALL_STEPS, LessonStep } from '../data/lessons';
import { neckPositions } from '../guitar/positions';
import { OPEN_PC } from '../guitar/shapes';
import { BASS_OPEN_PC } from '../bass/bass';
import { openMidiIn } from '../input/midiIn';
import { openMic } from '../input/mic';
import { QWERTY_MAP, qwertyBase } from '../input/qwerty';
import { saveSession } from './session';
import { PathMode } from '../theory/triads';
import { FRET_DRILLS, FretDrillKind, SprintResult } from '../practice/fretDrills';
import { buildTriadModel, triadArp } from '../ui/triadModel';
import { HarmonyOption, NextOption, WeightedPc, harmonizeOptions, nextChordOptions } from '../theory/suggest';
import { savedSections } from './reducer';

// --- practice settings (persisted) -----------------------------------------

export interface PracticeSettings {
  countIn: boolean;
  /** tempo trainer: start at 70% and climb 5% every pass */
  ramp: boolean;
  chords: boolean;
  bass: boolean;
  /** timbre of the chord part; 'same' = the instrument being studied */
  backing: 'same' | InstrumentId;
}

/** the pages in the order they are bound: Learn, Jam, Write */
const PAGE_ORDER: ViewId[] = ['learn', 'jam', 'write'];
const PRACTICE_KEY = storageKey('practice');
const LABELS_KEY = storageKey('labels');
const LEFTY_KEY = storageKey('lefty');
export const RAMP = { startPct: 70, stepPct: 5 };

function loadPractice(): PracticeSettings {
  const defaults: PracticeSettings = { countIn: false, ramp: false, chords: true, bass: true, backing: 'same' };
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<PracticeSettings>) } : defaults;
  }
  catch {
    return defaults;
  }
}

export interface AbChip {
  symbol: string;
  changed: boolean;
}

export type InputSource = 'off' | 'qwerty' | 'midi' | 'mic';
export type JamTool = 'solo' | 'triads' | 'drills';

/** seconds between playing a note and the app hearing about it, per source */
const INPUT_LATENCY: Record<InputSource, number> = { off: 0, qwerty: 0.03, midi: 0.012, mic: 0.03 };

/** the crab canon's second voice plays on a different sound from the line it mirrors, so the two readings can be told apart */
const CRAB_VOICE: Record<InstrumentId, InstrumentId> = { guitar: 'op1', bass: 'piano', piano: 'op1', op1: 'piano' };

type TakeNote = MelNote & { pass: number };

export interface QuizState {
  round: EarRound;
  before: string[];
  after: string[];
  /** which half is sounding, and which chord of it */
  phase: 'A' | 'B' | null;
  at: number | null;
  answered: number | null;
}

/** Before/after listening: the loop plays the previous version, then the current one. */
export interface AbState {
  before: AbChip[];
  after: AbChip[];
  side: 'A' | 'B';
  idx: number | null;
}


export function useAppController() {
  const [state, rawDispatch] = useReducer(reducer, undefined, init);
  // a change of view turns the page: its DOM update runs inside a view transition (pageTurn.ts)
  const viewRef = useRef(state.view);
  viewRef.current = state.view;
  const dispatch = useCallback((action: Action) => {
    const to = action.type === 'view' || action.type === 'stage' ? action.view : null;
    if (to !== null && to !== viewRef.current) {
      document.documentElement.dataset.turn = PAGE_ORDER.indexOf(to) > PAGE_ORDER.indexOf(viewRef.current) ? 'fwd' : 'back';
      turnPage(() => flushSync(() => rawDispatch(action)));
    }
    else rawDispatch(action);
  }, []);
  const stopRef = useRef<(() => void) | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [customGenres, setCustomGenres] = useState<CustomGenreData[]>(loadCustomGenres);
  const [library, setLibrary] = useState<SavedProgression[]>(loadLibrary);
  const [modal, setModal] = useState<'lab' | 'library' | 'compose' | 'cover' | null>(null);
  const [labEditing, setLabEditing] = useState<CustomGenreData | undefined>(undefined);
  const [composeSettings, setComposeSettings] = useState<ComposeSettings>({
    length: 4, heat: 2, cadence: 'auto', startOnTonic: true,
  });

  // solo lab + practice transport
  const [focusId, setFocusId] = useState<number | null>(() => {
    const at = linkParam('focus');
    return at === null ? null : state.slots[Number(at)]?.id ?? null;
  });
  const [lens, setLens] = useState<LensId>(() => LENSES.find((l) => l.id === linkParam('lens'))?.id ?? 'map');
  const [demoOn, setDemoOn] = useState(false);
  const [lickSeed, setLickSeed] = useState(1);
  const [both, setBoth] = useState(() => linkParam('both') === '1');
  const jam = state.view === 'jam';
  const [leadMidi, setLeadMidi] = useState<number | null>(null);
  const [passInfo, setPassInfo] = useState<PassInfo | null>(null);
  const [practice, setPractice] = useState<PracticeSettings>(loadPractice);
  const [loopIdx, setLoopIdx] = useState<number[] | null>(null);
  const [xfer, setXfer] = useState<number | null>(() => (linkParam('xfer') === null ? null : Number(linkParam('xfer'))));
  const [xferTag, setXferTag] = useState<number | 'from' | 'to' | null>(null);
  const [ab, setAb] = useState<AbState | null>(null);
  const focusLast = useRef(false);

  // write: melody, neck position, handedness
  const [melodyOn, setMelodyOn] = useState(true);
  // the crab canon: a second voice reads the written line from the end
  const [crabOn, setCrabOn] = useState(false);
  const [crabMode, setCrabMode] = useState<CrabMode>('crab');
  // jam: which tool has the big diagram, and the triad lab's choices
  const [jamTool, setJamToolState] = useState<JamTool>(() => (['solo', 'triads', 'drills'] as const).find((t) => t === linkParam('tool')) ?? 'solo');
  const [drillKind, setDrillKind] = useState<FretDrillKind>(() => FRET_DRILLS.find((d) => d.id === linkParam('drill'))?.id ?? 'interval');
  const [lastSprint, setLastSprint] = useState<SprintResult | null>(null);
  // how diagrams talk: letters, or numbers (intervals against the chord in focus). Strings default to numbers — that's the grammar.
  const [labelPref, setLabelPref] = useState<'names' | 'numbers' | null>(() => {
    const saved = linkParam('labels') ?? localStorage.getItem(LABELS_KEY);
    return saved === 'names' || saved === 'numbers' ? saved : null;
  });
  const [triadSet, setTriadSet] = useState<number | undefined>(undefined);
  const [triadMode, setTriadMode] = useState<PathMode>('close');
  const [triadUpper, setTriadUpper] = useState(false);
  const [triadComp, setTriadComp] = useState(false);
  const [triadPins, setTriadPins] = useState<Record<number, number>>({});
  const [position, setPosition] = useState(0);
  const [lefty, setLefty] = useState(() => localStorage.getItem(LEFTY_KEY) === '1');
  const [grid, setGrid] = useState<0.5 | 0.25>(0.5);
  // step entry: the instrument diagram writes into the melody at this beat
  const [stepEntry, setStepEntry] = useState(false);
  const [stepBeat, setStepBeat] = useState(0);
  // play-along: what is listening, what it heard, how the last pass went
  const [inputSource, setInputSource] = useState<InputSource>('off');
  const [inputStatus, setInputStatus] = useState('');
  const [held, setHeld] = useState<number[]>([]);
  const [micLevel, setMicLevel] = useState<{ rms: number; midi: number | null }>({ rms: 0, midi: null });
  const [grade, setGrade] = useState<TakeGrade | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // the journal: every log line, written into the book with its time, kept between sessions
  const [journal, setJournal] = useState<JournalEntry[]>(loadJournal);
  const journalRef = useRef(journal);
  journalRef.current = journal;
  const journaled = useRef(0);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [songAt, setSongAt] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [quizStreak, setQuizStreak] = useState(0);
  const takeRef = useRef<{ notes: TakeNote[]; open: Map<number, TakeNote> }>({ notes: [], open: new Map() });
  const pendingXfer = useRef<number | null>(null);
  const songRef = useRef(false);

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => {
    // the log is newest-first; anything above the high-water mark is new this render
    const fresh = state.log.filter((e) => e.id > journaled.current && !e.quiet);
    for (const e of state.log) journaled.current = Math.max(journaled.current, e.id);
    if (!fresh.length) return;
    const next = appendJournal(journalRef.current, [...fresh].reverse().map((e) => ({ id: `${e.at}-${e.id}`, at: e.at, title: e.title, text: e.text, kind: e.kind })));
    saveJournal(next);
    setJournal(next);
  }, [state.log]);
  useEffect(() => localStorage.setItem(LEFTY_KEY, lefty ? '1' : '0'), [lefty]);

  useEffect(() => {
    audio.setMix({ chords: practice.chords, bass: practice.bass, drums: state.drumsOn });
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(practice));
  }, [practice, state.drumsOn]);

  useEffect(() => {
    document.documentElement.dataset.jam = String(jam);
  }, [jam]);

  // one lead at a time: the demo lick while it's on, otherwise the written melody
  const leadOn = demoOn || (melodyOn && state.melody.length > 0);
  useEffect(() => {
    audio.setLead(leadOn);
    if (!leadOn) setLeadMidi(null);
  }, [leadOn]);

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

  const meter: Meter | undefined = useMemo(() => (state.groups ? { groups: state.groups } : undefined), [state.groups]);
  const perBar = beatsPerBar(meter);

  // a looped section, as slot indices in play order (the seam loop is [last, 0])
  const order = loopIdx && loopIdx.every((i) => i < realized.length) ? loopIdx : null;

  // on the gear-change pass everything the lab shows moves up with the music
  const transposeNow = state.playing && !ab ? passInfo?.transpose ?? 0 : 0;
  const liveKey: Key = useMemo(() => (transposeNow
    ? { tonic: spellPcSimple(mod12(notePc(key.tonic) + transposeNow), preferFlat ? 'flat' : 'sharp'), mode: key.mode }
    : key), [key, transposeNow, preferFlat]);
  const liveRealized: RealizedSlot[] = useMemo(() => (transposeNow
    ? state.slots.map((s) => ({ slot: s, chord: styleChord(s, realizeSlot(s, liveKey).chord, genre) }))
    : realized), [transposeNow, state.slots, liveKey, genre, realized]);

  const baseSolo = useMemo(() => (rec ? buildSoloModel({
    rec, key, realized, instrument: state.instrument, octaveShift: state.octaveShift,
    lens, seed: lickSeed, beatsPerBar: perBar, order, position,
  }) : undefined), [rec, key, realized, state.instrument, state.octaveShift, lens, lickSeed, perBar, order, position]);
  const liveSolo = useMemo(() => (rec && transposeNow ? buildSoloModel({
    rec, key: liveKey, realized: liveRealized, instrument: state.instrument, octaveShift: state.octaveShift,
    lens, seed: lickSeed, beatsPerBar: perBar, order, position,
  }) : baseSolo), [rec, transposeNow, liveKey, liveRealized, state.instrument, state.octaveShift, lens, lickSeed, perBar, order, position, baseSolo]);

  // the melody is always read against the whole section with nothing switched off
  const writeSolo = useMemo(() => (rec && (lens !== 'map' || order) ? buildSoloModel({
    rec, key, realized, instrument: state.instrument, octaveShift: state.octaveShift,
    lens: 'map', seed: lickSeed, beatsPerBar: perBar, position,
  }) : baseSolo), [rec, key, realized, state.instrument, state.octaveShift, lens, order, lickSeed, perBar, position, baseSolo]);

  const asContext = (solo: typeof baseSolo): MelodyContext | undefined => (solo ? {
    segments: solo.segments, scalePcs: solo.pcs, lo: solo.range.lo, hi: solo.range.hi,
    beatsPerBar: perBar, totalBeats: solo.totalBeats, preferFlat,
  } : undefined);
  const melodyCtx = useMemo(() => asContext(writeSolo), [writeSolo, perBar, preferFlat]); // eslint-disable-line react-hooks/exhaustive-deps
  const gradeCtx = useMemo(() => asContext(baseSolo), [baseSolo, perBar, preferFlat]); // eslint-disable-line react-hooks/exhaustive-deps
  const melodyReport = useMemo(() => (melodyCtx ? analyzeMelody(state.melody, melodyCtx) : undefined), [state.melody, melodyCtx]);

  const positions = useMemo(() => (baseSolo && (state.instrument === 'guitar' || state.instrument === 'bass')
    ? neckPositions(baseSolo.rootPc, baseSolo.pcs, state.instrument === 'bass' ? BASS_OPEN_PC : OPEN_PC)
    : []), [baseSolo, state.instrument]);

  // the written melody as a lead line; a looped section plays just its own slice of it
  const melodyLead: LeadNote[] = useMemo(() => {
    if (!order) return toLead(state.melody);
    const starts: number[] = [];
    realized.reduce((at, r, i) => { starts[i] = at; return at + r.slot.bars * perBar; }, 0);
    const out: LeadNote[] = [];
    let at = 0;
    for (const i of order) {
      const len = realized[i].slot.bars * perBar;
      for (const n of sortNotes(state.melody)) {
        if (n.beat >= starts[i] - 1e-6 && n.beat < starts[i] + len - 1e-6) out.push({ beat: n.beat - starts[i] + at, dur: n.dur, midi: n.midi, vel: n.vel });
      }
      at += len;
    }
    return out;
  }, [state.melody, order, realized, perBar]);

  // the crab canon: the same line read from the end, on a sound of its own — over the looped slice when one is set
  const loopBeats = order ? order.reduce((n, i) => n + realized[i].slot.bars * perBar, 0) : melodyCtx?.totalBeats ?? 0;
  const crabLead: LeadNote[] = useMemo(() => {
    if (!crabOn || !melodyCtx || !melodyLead.length) return [];
    const spec = mirrorSpec(melodyCtx, state.melody, crabMode, loopBeats);
    return mirrorLead(melodyLead, spec).map((n) => ({ ...n, vel: n.vel * 0.8, voice: CRAB_VOICE[state.instrument] }));
  }, [crabOn, melodyCtx, melodyLead, state.melody, crabMode, loopBeats, state.instrument]);
  const crabReport = useMemo(
    () => (melodyCtx && state.melody.length ? analyzeCanon(state.melody, melodyCtx, crabMode) : undefined),
    [melodyCtx, state.melody, crabMode],
  );

  // the engine reads these at the top of every pass, so edits land without a restart
  // --- triad lab: three notes per chord, voice-led through the changes ---
  const triads = useMemo(() => buildTriadModel({
    realized, instrument: state.instrument, octaveShift: state.octaveShift,
    setIdx: triadSet, mode: triadMode, upper: triadUpper, pins: triadPins, window: baseSolo?.window,
  }), [realized, state.instrument, state.octaveShift, triadSet, triadMode, triadUpper, triadPins, baseSolo?.window]);
  const liveTriads = useMemo(() => (transposeNow ? buildTriadModel({
    realized: liveRealized, instrument: state.instrument, octaveShift: state.octaveShift,
    setIdx: triadSet, mode: triadMode, upper: triadUpper, pins: triadPins, window: liveSolo?.window,
  }) : triads), [transposeNow, liveRealized, state.instrument, state.octaveShift, triadSet, triadMode, triadUpper, triadPins, liveSolo?.window, triads]);
  const triadsUp = state.view === 'jam' && jamTool === 'triads';
  const triadLead = useMemo(
    () => triadArp((order ?? realized.map((_, i) => i)).map((i) => triads.chosen[i]), (order ?? realized.map((_, i) => i)).map((i) => realized[i]), perBar),
    [triads, order, realized, perBar],
  );
  // pinned shapes are indexes into a candidate list — a different list makes them meaningless
  const pinScope = `${state.instrument}|${state.octaveShift}|${triads.neck?.setIdx ?? 'keys'}|${triadUpper}|${state.tonicIdx}`;
  useEffect(() => setTriadPins({}), [pinScope]);

  const labelMode: 'names' | 'numbers' = labelPref ?? (state.instrument === 'guitar' || state.instrument === 'bass' ? 'numbers' : 'names');
  const setLabelMode = (mode: 'names' | 'numbers') => {
    setLabelPref(mode);
    localStorage.setItem(LABELS_KEY, mode);
  };

  const finishSprint = (result: SprintResult, cards: { tag: string; right: boolean }[]) => {
    setLastSprint(result);
    setProgress((prev) => recordSprint(prev, result.kind, result.score, cards));
  };

  const setJamTool = (tool: JamTool) => {
    setJamToolState(tool);
    if (tool === 'triads') setLens('arps'); // play-along grading in the triad lab = chord tones
  };

  const leadRef = useRef<LeadNote[] | null>(null);
  leadRef.current = demoOn ? (triadsUp ? triadLead : baseSolo?.lick ?? null) : crabLead.length ? [...melodyLead, ...crabLead] : melodyLead;
  const demoRef = useRef(leadOn);
  demoRef.current = leadOn;

  // everything the long-lived input and transport callbacks need, fresh every render
  const live = useRef({ gradeCtx, lens, instrument: state.instrument, source: inputSource, recording, grid, melody: state.melody });
  live.current = { gradeCtx, lens, instrument: state.instrument, source: inputSource, recording, grid, melody: state.melody };

  const selIdx = realized.findIndex((r) => r.slot.id === focusId);
  const focusIdx = state.playingSlot ?? (selIdx >= 0 ? selIdx : null);

  const midisFor = (i: number): number[] => {
    switch (state.instrument) {
      case 'guitar': return guitarCandidates[i][voicingIdx[i]]?.midis ?? [];
      case 'bass': return bassShapes[i].midis;
      case 'piano': return [pianoVoicings[i].lhMidi, ...pianoVoicings[i].midis].map((m) => m + 12 * state.octaveShift);
      case 'op1': return op1Voicings[i].midis.map((m) => m + 12 * state.octaveShift);
    }
  };

  /** Default voicings for chords that aren't on the bench (the "before" half of an A/B). */
  const voicedMidis = (chords: Chord[]): number[][] => {
    switch (state.instrument) {
      case 'guitar': {
        const cands = chords.map((c) => chordVoicings(c));
        const pick = chooseVoicingIndices(cands, { preferOpen: genre.preferOpen, position: genre.position });
        return cands.map((c, i) => c[pick[i]]?.midis ?? []);
      }
      case 'bass': return chords.map((c) => bassShape(c).midis);
      case 'piano': return chords.map((c) => {
        const v = pianoChordVoicing(c);
        return [v.lhMidi, ...v.midis].map((m) => m + 12 * state.octaveShift);
      });
      case 'op1': return chords.map((c) => op1ChordVoicing(c).midis.map((m) => m + 12 * state.octaveShift));
    }
  };

  /** Full harmony for demos — a bass shape alone can't show which voices move. */
  const harmonyMidis = (i: number): number[] =>
    (state.instrument === 'bass' ? [pianoVoicings[i].lhMidi, ...pianoVoicings[i].midis] : midisFor(i));

  const rootPcOf = (chord: Chord): number => notePc(chord.bass ?? chord.root);
  const playSlot = (i: number) => ({
    // "comp with these": the band plays the voice-led triads instead of the full grips
    midis: triadComp && triads.chosen[i] ? triads.chosen[i]!.midis : midisFor(i),
    bars: realized[i].slot.bars, rootPc: rootPcOf(realized[i].chord),
  });

  const grooveOpts = () => ({
    bpm: Math.max(40, Math.min(244, bpm)),
    swing: genre.swing,
    pattern: genre.pattern,
    instrument: state.instrument,
    backingVoice: practice.backing === 'same' ? undefined : practice.backing,
    drums: genre.drums,
    arp: genre.arp,
    meter,
  });

  const stopPlayback = () => {
    stopRef.current?.();
    stopRef.current = null;
    audio.stop();
    setLeadMidi(null);
    setPassInfo(null);
    setXferTag(null);
    setAb(null);
    setSongAt(null);
    setRecording(false);
    setQuiz((q) => q && { ...q, phase: null, at: null });
    songRef.current = false;
    dispatch({ type: 'playing', playing: false });
    dispatch({ type: 'playing-slot', idx: null });
  };

  /** A pass just ended: grade what was played over it, and (when recording) keep it as the melody. */
  const finishPass = (info: PassInfo) => {
    setPassInfo(info);
    const L = live.current;
    const take = takeRef.current;
    if (info.pass === 0 || !L.gradeCtx) return;
    const total = L.gradeCtx.totalBeats;
    const done = take.notes.filter((n) => n.pass < info.pass);
    take.notes = take.notes.filter((n) => n.pass >= info.pass);
    for (const n of done) if (take.open.get(n.midi) === n) n.dur = Math.max(0.25, total - n.beat);
    if (L.source === 'off') return;
    const played: MelNote[] = done.map(({ pass: _pass, ...n }) => n);
    const result = gradeTake(played, L.gradeCtx, L.lens);
    setGrade(result);
    if (played.length) {
      setScores((prev) => [...prev, result.score].slice(-16));
      setProgress((prev) => recordPass(prev, L.lens, result.score));
    }
    if (L.recording && played.length) {
      const fresh = quantize(played, L.grid, total).map((n) => ({ ...n, beat: Math.max(0, n.beat) }));
      const beats = new Set(fresh.map((n) => n.beat));
      dispatch({ type: 'melody', notes: sortNotes([...L.melody.filter((n) => n.locked && !beats.has(n.beat)), ...fresh]) });
      setRecording(false);
    }
  };

  const startPlayback = (force?: { countIn?: boolean }) => {
    stopRef.current?.();
    setAb(null);
    setXferTag(null);
    setSongAt(null);
    setQuiz((q) => q && { ...q, phase: null, at: null });
    songRef.current = false;
    takeRef.current = { notes: [], open: new Map() };
    const play = order ?? realized.map((_, i) => i);
    stopRef.current = audio.play(play.map(playSlot), {
      ...grooveOpts(),
      countIn: force?.countIn ?? practice.countIn,
      ramp: practice.ramp ? RAMP : undefined,
      modulate: order ? null : state.modulate, // a looped section stays put
      lead: () => leadRef.current,
      onSlot: (idx) => dispatch({ type: 'playing-slot', idx: idx === null ? null : play[idx] }),
      onLead: (midi) => { if (demoRef.current) setLeadMidi(midi); },
      onPass: finishPass,
    });
    dispatch({ type: 'playing', playing: true });
  };

  /** Before/after: the last version of the loop, then this one, same groove — hear what the spice did. */
  const startAB = () => {
    const prev = state.history[state.history.length - 1];
    if (!prev) return;
    stopRef.current?.();
    setPassInfo(null);
    setLeadMidi(null);
    const before: RealizedSlot[] = prev.slots.map((s) => ({ slot: s, chord: styleChord(s, realizeSlot(s, key).chord, genre) }));
    const beforeMidis = voicedMidis(before.map((r) => r.chord));
    const sig = (r: RealizedSlot) => `${r.slot.id}:${r.slot.numeral}:${r.slot.bars}`;
    const inBefore = new Set(before.map(sig));
    const inAfter = new Set(realized.map(sig));
    const nA = before.length;
    setAb({
      before: before.map((r) => ({ symbol: chordSymbol(r.chord), changed: !inAfter.has(sig(r)) })),
      after: realized.map((r) => ({ symbol: chordSymbol(r.chord), changed: !inBefore.has(sig(r)) })),
      side: 'A', idx: null,
    });
    const slots = [
      ...before.map((r, i) => ({ midis: beforeMidis[i], bars: r.slot.bars, rootPc: rootPcOf(r.chord) })),
      ...realized.map((_, i) => playSlot(i)),
    ];
    stopRef.current = audio.play(slots, {
      ...grooveOpts(),
      onSlot: (idx) => {
        if (idx === null) return;
        const side = idx < nA ? 'A' : 'B';
        setAb((cur) => cur && { ...cur, side, idx: side === 'A' ? idx : idx - nA });
        dispatch({ type: 'playing-slot', idx: side === 'B' ? idx - nA : null });
      },
    });
    dispatch({ type: 'playing', playing: true });
  };

  // the progression changing under playback stops it; practice edits restart the loop from the top
  const progSignature = `${state.genreId}|${state.mode}|${state.tonicIdx}|${state.slots.map((s) => `${s.id}:${s.bars}`).join(',')}|${state.instrument}|${bpm}`;
  const liveSignature = `${order?.join(',') ?? ''}|${practice.countIn}|${practice.ramp}|${practice.backing}|${demoOn ? `${lens}|${scaleIdx}|${lickSeed}|${state.octaveShift}|${position}|${triadsUp}` : ''}|${triadComp || (demoOn && triadsUp) ? triads.picks.join(',') + triadUpper + (triads.neck?.setIdx ?? '') : ''}`;
  const lastSig = useRef(progSignature);
  const lastLive = useRef(liveSignature);
  useEffect(() => {
    const progChanged = lastSig.current !== progSignature;
    const liveChanged = lastLive.current !== liveSignature;
    lastSig.current = progSignature;
    lastLive.current = liveSignature;
    if (!state.playing || songRef.current) return; // a song walks through sections on purpose
    if (progChanged) stopPlayback();
    else if (liveChanged && !ab && !quiz?.phase) startPlayback();
  });

  // a new set of chords invalidates anything that pointed at the old ones
  const slotIds = state.slots.map((s) => s.id).join(',');
  const seenSlots = useRef(slotIds);
  useEffect(() => {
    if (seenSlots.current === slotIds) return;
    seenSlots.current = slotIds;
    setLoopIdx(null);
    setXfer(pendingXfer.current);
    pendingXfer.current = null;
    if (focusLast.current) {
      focusLast.current = false;
      setFocusId(state.slots[state.slots.length - 1]?.id ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIds]);

  const strumCard = (i: number) => {
    audio.strum(midisFor(i), state.instrument);
  };

  /** Click = hear it and point the solo lab at it; shift-click = grow the practice loop. */
  const clickCard = (i: number, e: MouseEvent) => {
    if (e.shiftKey) {
      setLoopIdx((cur) => {
        if (cur && cur.length === 1 && cur[0] === i) return null;
        const all = [...(cur ?? []), i];
        const lo = Math.min(...all);
        const hi = Math.max(...all);
        return Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
      });
      return;
    }
    strumCard(i);
    setFocusId(realized[i].slot.id);
  };

  // --- transitions: the space between two cards ---
  const xferTo = xfer === null ? null : (xfer + 1) % realized.length;
  const xferInsight = useMemo(() => {
    if (xfer === null || xferTo === null || xfer >= liveRealized.length || liveRealized.length < 2) return null;
    return explainTransition(liveRealized[xfer].chord, liveRealized[xferTo].chord, {
      key: liveKey,
      distinctChords: new Set(state.slots.map((x) => x.numeral)).size,
      wrap: xferTo === 0,
    });
  }, [xfer, xferTo, liveRealized, liveKey, state.slots]);

  const hearTransition = () => {
    if (!xferInsight || xfer === null || xferTo === null) return;
    if (state.playing) stopPlayback();
    const demo = buildTransitionDemo(xferInsight, harmonyMidis(xfer), harmonyMidis(xferTo));
    audio.playSequence(demo.steps, state.instrument, (i) => setXferTag(i === null ? null : demo.tags[i]));
  };

  const loopingXfer = xfer !== null && xferTo !== null && !!order && order.length === 2 && order[0] === xfer && order[1] === xferTo;
  const loopTransition = () => {
    if (xfer === null || xferTo === null) return;
    setLoopIdx(loopingXfer ? null : [xfer, xferTo]);
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
    focusLast.current = true; // point the solo lab at the new chord, so its notes show up right away
    dispatch({
      type: 'add-numeral', numeral, spiceId: hook ? 'shelf' : undefined,
      log: hook ? entry(`Borrowed ${chordSymbol(chord)}`, `${chordSymbol(chord)} (${prettyNumeral(numeral)}): ${hook}.`) : undefined,
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
    // one section exports as the loop you hear; a song exports every section in order
    const song = state.sections.length > 1 ? flattenSong() : undefined;
    const slots = song?.slots ?? realized.map((r, i) => ({
      midis: midisFor(i),
      bars: r.slot.bars,
      rootPc: rootPcOf(r.chord),
    }));
    // with the crab in, the lead track carries both readings of the line
    const canon = crabOn && melodyCtx ? mirrorLead(toLead(state.melody), mirrorSpec(melodyCtx, state.melody, crabMode)) : [];
    const bytes = buildMidiFile(slots, {
      meter: song ? undefined : meter,
      modulate: song ? null : state.modulate,
      lead: song ? song.lead : demoOn && !order ? baseSolo?.lick : melodyOn ? [...toLead(state.melody), ...canon] : null,
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
      meter: state.meter,
      groups: state.groups,
      melody: state.melody,
      sections: savedSections(state),
      activeSection: state.activeSection,
      arrangement: state.arrangement,
      slots: state.slots.map((s) => ({
        numeral: s.numeral, bars: s.bars, annotation: s.annotation, spiceId: s.spiceId, pedalBass: s.pedalBass,
      })),
      summary: realized.map((r) => chordSymbol(r.chord)).join(' — '),
    };
    const next = [item, ...library].slice(0, 120);
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // while the keyboard is a piano, its note keys stop being shortcuts
      if (inputSource === 'qwerty' && e.code in QWERTY_MAP) return;
      switch (e.key) {
        case 'Escape': setXfer(null); setFocusId(null); break;
        case 'l': setDemoOn((on) => !on); break;
        case 'k': setCrabOn((on) => !on); break;
        case 'j': dispatch({ type: 'view', view: jam ? 'write' : 'jam' }); break;
        case 'b': setPractice((cur) => ({ ...cur, bass: !cur.bass })); break;
        case 'x': if (ab) stopPlayback(); else startAB(); break;
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- scale run + tab: the classic position box for whichever scale is up ---
  const scaleData = useMemo(() => {
    if (!baseSolo) return undefined;
    const { rootPc, pcs, name } = baseSolo;
    return {
      name,
      box: scaleBox(rootPc, pcs),
      bassBox: bassScaleBox(rootPc, pcs),
      op1Keys: op1ScaleKeys(rootPc, pcs),
      pianoKeys: pianoScaleKeys(rootPc, pcs),
    };
  }, [baseSolo]);

  const soloTips = useMemo(() => buildSoloTips(realized, key), [realized, key]);

  const playScale = () => {
    if (!scaleData) return;
    if (state.playing) stopPlayback();
    if (state.instrument === 'guitar') {
      const notes = [...scaleData.box].sort((a, b) => a.string - b.string || a.fret - b.fret);
      audio.playScale(notes.map((n) => OPEN_MIDI[n.string] + n.fret), 'guitar', Math.max(96, bpm));
    }
    else if (state.instrument === 'bass') {
      const notes = [...scaleData.bassBox].sort((a, b) => a.string - b.string || a.fret - b.fret);
      audio.playScale(notes.map((n) => BASS_OPEN_MIDI[n.string] + n.fret), 'bass', Math.max(96, bpm));
    }
    else if (state.instrument === 'piano') {
      const midis = scaleData.pianoKeys.map((k) => PIANO_BASE_MIDI + k.index + 12 * state.octaveShift);
      audio.playScale(midis, 'piano', Math.max(96, bpm));
    }
    else {
      const midis = scaleData.op1Keys.map((k) => OP1_BASE_MIDI + k.index + 12 * state.octaveShift);
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

  // --- play-along input: keyboard, MIDI or microphone, all onto the loop's clock ---
  const onPlayed = useRef<(midi: number, on: boolean, time: number) => void>(() => undefined);
  onPlayed.current = (midi, on, time) => {
    setHeld((cur) => (on ? [...cur.filter((m) => m !== midi), midi] : cur.filter((m) => m !== midi)));
    const L = live.current;
    const ctx = audio.context();
    const pos = audio.position(time - INPUT_LATENCY[L.source] - (ctx.outputLatency || 0));
    if (!pos || !L.gradeCtx) return;
    const total = L.gradeCtx.totalBeats;
    const take = takeRef.current;
    if (on) {
      // a hair before the loop point is a pickup into the next pass
      const early = pos.beat > total - 0.35;
      const note: TakeNote = {
        id: newNoteId(), midi: midi - pos.transpose, vel: 0.85, dur: 0.25,
        beat: early ? pos.beat - total : pos.beat, pass: early ? pos.pass + 1 : pos.pass,
      };
      take.notes.push(note);
      take.open.set(midi, note);
    }
    else {
      const note = take.open.get(midi);
      if (note) note.dur = Math.max(0.2, (pos.pass - note.pass) * total + pos.beat - note.beat);
      take.open.delete(midi);
    }
  };

  const isBass = state.instrument === 'bass';
  const qwertyLo = baseSolo?.range.lo ?? 60;
  useEffect(() => {
    setHeld([]);
    setInputStatus('');
    if (inputSource === 'off') return undefined;
    if (inputSource === 'qwerty') {
      const base = qwertyBase(qwertyLo);
      const down = new Set<string>();
      const typing = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      };
      const keyDown = (e: KeyboardEvent) => {
        if (!(e.code in QWERTY_MAP) || e.metaKey || e.ctrlKey || e.altKey || e.repeat || typing(e) || down.has(e.code)) return;
        e.preventDefault();
        down.add(e.code);
        const midi = base + QWERTY_MAP[e.code];
        audio.note(midi, live.current.instrument, 0.7);
        onPlayed.current(midi, true, audio.now());
      };
      const keyUp = (e: KeyboardEvent) => {
        if (!down.delete(e.code)) return;
        onPlayed.current(base + QWERTY_MAP[e.code], false, audio.now());
      };
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      setInputStatus('Z-row and Q-row are a piano (S D G H J = black keys)');
      return () => {
        window.removeEventListener('keydown', keyDown);
        window.removeEventListener('keyup', keyUp);
      };
    }
    let closed = false;
    let stop: (() => void) | undefined;
    if (inputSource === 'midi') {
      setInputStatus('Looking for MIDI…');
      void openMidiIn(
        (midi, on, _vel, stamp) => onPlayed.current(midi, on, audio.now() - (performance.now() - stamp) / 1000),
        (names) => setInputStatus(names.length ? `Listening to ${names.join(', ')}` : 'No MIDI device found — plug the OP-1 in over USB'),
      ).then((handle) => {
        if (!handle) setInputStatus('Web MIDI isn’t available here (the desktop shell and Safari don’t have it) — use the mic, or open the web build in Chrome.');
        else if (closed) handle.stop();
        else stop = handle.stop;
      });
    }
    else {
      setInputStatus('Asking for the microphone…');
      void openMic(audio.context(), {
        low: isBass,
        onNote: (midi, on, time) => onPlayed.current(midi, on, time),
        onLevel: (rms, midi) => setMicLevel({ rms, midi }),
      }).then((handle) => {
        if (!handle) setInputStatus('No microphone access — allow it in the browser / System Settings, or use the keyboard.');
        else if (closed) handle.stop();
        else {
          stop = handle.stop;
          setInputStatus('Listening — one note at a time. Headphones keep the backing out of the mic.');
        }
      });
    }
    return () => {
      closed = true;
      stop?.();
    };
  }, [inputSource, isBass, qwertyLo]);

  /** Capture one pass of playing into the melody: count-in, play, quantize, done. */
  const startRecording = () => {
    if (inputSource === 'off') setInputSource('qwerty');
    setLoopIdx(null);
    setDemoOn(false);
    setRecording(true);
    startPlayback({ countIn: true });
  };

  // --- melody edits ---
  const setMelody = (notes: MelNote[], undoable = true) => dispatch({ type: 'melody', notes: sortNotes(notes), undoable });

  /** One clicked (or fretted) note lands at the step cursor, and the cursor moves on. */
  const addStepNote = (midi: number, string?: number) => {
    if (!melodyCtx) return;
    const beat = Math.min(stepBeat, melodyCtx.totalBeats - grid);
    setMelody([
      ...state.melody.filter((n) => Math.abs(n.beat - beat) > 1e-6 || n.locked),
      { id: newNoteId(), beat, dur: grid, midi, vel: 0.85, string },
    ]);
    setStepBeat((beat + grid) % melodyCtx.totalBeats);
  };

  // --- what could come next, by intention ---
  const lastNumeral = state.slots[state.slots.length - 1]?.numeral;
  const nextOptions: NextOption[] = useMemo(
    () => nextChordOptions(lastNumeral, key, { sevenths: jazzyPalette }),
    [lastNumeral, key, jazzyPalette],
  );
  const addNextChord = (opt: NextOption) => {
    const styled = styleChord(fakeSlot(opt.numeral), opt.chord, genre);
    audio.strum(previewMidis(styled), state.instrument);
    focusLast.current = true;
    dispatch({
      type: 'add-numeral', numeral: opt.numeral, spiceId: opt.chord.func === 'borrowed' || opt.chord.func === 'secondary' ? 'shelf' : undefined,
      log: entry(`${chordSymbol(opt.chord)} — to ${opt.intent}`, opt.why),
    });
  };

  // --- chords under the melody: what else could sit beneath these notes? ---
  const slotStarts = useMemo(() => {
    const out: number[] = [];
    realized.reduce((at, r, i) => { out[i] = at; return at + r.slot.bars * perBar; }, 0);
    return out;
  }, [realized, perBar]);
  const slotAtBeat = (beat: number): number =>
    Math.max(0, slotStarts.reduce((hit, start, i) => (start <= beat + 1e-6 ? i : hit), 0));
  const harmonyFor = (slotIdx: number): HarmonyOption[] => {
    const r = realized[slotIdx];
    if (!r) return [];
    const from = slotStarts[slotIdx];
    const to = from + r.slot.bars * perBar;
    const weights = new Map<number, number>();
    for (const n of state.melody) {
      if (n.beat < from - 1e-6 || n.beat >= to - 1e-6) continue;
      const onBeat = Math.abs((n.beat - from) % 2) < 1e-6;
      weights.set(mod12(n.midi), (weights.get(mod12(n.midi)) ?? 0) + n.dur * (onBeat ? 2 : 1));
    }
    const melody: WeightedPc[] = [...weights].map(([pc, weight]) => ({ pc, weight }));
    return harmonizeOptions(melody, key, { limit: 8 }).filter((o) => o.numeral !== r.slot.numeral);
  };
  const reharmonize = (slotIdx: number, opt: HarmonyOption) => {
    const r = realized[slotIdx];
    if (!r) return;
    audio.strum(previewMidis(styleChord(fakeSlot(opt.numeral), opt.chord, genre)), state.instrument);
    dispatch({
      type: 'set-numeral', slotId: r.slot.id, numeral: opt.numeral,
      log: entry(`${chordSymbol(r.chord)} → ${chordSymbol(opt.chord)} under the same melody`, opt.why),
    });
  };

  // --- the crab canon: make the line agree with itself, or make the harmony a palindrome ---
  const crabProofNow = () => {
    if (!melodyCtx || !crabReport) return;
    const fixed = crabProof(state.melody, melodyCtx, crabMode);
    const moved = movedNotes(state.melody, fixed);
    const after = analyzeCanon(fixed, melodyCtx, crabMode).score;
    dispatch({
      type: 'melody', notes: sortNotes(fixed),
      log: entry(moved ? `Crab-proofed: ${moved} note${moved === 1 ? '' : 's'} moved` : 'Already crab-proof',
        moved
          ? `Each one now sits on a pitch that works over its own chord and over the chord its mirror lands on. The crab scores ${after} — it was ${crabReport.score}.`
          : `Every unlocked note already works in both directions; the crab scores ${crabReport.score}. Unlock a note, or move one by hand, and try again.`),
    });
  };
  const mirrorChords = () => dispatch({ type: 'mirror-slots' });

  // --- song: the sections in arrangement order, each in its own meter ---
  /** Every section in arrangement order: slots (each in its section's meter), who owns them, and the melodies end to end. */
  const flattenSong = () => {
    const sections = stash(state);
    const slots: { midis: number[]; bars: number; rootPc: number; meter?: Meter }[] = [];
    const owner: { arr: number; slot: number }[] = [];
    const lead: LeadNote[] = [];
    let at = 0;
    state.arrangement.forEach((secIdx, arr) => {
      const sec = sections[secIdx];
      if (!sec) return;
      const secMeter = sec.groups ? { groups: sec.groups } : undefined;
      const chords = sec.slots.map((x) => styleChord(x, realizeSlot(x, key).chord, genre));
      const midis = voicedMidis(chords);
      for (const n of sec.melody) lead.push({ beat: n.beat + at, dur: n.dur, midi: n.midi, vel: n.vel });
      sec.slots.forEach((x, i) => {
        slots.push({ midis: midis[i], bars: x.bars, rootPc: rootPcOf(chords[i]), meter: secMeter ?? { groups: [2, 2, 2, 2] } });
        owner.push({ arr, slot: i });
        at += x.bars * beatsPerBar(secMeter);
      });
    });
    return { slots, owner, lead: lead.sort((a, b) => a.beat - b.beat) };
  };

  const playSong = () => {
    stopRef.current?.();
    setAb(null);
    setPassInfo(null);
    const { slots, owner, lead } = flattenSong();
    if (!slots.length) return;
    songRef.current = true;
    leadRef.current = lead;
    const songLead = lead;
    stopRef.current = audio.play(slots, {
      ...grooveOpts(), meter: undefined,
      lead: () => songLead,
      onSlot: (idx) => {
        if (idx === null) return;
        const who = owner[idx];
        setSongAt(who.arr);
        dispatch({ type: 'section-select', idx: state.arrangement[who.arr] });
        dispatch({ type: 'playing-slot', idx: who.slot });
      },
      onLead: (midi) => { if (demoRef.current) setLeadMidi(midi); },
    });
    setSongAt(0);
    dispatch({ type: 'playing', playing: true });
  };

  // --- lessons ---
  const lesson: LessonStep | undefined = ALL_STEPS.find((x) => x.id === lessonId);
  const lessonDone = (id: string): boolean => progress.lessons.includes(id);
  const completeLesson = (id: string) => setProgress((prev) => recordLesson(prev, id));

  const startLesson = (step: LessonStep) => {
    if (state.playing) stopPlayback();
    const g = allGenres.find((x) => x.id === step.setup.genre) ?? genre;
    const mode = step.setup.mode ?? (step.setup.genre ? g.modes[0] : state.mode);
    pendingXfer.current = step.setup.xfer ?? null;
    if (!step.setup.prog) setXfer(step.setup.xfer ?? null);
    focusLast.current = false;
    dispatch({
      type: 'stage', genre: g, mode, view: step.setup.view, scale: step.setup.scale,
      template: step.setup.prog ? { mode, ...step.setup.prog } : undefined,
    });
    if (step.setup.lens) setLens(step.setup.lens);
    if (step.setup.instrument && state.instrument !== 'guitar' && state.instrument !== 'bass') dispatch({ type: 'instrument', id: step.setup.instrument });
    if (step.setup.labels) setLabelMode(step.setup.labels);
    setLastSprint(null);
    if (step.setup.drill) {
      setJamToolState('drills');
      setDrillKind(step.setup.drill);
    }
    else if (step.setup.triads) {
      setJamToolState('triads');
      setTriadMode(step.setup.triads.mode ?? 'close');
      setTriadUpper(!!step.setup.triads.upper);
      setTriadComp(!!step.setup.triads.comp);
      setTriadPins({});
    }
    else if (step.setup.view === 'jam') setJamToolState('solo');
    setDemoOn(!!step.setup.demo);
    setGrade(null);
    setLessonId(step.id);
  };

  // steps that can be measured finish themselves
  useEffect(() => {
    if (!lesson || lessonDone(lesson.id)) return;
    const goal = lesson.goal;
    if (goal.kind === 'score' && grade && lens === goal.lens && grade.score >= goal.min) completeLesson(lesson.id);
    if (goal.kind === 'coach' && melodyReport && melodyReport.noteCount >= goal.notes && melodyReport.landings.every((l) => l.hit)) completeLesson(lesson.id);
    if (goal.kind === 'quiz' && quizStreak >= goal.streak) completeLesson(lesson.id);
    if (goal.kind === 'fret' && lastSprint && lastSprint.kind === goal.drill && lastSprint.score >= goal.min) completeLesson(lesson.id);
    if (goal.kind === 'crab' && crabReport && crabReport.score >= goal.min && crabReport.together >= 0.25) completeLesson(lesson.id);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // a drill needs a chord in focus to mean anything
  useEffect(() => {
    if (lens !== 'map' && focusIdx === null && realized.length) setFocusId(realized[0].slot.id);
  }, [lens, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- ear quiz: which chord changed? ---
  const playQuiz = (round: EarRound) => {
    stopRef.current?.();
    setAb(null);
    setPassInfo(null);
    const n = round.before.length;
    const chordsOf = (list: Slot[]) => list.map((x) => styleChord(x, realizeSlot(x, key).chord, genre));
    const both = [...chordsOf(round.before), ...chordsOf(round.after)];
    const midis = voicedMidis(both);
    const slots = both.map((c, i) => ({ midis: midis[i], bars: (i < n ? round.before : round.after)[i % n].bars, rootPc: rootPcOf(c) }));
    songRef.current = true; // keep the transport effects from restarting this one-shot
    stopRef.current = audio.play(slots, {
      ...grooveOpts(), meter: undefined, lead: () => null, maxPasses: 1,
      onSlot: (idx) => setQuiz((q) => (q && idx !== null ? { ...q, phase: idx < n ? 'A' : 'B', at: idx % n } : q)),
      onEnd: () => {
        songRef.current = false;
        setQuiz((q) => q && { ...q, phase: null, at: null });
        dispatch({ type: 'playing', playing: false });
      },
    });
    dispatch({ type: 'playing', playing: true });
  };

  const newQuizRound = () => {
    const round = buildEarRound(
      genre.templates.filter((t) => t.mode === state.mode),
      (t) => t.numerals.map((num, i) => newSlot(num, Math.min(1, t.bars?.[i] ?? 1))),
      ctx, genre.spices.filter((x) => x !== 'truck-driver'),
    );
    if (!round) {
      setQuiz(null);
      return false;
    }
    const symbols = (list: Slot[]) => list.map((x) => chordSymbol(styleChord(x, realizeSlot(x, key).chord, genre)));
    setQuiz({ round, before: symbols(round.before), after: symbols(round.after), phase: null, at: null, answered: null });
    playQuiz(round);
    return true;
  };

  const answerQuiz = (idx: number) => {
    if (!quiz || quiz.answered !== null) return;
    setQuiz({ ...quiz, answered: idx });
    setQuizStreak((n) => (idx === quiz.round.changed ? n + 1 : 0));
  };

  // --- resume where you left off ---
  const sessionSig = `${state.tonicIdx}|${state.genreId}|${state.mode}|${state.instrument}|${state.octaveShift}|${state.bpm}|${state.view}|${state.scaleIdx}|${state.activeSection}|${state.arrangement.join(',')}`;
  useEffect(() => {
    const timer = window.setTimeout(() => saveSession({
      tonicIdx: state.tonicIdx, genreId: state.genreId, mode: state.mode, instrument: state.instrument,
      octaveShift: state.octaveShift, bpm: state.bpm, view: state.view, scaleIdx: state.scaleIdx,
      activeSection: state.activeSection, arrangement: state.arrangement, sections: savedSections(state),
    }), 400);
    return () => window.clearTimeout(timer);
  }, [sessionSig, state.slots, state.melody, state.sections]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state, dispatch, genre, allGenres, key, liveKey, preferFlat, realized, liveRealized, meter, perBar, bpm,
    guitarCandidates, voicingIdx, op1Voicings, pianoVoicings, bassShapes, cardApps,
    palette, shelf, jazzyPalette, templatesForMode, recs, scaleIdx, rec, scaleData, soloTips,
    // neck drills + how diagrams are labelled
    drillKind, setDrillKind, lastSprint, finishSprint, labelMode, setLabelMode,
    // triad lab
    jamTool, setJamTool, triads: liveTriads, triadMode, setTriadMode, triadUpper, setTriadUpper, triadComp, setTriadComp,
    setTriadSet, triadPins, setTriadPins,
    // solo lab
    baseSolo, liveSolo, writeSolo, lens, setLens, demoOn, setDemoOn, lickSeed, setLickSeed, both, setBoth, jam,
    leadMidi, focusIdx, selIdx, setFocusId, positions, position, setPosition, lefty, setLefty,
    // transport + practice
    practice, setPractice, passInfo, order, setLoopIdx, transposeNow, modulatedPreview,
    startPlayback, stopPlayback, playScale, strumCard, clickCard,
    ab, startAB, xfer, setXfer, xferTag, setXferTag, xferInsight, hearTransition, loopTransition, loopingXfer,
    // write
    melodyCtx, melodyReport, melodyOn, setMelodyOn, setMelody, grid, setGrid, recording, startRecording,
    stepEntry, setStepEntry, stepBeat, setStepBeat, addStepNote,
    playSong, songAt, nextOptions, addNextChord, harmonyFor, reharmonize, slotAtBeat, slotStarts,
    // the crab canon
    melodyLead, loopBeats, crabOn, setCrabOn, crabMode, setCrabMode, crabReport, crabLead, crabProofNow, mirrorChords,
    // listening
    inputSource, setInputSource, inputStatus, held, micLevel, grade, scores, progress,
    // learn
    lesson, lessonId, setLessonId, startLesson, completeLesson, lessonDone, quiz, quizStreak, newQuizRound, answerQuiz,
    replayQuiz: () => { if (quiz) playQuiz(quiz.round); },
    // editing
    spiceItUp, composeNow, cycleBars, asStep, addPaletteChord, fakeSlot, midisFor, harmonyMidis,
    copied, copyText, copyTab, copyBassTab, copyChart, exportMidi, saveToLibrary,
    // chrome
    modal, setModal, labEditing, setLabEditing, customGenres, journal,
    composeSettings, setComposeSettings, saveCustomGenre, deleteCustomGenre, library, setLibrary,
  };
}

export type AppApi = ReturnType<typeof useAppController>;
