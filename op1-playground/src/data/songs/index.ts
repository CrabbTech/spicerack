// The song library. Adding a song = drop a Score file next to this one and add
// it to SONGS; docs/adding-a-song.md walks through the transcription itself.

import { Score } from '../../songs/types';
import { laidBackDbIntro } from './laid-back-db-intro';
import { tranquilloGVamp } from './tranquillo-g-vamp';
import { laidBackDbTheme } from './laid-back-db-theme';
import { waltzInD } from './waltz-in-d';

export const SONGS: Score[] = [
  laidBackDbIntro,
  laidBackDbTheme,
  tranquilloGVamp,
  waltzInD,
];

export const songById = (id: string): Score | undefined => SONGS.find((s) => s.id === id);
