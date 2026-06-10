// Themes: every color/font in the app routes through CSS custom properties,
// so a theme is just a bundle of values. Decor layers (grids, scanlines,
// paper grain) are CSS keyed off data-decor on <html>.

export type DecorId = 'none' | 'vapor' | 'scanlines' | 'paper' | 'stripes';

export interface ThemeColors {
  bg: string; panel: string; panel2: string; line: string;
  text: string; dim: string; faint: string;
  accent: string; accentContrast: string;
  tonic: string; subdominant: string; dominant: string; borrowed: string; secondary: string;
  spiceTint: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  tagline: string;
  light?: boolean;
  decor: DecorId;
  radius: number;
  fonts: { body: FontId; mono: FontId; display: FontId };
  colors: ThemeColors;
}

export type FontId =
  | 'sans' | 'serif' | 'rounded' | 'mono' | 'typewriter' | 'condensed'
  | 'futura' | 'optima' | 'avenir' | 'didot' | 'courier' | 'helvetica' | 'seravek';

export const FONT_STACKS: Record<FontId, string> = {
  sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  serif: `"Iowan Old Style", Palatino, Georgia, serif`,
  rounded: `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", -apple-system, sans-serif`,
  mono: `ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace`,
  typewriter: `"American Typewriter", "Courier New", monospace`,
  condensed: `"Avenir Next Condensed", "Arial Narrow", -apple-system, sans-serif`,
  futura: `Futura, "Century Gothic", "Trebuchet MS", sans-serif`,
  optima: `Optima, Candara, "Gill Sans", Verdana, sans-serif`,
  avenir: `"Avenir Next", Avenir, -apple-system, sans-serif`,
  didot: `Didot, "Bodoni 72", "Playfair Display", Georgia, serif`,
  courier: `"Courier New", Courier, monospace`,
  helvetica: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
  seravek: `Seravek, "Gill Sans", Verdana, sans-serif`,
};

export const FONT_NAMES: Record<FontId, string> = {
  sans: 'System Sans', serif: 'Bookish Serif', rounded: 'Rounded', mono: 'Mono',
  typewriter: 'Typewriter', condensed: 'Condensed', futura: 'Futura',
  optima: 'Optima', avenir: 'Avenir', didot: 'Didot', courier: 'Courier',
  helvetica: 'Helvetica', seravek: 'Seravek',
};

const T = (def: ThemeDef): ThemeDef => def;

