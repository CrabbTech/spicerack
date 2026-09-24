// The document and its edits: one reducer owns the progression, its undo
// history and the handful of UI choices that have to survive a re-render.

import { mod12, noteLabel, notePc, simplify, spellPcSimple } from '../theory/notes';
import { MelNote, reserveNoteIds } from '../theory/melody';
import { SavedSession, loadSession } from './session';
import { SavedSection } from '../ui/LibraryModal';
import { Key, ModeId, TONIC_CHOICES } from '../theory/scales';
import { Chord, QUALITIES, chordSymbol } from '../theory/chords';
import { resolveNumeral } from '../theory/roman';
import { RealizedSlot, Slot, newSlot } from '../theory/progression';
import { ProgressionPatch, SPICES, SpiceId } from '../theory/spices';
import { ComposedResult } from '../theory/compose';
import { mirrorSlots, slotsArePalindrome } from '../theory/crab';
import { GENRES, GENRE_LIST, Genre, GenreId, ProgressionTemplate, pickTemplate } from '../data/genres';
import { loadCustomGenres, materializeGenre } from '../data/customGenres';
import { InstrumentId } from '../audio/engine';
import { SavedProgression } from '../ui/LibraryModal';

// --- state -----------------------------------------------------------------

export interface LogEntry {
  id: number;
  icon: string;
  title: string;
  text: string;
  kind: 'spice' | 'info';
}

export interface Snapshot {
  slots: Slot[];
  modulate: number | null;
  melody: MelNote[];
}

/** One part of the song — a verse, a chorus — with its own chords and melody. */
export interface SectionData {
  name: string;
  templateName: string;
  templateNote?: string;
  meter?: string;
  groups?: number[];
  slots: Slot[];
  baseSlots: Slot[];
  modulate: number | null;
  melody: MelNote[];
}

export type ViewId = 'learn' | 'jam' | 'write';

