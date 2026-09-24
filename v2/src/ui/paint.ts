// How a note gets drawn on any diagram — fretboard dot or keyboard key — once
// the solo map has decided what it means over the current chord.

import { SoloRole } from '../theory/solo';

export interface NotePaint {
  label: string;
  /** 'plain' = ordinary scale view, no chord in focus; 'ghost' = not playable yet, only a destination */
  role: SoloRole | 'plain' | 'ghost';
  isRoot: boolean;
  /** a chord tone the scale doesn't own */
  outside?: boolean;
  /** switched off by the current exercise */
  off?: boolean;
  /** land here when this chord arrives */
  target?: boolean;
  /** the next chord's landing note */
  landing?: boolean;
}

/** Visual role class suffix: outside chord tones get their own color. */
export const paintKind = (p: NotePaint): string =>
  p.outside ? 'outside' : p.role === 'plain' ? (p.isRoot ? 'root' : 'plain') : p.role;

export const ROLE_LEGEND: { kind: string; name: string; what: string }[] = [
  { kind: 'root', name: 'root', what: 'home — the safest landing' },
  { kind: 'chord', name: 'chord tone', what: 'land here; these spell the chord' },
  { kind: 'color', name: 'color', what: 'safe to travel through or sit on' },
  { kind: 'avoid', name: 'passing', what: 'a half step over a chord tone — move through it' },
  { kind: 'rub', name: 'rub', what: 'the chord has bent this note — slide off it' },
  { kind: 'outside', name: 'spice', what: 'a chord tone your scale doesn’t own — grab it while the chord lasts' },
];
