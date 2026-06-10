// User-made genres: stored as small JSON blobs, hydrated into full Genre
// objects by inheriting everything structural from a built-in base genre.

import { GENRES, Genre, GenreId, ProgressionTemplate } from './genres';
import { SpiceId } from '../theory/spices';

export interface CustomGenreData {
  id: string; // "custom-<slug>"
  name: string;
  emoji: string;
  baseId: GenreId;
  bpm: number;
  powerChords?: 'all' | 'plain';
  templates: ProgressionTemplate[];
  spices: SpiceId[];
}

const KEY = 'spicerack2.customGenres';

export function loadCustomGenres(): CustomGenreData[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomGenreData[]) : [];
  }
  catch {
    return [];
  }
}

export function saveCustomGenres(list: CustomGenreData[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Inflate stored data into a playable Genre using the base for groove/scales/voicing. */
export function materializeGenre(d: CustomGenreData): Genre {
  const base = GENRES[d.baseId] ?? GENRES['classic-rock'];
  const modes = [...new Set(d.templates.map((t) => t.mode))];
  return {
    ...base,
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    tagline: `homemade — grooves like ${base.name}`,
    modes: modes.length ? modes : base.modes,
    templates: d.templates.length ? d.templates : base.templates,
    spices: d.spices.length ? d.spices : base.spices,
    bpm: d.bpm || base.bpm,
    powerChords: d.powerChords,
  };
}

export const newCustomId = (): string =>
  `custom-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