export const THEMES: ThemeDef[] = [
  T({
    id: 'rack', name: 'Rack Classic', tagline: 'the original dark hardware panel',
    decor: 'none', radius: 10,
    fonts: { body: 'sans', mono: 'mono', display: 'mono' },
    colors: {
      bg: '#0e1013', panel: '#16191d', panel2: '#1c2026', line: '#2a3038',
      text: '#e9e7e1', dim: '#98a1ab', faint: '#5c6670',
      accent: '#ff6a2b', accentContrast: '#14100c',
      tonic: '#5aa9ff', subdominant: '#41c98e', dominant: '#ffb454',
      borrowed: '#b88dff', secondary: '#ff5d8f', spiceTint: '#221a14',
    },
  }),
  T({
    id: 'vaporwave', name: 'Vaporwave', tagline: 'ＡＥＳＴＨＥＴＩＣ — sun, grid, crab',
    decor: 'vapor', radius: 14,
    fonts: { body: 'futura', mono: 'mono', display: 'didot' },
    colors: {
      bg: '#150d2e', panel: '#1f1542', panel2: '#2a1c55', line: '#45337d',
      text: '#f2e9ff', dim: '#b4a3dd', faint: '#7d6ca9',
      accent: '#ff71ce', accentContrast: '#1d0830',
      tonic: '#01cdfe', subdominant: '#05ffa1', dominant: '#fffb96',
      borrowed: '#b967ff', secondary: '#ff6ad5', spiceTint: '#2d1247',
    },
  }),
  T({
    id: 'earthen', name: 'Green Earth', tagline: 'moss, clay and quiet',
    decor: 'paper', radius: 8,
    fonts: { body: 'seravek', mono: 'mono', display: 'seravek' },
    colors: {
      bg: '#171a12', panel: '#20251a', panel2: '#293021', line: '#3b4430',
      text: '#ece6d4', dim: '#aaa98e', faint: '#707659',
      accent: '#d9924a', accentContrast: '#1d160c',
      tonic: '#93b974', subdominant: '#62b18e', dominant: '#d9bc6b',
      borrowed: '#a78fc2', secondary: '#c97f6c', spiceTint: '#251f12',
    },
  }),
  T({
    id: 'scholastic', name: 'Utopian Scholastic', tagline: 'a 90s encyclopedia about a brighter future',
    light: true, decor: 'none', radius: 6,
    fonts: { body: 'optima', mono: 'typewriter', display: 'optima' },
    colors: {
      bg: '#f2ecdb', panel: '#fbf6ea', panel2: '#ece2c8', line: '#d3c5a0',
      text: '#21304e', dim: '#5a6a8c', faint: '#93a0b8',
      accent: '#d98a12', accentContrast: '#fffdf4',
      tonic: '#1d6ca8', subdominant: '#267f63', dominant: '#bf4f3c',
      borrowed: '#76549e', secondary: '#ad3f7c', spiceTint: '#f3e7c8',
    },
  }),
  T({
    id: 'backrooms', name: 'Backrooms', tagline: 'fluorescent hum, damp carpet, wrong floor',
    decor: 'stripes', radius: 4,
    fonts: { body: 'helvetica', mono: 'courier', display: 'courier' },
    colors: {
      bg: '#322a10', panel: '#443a18', panel2: '#52461e', line: '#6a5c2c',
      text: '#efe6b3', dim: '#c2b67d', faint: '#8d814f',
      accent: '#ffd23e', accentContrast: '#2a2208',
      tonic: '#8aa86f', subdominant: '#5f9e8d', dominant: '#ff9d2e',
      borrowed: '#b48ead', secondary: '#e2725b', spiceTint: '#4a3d14',
    },
  }),
  T({
    id: 'cockpit', name: "Cockpit '86", tagline: 'anime supercar dashboard at 2am',
    decor: 'scanlines', radius: 6,
    fonts: { body: 'avenir', mono: 'mono', display: 'condensed' },
    colors: {
      bg: '#0a0a0f', panel: '#141318', panel2: '#1b1a22', line: '#3a2030',
      text: '#f5e9da', dim: '#b39a96', faint: '#6e5c64',
      accent: '#ff2d3f', accentContrast: '#190608',
      tonic: '#29c8ff', subdominant: '#58e08c', dominant: '#ffb12e',
      borrowed: '#c46bff', secondary: '#ff5a8f', spiceTint: '#261016',
    },
  }),
  T({
    id: 'night', name: 'Blue & Orange Night', tagline: 'sodium lamps over a midnight city',
    decor: 'none', radius: 10,
    fonts: { body: 'sans', mono: 'mono', display: 'mono' },
    colors: {
      bg: '#0b1626', panel: '#122036', panel2: '#182a45', line: '#27405f',
      text: '#e7eef7', dim: '#9db1c7', faint: '#61788f',
      accent: '#ff8a2a', accentContrast: '#160d04',
      tonic: '#4aa8ff', subdominant: '#3fd0b6', dominant: '#ffc168',
      borrowed: '#9d8cff', secondary: '#ff5d8f', spiceTint: '#283048',
    },
  }),
  T({
    id: 'tidepool', name: 'Tide Pool', tagline: 'where the crab actually lives',
    light: true, decor: 'none', radius: 14,
    fonts: { body: 'rounded', mono: 'mono', display: 'rounded' },
    colors: {
      bg: '#e8f3ef', panel: '#ffffff', panel2: '#d9ece5', line: '#b6d6cc',
      text: '#173a3a', dim: '#4e7a73', faint: '#87a8a0',
      accent: '#ff6f59', accentContrast: '#fff6f2',
      tonic: '#1a78b8', subdominant: '#21927f', dominant: '#cf8a2a',
      borrowed: '#7e5fc4', secondary: '#d8506a', spiceTint: '#fdeae4',
    },
  }),
  T({
    id: 'zine', name: 'Riso Zine', tagline: 'two-ink riso print, hot off the drum',
    light: true, decor: 'paper', radius: 2,
    fonts: { body: 'helvetica', mono: 'courier', display: 'futura' },
    colors: {
      bg: '#f3efe6', panel: '#fbf8f1', panel2: '#eae3d2', line: '#d2c7b0',
      text: '#2b2440', dim: '#655c86', faint: '#9a92b3',
      accent: '#ff4d7d', accentContrast: '#fff7f0',
      tonic: '#2f5fd0', subdominant: '#1d9e78', dominant: '#e0731f',
      borrowed: '#7a4fd0', secondary: '#d62f8d', spiceTint: '#f7e3da',
    },
  }),
  T({
    id: 'claude', name: 'Claude', tagline: 'terracotta & reading-lamp cream ✳',
    light: true, decor: 'paper', radius: 12,
    fonts: { body: 'serif', mono: 'mono', display: 'serif' },
    colors: {
      bg: '#f0eee6', panel: '#faf9f5', panel2: '#e9e6db', line: '#d6d1c2',
      text: '#1f1e1b', dim: '#5e5d56', faint: '#96948a',
      accent: '#d97757', accentContrast: '#fff8f3',
      tonic: '#2f6db8', subdominant: '#2e8b6e', dominant: '#c4892b',
      borrowed: '#8a68c8', secondary: '#c65275', spiceTint: '#f4e3d8',
    },
  }),
];

