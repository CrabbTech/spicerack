// Theme & layout settings: pick a theme, tweak layout, or build your own.

import { useState } from 'react';
import {
  CustomTheme, DecorId, FONT_NAMES, FontId, THEMES, ThemeColors, ThemeDef,
  UiSettings, defaultCustom, themeById,
} from './themes';

export interface SettingsModalProps {
  settings: UiSettings;
  onChange: (s: UiSettings) => void;
  onClose: () => void;
}

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'panel', label: 'Panel' },
  { key: 'panel2', label: 'Panel alt' },
  { key: 'line', label: 'Lines' },
  { key: 'text', label: 'Text' },
  { key: 'dim', label: 'Muted text' },
  { key: 'accent', label: 'Accent' },
  { key: 'tonic', label: 'Tonic' },
  { key: 'subdominant', label: 'Subdominant' },
  { key: 'dominant', label: 'Dominant' },
  { key: 'borrowed', label: 'Borrowed' },
  { key: 'secondary', label: 'Secondary' },
];

const FONT_CHOICES: FontId[] = [
  'sans', 'helvetica', 'avenir', 'seravek', 'rounded', 'serif', 'optima',
  'didot', 'futura', 'condensed', 'mono', 'typewriter', 'courier',
];

const DECOR_CHOICES: { id: DecorId; label: string }[] = [
  { id: 'none', label: 'Clean' },
  { id: 'vapor', label: 'Vapor grid' },
  { id: 'scanlines', label: 'Scanlines' },
  { id: 'paper', label: 'Paper grain' },
  { id: 'stripes', label: 'Wallpaper' },
];

function Swatch({ theme, active, onPick }: { theme: ThemeDef; active: boolean; onPick: () => void }) {
  const c = theme.colors;
  return (
    <button className={`swatch ${active ? 'swatch-on' : ''}`} onClick={onPick} title={theme.tagline}>
      <span className="swatch-strip" style={{ background: c.bg }}>
        <i style={{ background: c.accent }} />
        <i style={{ background: c.tonic }} />
        <i style={{ background: c.subdominant }} />
        <i style={{ background: c.borrowed }} />
        <i style={{ background: c.panel2 }} />
      </span>
      <span className="swatch-name">{theme.name}</span>
      <span className="swatch-tag">{theme.tagline}</span>
    </button>
  );
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<'themes' | 'custom'>(settings.themeId === 'custom' ? 'custom' : 'themes');
  const set = (patch: Partial<UiSettings>) => onChange({ ...settings, ...patch });
  const setCustom = (patch: Partial<CustomTheme>) =>
    onChange({ ...settings, themeId: 'custom', custom: { ...settings.custom, ...patch } });
  const setCustomColor = (key: keyof ThemeColors, value: string) =>
    setCustom({ colors: { ...settings.custom.colors, [key]: value } });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🎨 Look & feel</h2>
          <div className="seg">
            <button className={tab === 'themes' ? 'seg-on' : ''} onClick={() => setTab('themes')}>THEMES</button>
            <button className={tab === 'custom' ? 'seg-on' : ''} onClick={() => setTab('custom')}>CUSTOM</button>
          </div>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>

        {tab === 'themes' && (
          <div className="swatch-grid">
            {THEMES.map((t) => (
              <Swatch key={t.id} theme={t} active={settings.themeId === t.id} onPick={() => set({ themeId: t.id })} />
            ))}
          </div>
        )}

        {tab === 'custom' && (
          <div className="custom-editor">
            <div className="setting-row">
              <span className="setting-label">Start from</span>
              <div className="chip-row">
                {THEMES.map((t) => (
                  <button key={t.id} className={`chip ${settings.custom.base === t.id ? 'chip-on' : ''}`}
                    onClick={() => onChange({ ...settings, themeId: 'custom', custom: defaultCustom(themeById(t.id)) })}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="color-grid">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className="color-field">
                  <input type="color" value={settings.custom.colors[f.key]}
                    onChange={(e) => setCustomColor(f.key, e.target.value)} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
            <div className="setting-row">
              <span className="setting-label">Body font</span>
              <select value={settings.custom.fonts.body}
                onChange={(e) => setCustom({ fonts: { ...settings.custom.fonts, body: e.target.value as FontId } })}>
                {FONT_CHOICES.map((f) => <option key={f} value={f}>{FONT_NAMES[f]}</option>)}
              </select>
              <span className="setting-label">Label font</span>
              <select value={settings.custom.fonts.mono}
                onChange={(e) => setCustom({ fonts: { ...settings.custom.fonts, mono: e.target.value as FontId, display: e.target.value as FontId } })}>
                {FONT_CHOICES.map((f) => <option key={f} value={f}>{FONT_NAMES[f]}</option>)}
              </select>
            </div>
            <div className="setting-row">
              <span className="setting-label">Backdrop</span>
              <div className="chip-row">
                {DECOR_CHOICES.map((d) => (
                  <button key={d.id} className={`chip ${settings.custom.decor === d.id ? 'chip-on' : ''}`}
                    onClick={() => setCustom({ decor: d.id })}>{d.label}</button>
                ))}
              </div>
              <span className="setting-label">Roundness</span>
              <input type="range" min={0} max={20} value={settings.custom.radius}
                onChange={(e) => setCustom({ radius: Number(e.target.value) })} />
            </div>
            <div className="setting-row">
              <label className="chip-row">
                <input type="checkbox" checked={settings.custom.light}
                  onChange={(e) => setCustom({ light: e.target.checked })} />
                <span>light theme (affects shadows & glows)</span>
              </label>
            </div>
          </div>
        )}

        <div className="modal-sep" />
        <div className="setting-row">
          <span className="setting-label">Density</span>
          <div className="seg">
            <button className={settings.density === 'comfortable' ? 'seg-on' : ''} onClick={() => set({ density: 'comfortable' })}>COMFY</button>
            <button className={settings.density === 'compact' ? 'seg-on' : ''} onClick={() => set({ density: 'compact' })}>COMPACT</button>
          </div>
          <span className="setting-label">Corners</span>
          <div className="seg">
            <button className={settings.corners === 'theme' ? 'seg-on' : ''} onClick={() => set({ corners: 'theme' })}>ROUND</button>
            <button className={settings.corners === 'sharp' ? 'seg-on' : ''} onClick={() => set({ corners: 'sharp' })}>SHARP</button>
          </div>
          <span className="setting-label">Sidebar</span>
          <div className="seg">
            <button className={settings.sidebar === 'right' ? 'seg-on' : ''} onClick={() => set({ sidebar: 'right' })}>RIGHT</button>
            <button className={settings.sidebar === 'left' ? 'seg-on' : ''} onClick={() => set({ sidebar: 'left' })}>LEFT</button>
            <button className={settings.sidebar === 'off' ? 'seg-on' : ''} onClick={() => set({ sidebar: 'off' })}>STACKED</button>
          </div>
        </div>
      </div>
    </div>
  );
}