export interface AppState {
  tonicIdx: number;
  genreId: string;
  mode: ModeId;
  instrument: InstrumentId;
  octaveShift: number;
  templateName: string;
  templateNote?: string;
  meter?: string;
  /** accent groups (eighths) when the template is in an odd meter */
  groups?: number[];
  slots: Slot[];
  baseSlots: Slot[];
  modulate: number | null;
  /** the active section's melody, in beats from the top of the section */
  melody: MelNote[];
  /** every section of the song; the active one's entry goes stale while it is on the bench (see stash) */
  sections: SectionData[];
  activeSection: number;
  /** section indexes in song order, e.g. A A B A = [0, 0, 1, 0] */
  arrangement: number[];
  view: ViewId;
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

export interface SpiceStep {
  spiceId: SpiceId;
  spiceName: string;
  explanation: string;
  patch: ProgressionPatch;
}

const pushHistory = (state: AppState): Snapshot[] =>
  [...state.history, { slots: state.slots, modulate: state.modulate, melody: state.melody }].slice(-40);

/** The bench's working copy, written back into the section list. */
export function stash(state: AppState): SectionData[] {
  return state.sections.map((sec, i) => (i === state.activeSection ? {
    name: sec.name, templateName: state.templateName, templateNote: state.templateNote, meter: state.meter,
    groups: state.groups, slots: state.slots, baseSlots: state.baseSlots, modulate: state.modulate, melody: state.melody,
  } : sec));
}

/** Sections in their storable form (slot ids are per-session, so they are dropped). */
export const savedSections = (state: AppState): SavedSection[] => stash(state).map((sec) => ({
  name: sec.name, templateName: sec.templateName, templateNote: sec.templateNote, meter: sec.meter, groups: sec.groups,
  modulate: sec.modulate, melody: sec.melody,
  slots: sec.slots.map((x) => ({ numeral: x.numeral, bars: x.bars, annotation: x.annotation, spiceId: x.spiceId, pedalBass: x.pedalBass })),
}));

/** Stored sections back on the bench, with fresh slot ids. */
function reviveSections(saved: SavedSection[]): SectionData[] {
  return saved.map((sec) => {
    const slots = sec.slots.map((x) => newSlot(x.numeral, x.bars, { annotation: x.annotation, spiceId: x.spiceId, pedalBass: x.pedalBass }));
    reserveNoteIds(sec.melody ?? []);
    return { ...sec, melody: sec.melody ?? [], slots, baseSlots: slots };
  });
}

const unstash = (sec: SectionData) => ({
  templateName: sec.templateName, templateNote: sec.templateNote, meter: sec.meter, groups: sec.groups,
  slots: sec.slots, baseSlots: sec.baseSlots, modulate: sec.modulate, melody: sec.melody,
  history: [] as Snapshot[], voicingSel: {}, lastSpiceId: undefined,
});

const SECTION_NAMES = 'ABCDEFGH';

let logId = 1;
export const entry = (icon: string, title: string, text: string, kind: LogEntry['kind'] = 'info'): LogEntry =>
  ({ id: logId++, icon, title, text, kind });

function progressionFrom(t: ProgressionTemplate) {
  return {
    templateName: t.name,
    templateNote: t.note,
    meter: t.meter,
    groups: t.groups,
    slots: t.numerals.map((n, i) => newSlot(n, t.bars?.[i] ?? 1)),
  };
}

const freshProgression = (genre: Genre, mode: ModeId, avoidName?: string) =>
  progressionFrom(pickTemplate(genre, mode, avoidName));

/** Deep-linked progression, e.g. "I,iv,V7,IV" — bad numerals fall back to a template. */
function progParam(raw: string | null, mode: ModeId) {
  if (!raw) return undefined;
  const numerals = raw.split(',').map((n) => n.trim()).filter(Boolean);
  try {
    numerals.forEach((n) => resolveNumeral(n, { tonic: TONIC_CHOICES[0], mode }));
  }
  catch {
    return undefined;
  }
  return numerals.length >= 2 ? progressionFrom({ name: 'Linked progression', mode, numerals }) : undefined;
}

export const linkParam = (name: string): string | null => new URLSearchParams(window.location.search).get(name);

export type Action =
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
  | { type: 'load-save'; item: SavedProgression; genre: Genre }
  | { type: 'set-numeral'; slotId: number; numeral: string; log?: LogEntry }
  | { type: 'melody'; notes: MelNote[]; undoable?: boolean; log?: LogEntry }
  /** the crab canon's palindrome: the progression comes back the way it went */
  | { type: 'mirror-slots' }
  | { type: 'stage'; genre: Genre; mode: ModeId; template?: ProgressionTemplate; view: ViewId; scale?: number }
  | { type: 'view'; view: ViewId }
  | { type: 'section-add'; copy: boolean; genre: Genre }
  | { type: 'section-select'; idx: number }
  | { type: 'section-rename'; idx: number; name: string }
  | { type: 'section-remove'; idx: number }
  | { type: 'arrangement'; order: number[] };

export const INSTRUMENTS: InstrumentId[] = ['guitar', 'bass', 'piano', 'op1'];

/** Rebuild the last session; any surprise in the stored data falls back to a fresh start. */
function resume(session: SavedSession, params: URLSearchParams): AppState | undefined {
  try {
    const genre = GENRE_LIST.find((g) => g.id === session.genreId) ?? loadCustomGenres().map(materializeGenre).find((g) => g.id === session.genreId);
    if (!genre) return undefined;
    const mode = session.mode as ModeId;
    session.sections.forEach((sec) => sec.slots.forEach((x) => resolveNumeral(x.numeral, { tonic: TONIC_CHOICES[0], mode })));
    const sections = reviveSections(session.sections);
    const active = Math.min(Math.max(0, session.activeSection), sections.length - 1);
    return {
      tonicIdx: Math.min(11, Math.max(0, session.tonicIdx)),
      genreId: genre.id, mode,
      instrument: INSTRUMENTS.find((x) => x === session.instrument) ?? 'guitar',
      octaveShift: session.octaveShift ?? 0,
      ...unstash(sections[active]),
      sections, activeSection: active,
      arrangement: session.arrangement.filter((i) => i < sections.length).length ? session.arrangement.filter((i) => i < sections.length) : [0],
      view: (['learn', 'jam', 'write'] as const).find((v) => v === (params.get('view') ?? session.view)) ?? 'write',
      heat: 2,
      log: [entry('🦀', 'Welcome back', 'Your song is where you left it — every section, chord and melody note. Hit play, or pick up a lesson in Learn.')],
      scaleIdx: session.scaleIdx ?? 0,
      playingSlot: null, playing: false, muted: false, drumsOn: true,
      bpm: session.bpm ?? null,
    };
  }
  catch {
    return undefined;
  }
}

export function init(): AppState {
  // optional deep-link params: ?genre=neo-soul&tonic=Eb&instrument=piano&prog=I,iv,V7,IV
  // (more for debugging/screenshots: &modulate=2 and the solo lab's &focus=1&lens=thirds&both=1&xfer=0&scale=1&jam=1)
  const params = new URLSearchParams(window.location.search);
  const genreParam = params.get('genre') as GenreId | null;
  const genre = (genreParam && GENRES[genreParam]) || GENRES['classic-rock'];
  const mode = genre.modes[0];
  const tonicParam = params.get('tonic');
  const tonicIdx = Math.max(0, TONIC_CHOICES.findIndex(
    (t) => noteLabel(t).replace('♭', 'b').replace('♯', '#') === (tonicParam ?? 'A')));
  const fresh = progParam(params.get('prog'), mode) ?? freshProgression(genre, mode);
  const deepLinked = ['genre', 'prog', 'tonic', 'instrument'].some((k) => params.has(k));
  const session = deepLinked ? null : loadSession();
  const resumed = session && resume(session, params);
  if (resumed) return resumed;
  return {
    tonicIdx,
    genreId: genre.id,
    mode,
    instrument: INSTRUMENTS.find((x) => x === params.get('instrument')) ?? 'guitar',
    octaveShift: 0,
    ...fresh,
    baseSlots: fresh.slots,
    modulate: Number(params.get('modulate')) || null,
    melody: [],
    sections: [{ name: 'A', ...fresh, baseSlots: fresh.slots, modulate: null, melody: [] }],
    activeSection: 0,
    arrangement: [0],
    view: (['learn', 'jam', 'write'] as const).find((v) => v === params.get('view')) ?? 'write',
    history: [],
    heat: 2,
    log: [
      entry(genre.emoji, genre.name, genre.tip),
      entry('👋', 'Welcome to the rack', 'Pick a key and a genre, roll new progressions, then hit “Spice it up” — every trick gets explained right here. Click any chord to hear it.'),
    ],
    voicingSel: {},
    scaleIdx: Number(params.get('scale')) || 0,
    playingSlot: null,
    playing: false,
    muted: false,
    drumsOn: true,
    bpm: null,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'tonic': {
      // melodies follow the key: shift by the smaller way round
      let delta = notePc(TONIC_CHOICES[action.idx]) - notePc(TONIC_CHOICES[state.tonicIdx]);
      if (delta > 6) delta -= 12;
      if (delta < -6) delta += 12;
      const shift = (notes: MelNote[]) => notes.map((n) => ({ ...n, midi: n.midi + delta }));
      return {
        ...state, tonicIdx: action.idx, melody: shift(state.melody),
        sections: state.sections.map((sec) => ({ ...sec, melody: shift(sec.melody) })),
      };
    }
    case 'genre': {
      if (action.genre.id === state.genreId) return state;
      const genre = action.genre;
      const mode = genre.modes[0];
      const fresh = freshProgression(genre, mode);
      return {
        ...state, genreId: genre.id, mode, ...fresh, baseSlots: fresh.slots,
        modulate: null, melody: [], history: [], voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined, bpm: null,
        log: [entry(genre.emoji, genre.name, genre.tip), ...state.log].slice(0, 40),
      };
    }
    case 'mode': {
      if (action.mode === state.mode) return state;
      const fresh = freshProgression(action.genre, action.mode);
      return {
        ...state, mode: action.mode, ...fresh, baseSlots: fresh.slots,
        modulate: null, melody: [], history: [], voicingSel: {}, scaleIdx: 0, lastSpiceId: undefined,
      };
    }
    case 'new-progression': {
      const fresh = freshProgression(action.genre, state.mode, state.templateName);
      return {
        ...state, ...fresh, baseSlots: fresh.slots,
        modulate: null, melody: [], history: [], voicingSel: {}, lastSpiceId: undefined,
      };
    }
    case 'pick-template': {
      const fresh = progressionFrom(action.template);
      return {
        ...state, ...fresh, baseSlots: fresh.slots,
        modulate: null, melody: [], history: [], voicingSel: {}, lastSpiceId: undefined,
      };
    }
    case 'compose': {
      const slots = action.result.numerals.map((n, i) => newSlot(n, action.result.bars[i] ?? 1));
      return {
        ...state,
        templateName: action.result.name,
        templateNote: action.result.planText,
        meter: undefined,
        groups: undefined,
        slots, baseSlots: slots,
        modulate: null, melody: [], history: [], voicingSel: {}, lastSpiceId: undefined,
        log: [entry('✨', `Composed: ${action.result.name}`, action.result.planText, 'spice'), ...state.log].slice(0, 40),
      };
    }
    case 'load-save': {
      const slots = action.item.slots.map((s) =>
        newSlot(s.numeral, s.bars, { annotation: s.annotation, spiceId: s.spiceId, pedalBass: s.pedalBass }));
      reserveNoteIds(action.item.melody ?? []);
      return {
        ...state,
        genreId: action.genre.id,
        mode: (action.item.mode as ModeId) ?? action.genre.modes[0],
        tonicIdx: action.item.tonicIdx,
        templateName: action.item.name,
        templateNote: undefined,
        meter: action.item.meter,
        groups: action.item.groups,
        slots,
        baseSlots: slots,
        modulate: action.item.modulate,
        melody: action.item.melody ?? [],
        sections: action.item.sections?.length
          ? reviveSections(action.item.sections)
          : [{ name: 'A', templateName: action.item.name, slots, baseSlots: slots, modulate: action.item.modulate, melody: action.item.melody ?? [] }],
        activeSection: action.item.sections?.length ? Math.min(action.item.activeSection ?? 0, action.item.sections.length - 1) : 0,
        arrangement: action.item.arrangement?.length ? action.item.arrangement : [0],
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
        ...state, slots: prev.slots, modulate: prev.modulate, melody: prev.melody,
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
    case 'set-numeral':
      return {
        ...state,
        history: pushHistory(state),
        slots: state.slots.map((x) => (x.id === action.slotId ? { ...x, numeral: action.numeral, spiceId: 'reharm', annotation: undefined, pedalBass: undefined } : x)),
        voicingSel: {},
        log: action.log ? [action.log, ...state.log].slice(0, 40) : state.log,
      };
    case 'melody':
      return {
        ...state, melody: action.notes, history: action.undoable === false ? state.history : pushHistory(state),
        log: action.log ? [action.log, ...state.log].slice(0, 40) : state.log,
      };
    case 'mirror-slots': {
      if (slotsArePalindrome(state.slots)) return state;
      const slots = mirrorSlots(state.slots);
      const key: Key = { tonic: TONIC_CHOICES[state.tonicIdx], mode: state.mode };
      const symbols = (list: Slot[]) => list.map((s) => chordSymbol(resolveNumeral(s.numeral, key))).join(' — ');
      return {
        ...state, slots,
        history: pushHistory(state), voicingSel: {},
        templateName: state.templateName.endsWith(' (mirrored)') ? state.templateName : `${state.templateName} (mirrored)`,
        log: [entry('🪞', 'Mirrored the chords', `${symbols(state.slots)} → ${symbols(slots)}. The harmony now reads the same from either end, so a line that fits going forward fits going back — the ground every crab canon stands on. Your melody stays in the first half; write into the second and the two voices meet.`, 'spice'), ...state.log].slice(0, 40),
      };
    }
    case 'view':
      return { ...state, view: action.view };
    case 'stage': {
      // a lesson sets the bench: genre, mode and (when it brings one) a progression
      const fresh = action.template ? progressionFrom(action.template) : undefined;
      return {
        ...state, genreId: action.genre.id, mode: action.mode, view: action.view,
        scaleIdx: action.scale ?? state.scaleIdx, bpm: action.genre.id === state.genreId ? state.bpm : null,
        ...(fresh ? { ...fresh, baseSlots: fresh.slots, modulate: null, melody: [], history: [], voicingSel: {}, lastSpiceId: undefined } : {}),
      };
    }
    case 'section-add': {
      if (state.sections.length >= SECTION_NAMES.length) return state;
      const sections = stash(state);
      const name = SECTION_NAMES[sections.length];
      const next: SectionData = action.copy
        ? { ...sections[state.activeSection], name }
        : { name, ...freshProgression(action.genre, state.mode, state.templateName), baseSlots: [], modulate: null, melody: [] };
      if (!action.copy) next.baseSlots = next.slots;
      // a copy needs its own slot ids so edits and loops never cross between sections
      if (action.copy) {
        next.slots = next.slots.map((x) => newSlot(x.numeral, x.bars, { annotation: x.annotation, spiceId: x.spiceId, pedalBass: x.pedalBass }));
        next.baseSlots = next.slots;
        next.melody = next.melody.map((n) => ({ ...n }));
      }
      return {
        ...state, ...unstash(next),
        sections: [...sections, next], activeSection: sections.length,
        arrangement: [...state.arrangement, sections.length],
        log: [entry('🧩', `Section ${name}`, action.copy
          ? `A copy of ${sections[state.activeSection].name} to vary — change one thing (an ending, a chord, the melody's peak) and you have a second verse.`
          : `A fresh part for contrast. If ${sections[state.activeSection].name} sits on the tonic, let this one start somewhere else.`), ...state.log].slice(0, 40),
      };
    }
    case 'section-select': {
      if (action.idx === state.activeSection || !state.sections[action.idx]) return state;
      const sections = stash(state);
      return { ...state, ...unstash(sections[action.idx]), sections, activeSection: action.idx };
    }
    case 'section-rename':
      return { ...state, sections: state.sections.map((sec, i) => (i === action.idx ? { ...sec, name: action.name } : sec)) };
    case 'section-remove': {
      if (state.sections.length <= 1) return state;
      const sections = stash(state).filter((_, i) => i !== action.idx);
      const active = Math.min(state.activeSection > action.idx ? state.activeSection - 1 : state.activeSection, sections.length - 1);
      const arrangement = state.arrangement.filter((i) => i !== action.idx).map((i) => (i > action.idx ? i - 1 : i));
      return {
        ...state, ...unstash(sections[active]), sections, activeSection: active,
        arrangement: arrangement.length ? arrangement : [0],
      };
    }
    case 'arrangement':
      return { ...state, arrangement: action.order.length ? action.order : [state.activeSection] };
  }
}

/** Genre styling: thrash/pop-punk render plain triads as power chords. */
export function styleChord(slot: Slot, chord: Chord, genre: Genre): Chord {
  const convert =
    genre.powerChords === 'all' || (genre.powerChords === 'plain' && !slot.spiceId);
  if (convert && (chord.quality.id === 'maj' || chord.quality.id === 'min')) {
    return { ...chord, quality: QUALITIES.pow };
  }
  return chord;
}

/** Context-aware soloing tips derived from what's actually in the progression. */
export function buildSoloTips(realized: RealizedSlot[], key: Key): string[] {
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