export const themeById = (id: string): ThemeDef => THEMES.find((t) => t.id === id) ?? THEMES[0];

// --- user settings ----------------------------------------------------------

export interface CustomTheme {
  base: string;
  colors: ThemeColors;
  fonts: { body: FontId; mono: FontId; display: FontId };
  decor: DecorId;
  radius: number;
  light: boolean;
}

export interface UiSettings {
  themeId: string;             // theme id or 'custom'
  density: 'comfortable' | 'compact';
  corners: 'theme' | 'sharp';
  sidebar: 'right' | 'left' | 'off';
  custom: CustomTheme;
}

export const defaultCustom = (from: ThemeDef): CustomTheme => ({
  base: from.id,
  colors: { ...from.colors },
  fonts: { ...from.fonts },
  decor: from.decor,
  radius: from.radius,
  light: !!from.light,
});

export const DEFAULT_SETTINGS: UiSettings = {
  themeId: 'rack',
  density: 'comfortable',
  corners: 'theme',
  sidebar: 'right',
  custom: defaultCustom(THEMES[0]),
};

const STORAGE_KEY = 'spicerack2.settings';

export function loadSettings(): UiSettings {
  let out = DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiSettings>;
      out = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        custom: { ...DEFAULT_SETTINGS.custom, ...(parsed.custom ?? {}), colors: { ...DEFAULT_SETTINGS.custom.colors, ...(parsed.custom?.colors ?? {}) } },
      };
    }
  }
  catch {
    out = DEFAULT_SETTINGS;
  }
  // deep-link override for quick looks: ?theme=vaporwave
  const themeParam = new URLSearchParams(window.location.search).get('theme');
  if (themeParam && (themeParam === 'custom' || THEMES.some((t) => t.id === themeParam))) {
    out = { ...out, themeId: themeParam };
  }
  return out;
}

export function saveSettings(s: UiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Resolve what's actually applied (theme or custom). */
export function resolveTheme(s: UiSettings): Omit<ThemeDef, 'id' | 'name' | 'tagline'> {
  if (s.themeId === 'custom') return s.custom;
  return themeById(s.themeId);
}

const hexAlpha = (hex: string, alpha: string): string =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;

/** Push the resolved theme + layout settings into the DOM. */
export function applySettings(s: UiSettings): void {
  const t = resolveTheme(s);
  const root = document.documentElement;
  const c = t.colors;
  const vars: Record<string, string> = {
    '--bg': c.bg, '--panel': c.panel, '--panel-2': c.panel2, '--line': c.line,
    '--text': c.text, '--dim': c.dim, '--faint': c.faint,
    '--accent': c.accent, '--accent-contrast': c.accentContrast,
    '--accent-soft': hexAlpha(c.accent, '2e'),
    '--tonic': c.tonic, '--subdominant': c.subdominant, '--dominant': c.dominant,
    '--borrowed': c.borrowed, '--secondary': c.secondary,
    '--spice-tint': c.spiceTint,
    '--radius': `${s.corners === 'sharp' ? 3 : t.radius}px`,
    '--font-body': FONT_STACKS[t.fonts.body],
    '--mono': FONT_STACKS[t.fonts.mono],
    '--font-display': FONT_STACKS[t.fonts.display],
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.decor = t.decor;
  root.dataset.density = s.density;
  root.dataset.sidebar = s.sidebar;
  root.dataset.light = t.light ? 'true' : 'false';
}
