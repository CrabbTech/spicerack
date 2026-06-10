// The compose panel: knobs for the generative engine. Generate applies
// immediately (the cards update behind the modal), so mash away.

import { CadenceId } from '../theory/compose';

export interface ComposeSettings {
  length: 4 | 6 | 8;
  heat: 1 | 2 | 3;
  cadence: CadenceId;
  startOnTonic: boolean;
}

export interface ComposeModalProps {
  settings: ComposeSettings;
  onChange: (s: ComposeSettings) => void;
  onGenerate: () => void;
  onClose: () => void;
}

const CADENCES: { id: CadenceId; label: string; hint: string }[] = [
  { id: 'auto', label: 'Genre taste', hint: 'let the genre decide how to land' },
  { id: 'loop', label: 'Loop', hint: 'never resolves — the pull back to the top is the hook' },
  { id: 'authentic', label: 'Authentic', hint: 'V → I, the oldest gravity in music' },
  { id: 'plagal', label: 'Plagal', hint: 'IV → I, the amen cadence' },
  { id: 'deceptive', label: 'Deceptive', hint: 'V → vi, the plot twist' },
  { id: 'half', label: 'Half', hint: 'ends on V — a question mark' },
];

export function ComposeModal({ settings, onChange, onGenerate, onClose }: ComposeModalProps) {
  const set = (patch: Partial<ComposeSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>✨ Compose</h2>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>
        <p className="compose-blurb">
          Builds a progression from harmonic function — home, motion, tension, release — flavored by
          this genre's own habits. Every result explains its skeleton in the log.
        </p>
        <div className="setting-row">
          <span className="setting-label">Length</span>
          <div className="seg">
            {([4, 6, 8] as const).map((n) => (
              <button key={n} className={settings.length === n ? 'seg-on' : ''} onClick={() => set({ length: n })}>
                {n} CHORDS{n === 8 ? ' · Q&A' : ''}
              </button>
            ))}
          </div>
          <span className="setting-label">Heat</span>
          <div className="seg">
            {([1, 2, 3] as const).map((h) => (
              <button key={h} className={settings.heat === h ? 'seg-on' : ''} onClick={() => set({ heat: h })}
                title={h === 1 ? 'diatonic only' : h === 2 ? 'borrowed chords allowed' : 'secondary dominants & rich voicings'}>
                {'🌶'.repeat(h)}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-label">Ending</span>
          <div className="chip-row">
            {CADENCES.map((c) => (
              <button key={c.id} className={`chip ${settings.cadence === c.id ? 'chip-on' : ''}`}
                title={c.hint} onClick={() => set({ cadence: c.id })}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <label className="chip-row">
            <input type="checkbox" checked={settings.startOnTonic} onChange={(e) => set({ startOnTonic: e.target.checked })} />
            <span>start at home (the tonic)</span>
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn btn-spice" onClick={onGenerate}>✨ Generate</button>
        </div>
      </div>
    </div>
  );
}
