// The library: saved progressions, with everything needed to restore them.

import { useState } from 'react';
import { MelNote } from '../theory/melody';

type SavedSlot = { numeral: string; bars: number; annotation?: string; spiceId?: string; pedalBass?: boolean };

export interface SavedSection {
  name: string;
  templateName: string;
  templateNote?: string;
  meter?: string;
  groups?: number[];
  slots: SavedSlot[];
  modulate: number | null;
  melody: MelNote[];
}

export interface SavedProgression {
  id: string;
  name: string;
  savedAt: number;
  genreId: string;
  mode: string;
  tonicIdx: number;
  bpm: number | null;
  modulate: number | null;
  /** odd-meter templates: display label + accent groups in eighths */
  meter?: string;
  groups?: number[];
  /** the active section's melody */
  melody?: MelNote[];
  /** whole-song saves: every section, which one was open, and the play order */
  sections?: SavedSection[];
  activeSection?: number;
  arrangement?: number[];
  tags?: string[];
  notes?: string;
  slots: { numeral: string; bars: number; annotation?: string; spiceId?: string; pedalBass?: boolean }[];
  /** display summary, e.g. "C — Am — F — G" */
  summary: string;
}

const KEY = 'spicerack2.library';

export function loadLibrary(): SavedProgression[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedProgression[]) : [];
  }
  catch {
    return [];
  }
}

export function saveLibrary(list: SavedProgression[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export interface LibraryModalProps {
  items: SavedProgression[];
  genreName: (id: string) => string;
  onLoad: (item: SavedProgression) => void;
  onDelete: (id: string) => void;
  onUpdate: (item: SavedProgression) => void;
  onImport: (items: SavedProgression[]) => void;
  onClose: () => void;
}

/** Anything that looks like a save: enough structure to load without surprises. */
const looksSaved = (x: unknown): x is SavedProgression => {
  const item = x as SavedProgression;
  return !!item && typeof item.name === 'string' && typeof item.genreId === 'string' && Array.isArray(item.slots)
    && item.slots.length >= 2 && item.slots.every((sl) => typeof sl.numeral === 'string' && typeof sl.bars === 'number');
};

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function LibraryModal({ items, genreName, onLoad, onDelete, onUpdate, onImport, onClose }: LibraryModalProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const q = query.trim().toLowerCase();
  const shown = items.filter((item) => !q || [item.name, item.summary, genreName(item.genreId), item.notes ?? '', ...(item.tags ?? [])]
    .some((field) => field.toLowerCase().includes(q)));
  const allTags = [...new Set(items.flatMap((item) => item.tags ?? []))].sort();

  const importFile = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const list = (Array.isArray(parsed) ? parsed : [parsed]).filter(looksSaved);
      if (!list.length) throw new Error('nothing loadable');
      const known = new Set(items.map((x) => x.id));
      onImport(list.map((x) => (known.has(x.id) ? { ...x, id: `${x.id}-${Date.now().toString(36)}` } : x)));
      setMessage(`Imported ${list.length} song${list.length === 1 ? '' : 's'}.`);
    }
    catch {
      setMessage('That file isn’t a Spicerack export.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📚 Library</h2>
          <input className="text-input" placeholder="search names, chords, tags, notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn" disabled={!items.length} title="every saved song as one JSON file — a backup, or a way to move machines"
            onClick={() => download(`spicerack-library-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(items, null, 2))}>⬇ Export all</button>
          <label className="btn file-btn" title="import a Spicerack export">
            ⬆ Import
            <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
          </label>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>
        {allTags.length > 0 && (
          <div className="chip-row library-tags">
            {allTags.map((t) => (
              <button key={t} className={`chip ${q === t.toLowerCase() ? 'chip-on' : ''}`} onClick={() => setQuery(q === t.toLowerCase() ? '' : t)}>#{t}</button>
            ))}
          </div>
        )}
        {message && <div className="lab-ok">{message}</div>}
        {items.length === 0 && (
          <div className="library-empty">Nothing saved yet — 💾 Save keeps the whole song: every section, its chords and its melody.</div>
        )}
        <div className="library-list">
          {shown.map((item) => (
            <div key={item.id} className="library-item library-item-tall">
              <div className="library-info">
                <div className="library-name">
                  {item.name}
                  {(item.sections?.length ?? 0) > 1 && <span className="library-badge">{item.sections!.length} sections</span>}
                  {(item.melody?.length || item.sections?.some((sec) => sec.melody.length)) ? <span className="library-badge">🎵 melody</span> : null}
                  {item.modulate ? <span className="library-badge">🚚</span> : null}
                </div>
                <div className="library-meta">
                  {genreName(item.genreId)} · {item.mode} · {item.summary} · {new Date(item.savedAt).toLocaleDateString()}
                </div>
                {editing === item.id ? (
                  <div className="library-edit">
                    <input className="text-input" value={item.name} onChange={(e) => onUpdate({ ...item, name: e.target.value })} />
                    <input className="text-input" placeholder="tags, comma separated" value={(item.tags ?? []).join(', ')}
                      onChange={(e) => onUpdate({ ...item, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
                    <textarea rows={2} placeholder="notes to your future self — what it's for, what to try next" value={item.notes ?? ''}
                      onChange={(e) => onUpdate({ ...item, notes: e.target.value })} />
                  </div>
                ) : (
                  <>
                    {(item.tags?.length ?? 0) > 0 && <div className="library-meta">{item.tags!.map((t) => `#${t}`).join(' ')}</div>}
                    {item.notes && <div className="library-notes">{item.notes}</div>}
                  </>
                )}
              </div>
              <div className="library-actions">
                <button className="btn" onClick={() => { onLoad(item); onClose(); }}>Load</button>
                <button className={`btn ${editing === item.id ? 'btn-on' : ''}`} onClick={() => setEditing(editing === item.id ? null : item.id)} title="name, tags, notes">✎</button>
                <button className="btn" title="export just this song"
                  onClick={() => download(`${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.spicerack.json`, JSON.stringify(item, null, 2))}>⬇</button>
                {confirming === item.id
                  ? <button className="btn btn-danger" onClick={() => { onDelete(item.id); setConfirming(null); }}>Sure?</button>
                  : <button className="btn" onClick={() => setConfirming(item.id)}>🗑</button>}
              </div>
            </div>
          ))}
          {items.length > 0 && !shown.length && <div className="library-empty">Nothing matches “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}
