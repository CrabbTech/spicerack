// Import/export of scores as JSON, so a transcription can be pasted into the
// running app (kept in localStorage) before it is committed as a data file.

import { MODE_NAMES, ModeId } from '../theory/harmony';
import { FIGURE_IDS } from './figures';
import { Bar, FigureId, NoteEvent, SCORE_SCHEMA, Score, Section } from './types';

export type ParseResult = { ok: true; score: Score } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

function readEvents(raw: unknown, where: string, errors: string[]): NoteEvent[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) { errors.push(`${where} must be a list of notes`); return undefined; }
  const out: NoteEvent[] = [];
  raw.forEach((item, i) => {
    if (!isObj(item) || typeof item.note !== 'string') {
      errors.push(`${where}[${i}] needs a "note" like "Db3"`);
      return;
    }
    out.push({
      note: item.note,
      beat: Number(item.beat ?? 0),
      dur: Number(item.dur ?? 0.5),
      ...(item.ghost === true ? { ghost: true } : {}),
    });
  });
  return out;
}

function readBar(raw: unknown, where: string, errors: string[]): Bar | undefined {
  if (!isObj(raw) || typeof raw.chord !== 'string' || !raw.chord.trim()) {
    errors.push(`${where} needs a "chord" like "Bbm7/Db" or "vi7"`);
    return undefined;
  }
  const figure = typeof raw.figure === 'string' ? raw.figure as FigureId : undefined;
  if (figure && !FIGURE_IDS.includes(figure)) {
    errors.push(`${where}: unknown figure "${figure}" (try ${FIGURE_IDS.join(', ')})`);
  }
  return {
    chord: raw.chord.trim(),
    ...(typeof raw.bass === 'string' && raw.bass.trim() ? { bass: raw.bass.trim() } : {}),
    ...(raw.beats !== undefined ? { beats: Number(raw.beats) } : {}),
    ...(raw.ending !== undefined ? { ending: Number(raw.ending) } : {}),
    ...(typeof raw.mark === 'string' ? { mark: raw.mark } : {}),
    ...(figure && FIGURE_IDS.includes(figure) ? { figure } : {}),
    melody: readEvents(raw.melody, `${where}.melody`, errors),
    left: readEvents(raw.left, `${where}.left`, errors),
  };
}

function readSection(raw: unknown, index: number, errors: string[]): Section | undefined {
  if (!isObj(raw)) { errors.push(`sections[${index}] must be an object`); return undefined; }
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `SECTION ${index + 1}`;
  const bars = Array.isArray(raw.bars)
    ? raw.bars.map((b, i) => readBar(b, `sections[${index}].bars[${i}]`, errors)).filter((b): b is Bar => !!b)
    : [];
  if (!bars.length) errors.push(`sections[${index}] ("${name}") has no bars`);
  const figure = typeof raw.figure === 'string' ? raw.figure as FigureId : undefined;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : slug(name),
    name,
    ...(raw.repeat !== undefined ? { repeat: Number(raw.repeat) } : {}),
    ...(raw.octaveShift !== undefined ? { octaveShift: Number(raw.octaveShift) } : {}),
    ...(figure && FIGURE_IDS.includes(figure) ? { figure } : {}),
    ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
    bars,
  };
}

/** Validate an untrusted score object (pasted JSON) into a Score. */
export function readScore(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['the score must be a JSON object'] };
  if (typeof raw.title !== 'string' || !raw.title.trim()) errors.push('missing "title"');
  const key = isObj(raw.key) ? raw.key : {};
  const tonic = typeof key.tonic === 'string' ? key.tonic : '';
  const mode = typeof key.mode === 'string' ? key.mode : '';
  if (!tonic) errors.push('missing "key.tonic" (e.g. "Db")');
  if (!(mode in MODE_NAMES)) errors.push(`"key.mode" must be one of ${Object.keys(MODE_NAMES).join(', ')}`);
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((s, i) => readSection(s, i, errors)).filter((s): s is Section => !!s)
    : [];
  if (!sections.length) errors.push('a score needs at least one section with bars');
  if (errors.length) return { ok: false, errors };

  const title = (raw.title as string).trim();
  const meter = Array.isArray(raw.meter) && raw.meter.length === 2
    ? [Number(raw.meter[0]), Number(raw.meter[1])] as [number, number]
    : undefined;
  return {
    ok: true,
    score: {
      schema: SCORE_SCHEMA,
      id: typeof raw.id === 'string' && raw.id ? raw.id : slug(title),
      title,
      ...(typeof raw.artist === 'string' ? { artist: raw.artist } : {}),
      ...(typeof raw.source === 'string' ? { source: raw.source } : {}),
      key: { tonic, mode: mode as ModeId },
      bpm: Number(raw.bpm) > 0 ? Number(raw.bpm) : 96,
      ...(typeof raw.feel === 'string' ? { feel: raw.feel } : {}),
      ...(meter ? { meter } : {}),
      ...(raw.octaveShift !== undefined ? { octaveShift: Number(raw.octaveShift) } : {}),
      ...(typeof raw.image === 'string' && raw.image ? { image: raw.image } : {}),
      ...(Array.isArray(raw.caveats) ? { caveats: raw.caveats.filter((c): c is string => typeof c === 'string') } : {}),
      sections,
    },
  };
}

export function parseScoreJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  }
  catch (err) {
    return { ok: false, errors: [`not valid JSON — ${(err as Error).message}`] };
  }
  return readScore(raw);
}

export const scoreToJson = (score: Score): string =>
  JSON.stringify({ schema: SCORE_SCHEMA, ...score }, null, 2);

/** A skeleton to paste over, shown in the import panel. */
export const SCORE_TEMPLATE = `{
  "id": "my-song",
  "title": "My Song",
  "artist": "",
  "source": "screenshot, YYYY-MM-DD",
  "key": { "tonic": "C", "mode": "major" },
  "bpm": 96,
  "feel": "Laid-back",
  "meter": [4, 4],
  "octaveShift": 0,
  "caveats": ["what is read off the page vs. inferred"],
  "sections": [
    {
      "name": "INTRO",
      "repeat": 2,
      "figure": "up-down-8ths",
      "bars": [
        { "chord": "C" },
        { "chord": "Am7/C" },
        { "chord": "F", "melody": [{ "beat": 0, "dur": 1, "note": "G5" }] },
        { "chord": "G7", "ending": 1 }
      ]
    }
  ]
}`;
