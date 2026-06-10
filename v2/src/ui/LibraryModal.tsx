// The library: saved progressions, with everything needed to restore them.

import { useState } from 'react';

export interface SavedProgression {
  id: string;
  name: string;
  savedAt: number;
  genreId: string;
  mode: string;
  tonicIdx: number;
  bpm: number | null;
  modulate: number | null;
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
  onClose: () => void;
}

export function LibraryModal({ items, genreName, onLoad, onDelete, onClose }: LibraryModalProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📚 Library</h2>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>
        {items.length === 0 && (
          <div className="library-empty">Nothing saved yet — cook up a progression and hit “Save”.</div>
        )}
        <div className="library-list">
          {items.map((item) => (
            <div key={item.id} className="library-item">
              <div className="library-info">
                <div className="library-name">{item.name}</div>
                <div className="library-meta">
                  {genreName(item.genreId)} · {item.mode} · {item.summary}
                  {item.modulate ? ' · 🚚' : ''}
                </div>
              </div>
              <div className="library-actions">
                <button className="btn" onClick={() => { onLoad(item); onClose(); }}>Load</button>
                {confirming === item.id
                  ? <button className="btn btn-danger" onClick={() => { onDelete(item.id); setConfirming(null); }}>Sure?</button>
                  : <button className="btn" onClick={() => setConfirming(item.id)}>🗑</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
