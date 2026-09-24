// Genre Lab: build your own genre. Templates are typed one per line as
//   Name | mode | numerals | optional note
// and validated live against the numeral parser.

import { useMemo, useState } from 'react';
import { ModeId } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { SPICES, SpiceId } from '../theory/spices';
import { GENRES, GENRE_LIST, GenreId, ProgressionTemplate } from '../data/genres';
import { CustomGenreData, newCustomId } from '../data/customGenres';

export interface GenreLabProps {
  editing?: CustomGenreData;
  onSave: (data: CustomGenreData) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const MODES: ModeId[] = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian'];

interface TemplateLineResult {
  line: string;
  template?: ProgressionTemplate;
  error?: string;
}

function parseTemplateLine(line: string): TemplateLineResult {
  const trimmed = line.trim();
  if (!trimmed) return { line };
  const parts = trimmed.split('|').map((p) => p.trim());
  if (parts.length < 3) return { line, error: 'need: Name | mode | numerals' };
  const [name, modeRaw, numeralsRaw, note] = parts;
  const mode = modeRaw.toLowerCase() as ModeId;
  if (!MODES.includes(mode)) return { line, error: `unknown mode "${modeRaw}" (major, minor, dorian, phrygian, lydian, mixolydian)` };
  const numerals = numeralsRaw.split(/[\s,–—-]+/).filter(Boolean);
  if (!numerals.length) return { line, error: 'no chords given' };
  for (const n of numerals) {
    try {
      resolveNumeral(n, { tonic: { letter: 'C', alter: 0 }, mode });
    }
    catch {
      return { line, error: `can't read "${n}" — try I, vi, bVII, V7/vi, iiø7` };
    }
  }
  return { line, template: { name: name || 'Untitled', mode, numerals, note } };
}

const templatesToText = (templates: ProgressionTemplate[]): string =>
  templates.map((t) => [t.name, t.mode, t.numerals.join(' '), t.note].filter(Boolean).join(' | ')).join('\n');

const ALL_SPICES = Object.keys(SPICES) as SpiceId[];

const SURPRISE_ADJ = ['Neon', 'Swamp', 'Velvet', 'Rust', 'Plastic', 'Cosmic', 'Basement', 'Glacier', 'Honey', 'Static', 'Paisley', 'Chrome'];
const SURPRISE_NOUN = ['Disco', 'Doom', 'Bossa', 'Twang', 'Wave', 'Soul', 'Mosh', 'Lounge', 'Strut', 'Hymnal', 'Safari', 'Arcade'];

function surprise(): CustomGenreData {
  const base = GENRE_LIST[Math.floor(Math.random() * GENRE_LIST.length)];
  const pool = GENRE_LIST.flatMap((g) => g.templates);
  const templates: ProgressionTemplate[] = [];
  const wanted = 3 + Math.floor(Math.random() * 2);
  while (templates.length < wanted && pool.length) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    if (!templates.some((x) => x.name === t.name)) templates.push(t);
  }
  const spices = [...new Set([...base.spices, ...ALL_SPICES.filter(() => Math.random() < 0.2)])].slice(0, 8);
  return {
    id: newCustomId(),
    name: `${SURPRISE_ADJ[Math.floor(Math.random() * SURPRISE_ADJ.length)]} ${SURPRISE_NOUN[Math.floor(Math.random() * SURPRISE_NOUN.length)]}`,
    baseId: base.id as GenreId,
    bpm: 70 + Math.floor(Math.random() * 110),
    powerChords: Math.random() < 0.25 ? 'plain' : undefined,
    templates,
    spices,
  };
}

export function GenreLab({ editing, onSave, onDelete, onClose }: GenreLabProps) {
  const [data, setData] = useState<CustomGenreData>(editing ?? {
    id: newCustomId(),
    name: '',
    baseId: 'classic-rock',
    bpm: 120,
    templates: [],
    spices: [...GENRES['classic-rock'].spices],
  });
  const [templateText, setTemplateText] = useState(editing ? templatesToText(editing.templates) : 'My anthem | major | I bVII IV I | optional note');

  const lines = useMemo(() => templateText.split('\n').map(parseTemplateLine), [templateText]);
  const errors = lines.filter((l) => l.error);
  const templates = lines.flatMap((l) => (l.template ? [l.template] : []));
  const canSave = data.name.trim().length > 0 && templates.length > 0 && errors.length === 0;

  const toggleSpice = (id: SpiceId) =>
    setData((d) => ({ ...d, spices: d.spices.includes(id) ? d.spices.filter((s) => s !== id) : [...d.spices, id] }));

  const rollSurprise = () => {
    const s = surprise();
    setData({ ...s, id: data.id });
    setTemplateText(templatesToText(s.templates));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Genre lab</h2>
          <button className="btn" onClick={rollSurprise}>Surprise me</button>
          <button className="btn" onClick={onClose}>×</button>
        </div>

        <div className="setting-row">
          <span className="setting-label">Name</span>
          <input className="text-input" value={data.name} placeholder="Desert Slowcore" onChange={(e) => setData({ ...data, name: e.target.value })} />
          <span className="setting-label">Grooves like</span>
          <select value={data.baseId} onChange={(e) => setData({ ...data, baseId: e.target.value as GenreId })}>
            {GENRE_LIST.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <span className="setting-label">BPM</span>
          <input className="text-input bpm-input" type="number" min={40} max={244} value={data.bpm} onChange={(e) => setData({ ...data, bpm: Number(e.target.value) || 120 })} />
          <span className="setting-label">Power chords</span>
          <div className="seg">
            <button className={!data.powerChords ? 'seg-on' : ''} onClick={() => setData({ ...data, powerChords: undefined })}>Off</button>
            <button className={data.powerChords === 'plain' ? 'seg-on' : ''} onClick={() => setData({ ...data, powerChords: 'plain' })}>Plain</button>
            <button className={data.powerChords === 'all' ? 'seg-on' : ''} onClick={() => setData({ ...data, powerChords: 'all' })}>All</button>
          </div>
        </div>

        <div className="lab-templates">
          <div className="setting-label">Progressions, one per line: <code>Name | mode | I vi IV V | note</code></div>
          <textarea value={templateText} spellCheck={false} rows={6} onChange={(e) => setTemplateText(e.target.value)} />
          {errors.length > 0 && (
            <div className="lab-errors">
              {errors.slice(0, 3).map((l, i) => <div key={i}>“{l.line.trim().slice(0, 40)}…”: {l.error}</div>)}
            </div>
          )}
          {!errors.length && templates.length > 0 && (
            <div className="lab-ok">{templates.length} progression{templates.length > 1 ? 's' : ''} · {[...new Set(templates.map((t) => t.mode))].join(', ')}</div>
          )}
        </div>

        <div className="lab-spices">
          <div className="setting-label">Spice rack</div>
          <div className="chip-row">
            {ALL_SPICES.map((id) => (
              <button key={id} className={`chip ${data.spices.includes(id) ? 'chip-on' : ''}`} title={SPICES[id].blurb} onClick={() => toggleSpice(id)}>
                {SPICES[id].name}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          {editing && onDelete && <button className="btn btn-danger" onClick={() => { onDelete(editing.id); onClose(); }}>Delete genre</button>}
          <button className="btn btn-spice" disabled={!canSave} onClick={() => { onSave({ ...data, templates }); onClose(); }}>Save genre</button>
        </div>
      </div>
    </div>
  );
}
