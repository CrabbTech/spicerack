// Practice memory: everything the studio remembers about you lives in
// localStorage under op1playground.* — play-along bests, drill bests, and the
// days you showed up. This module reads it back as one picture and suggests
// what to practice next. Pure over injected records, so it is testable.

export const STORAGE_PREFIX = 'op1playground';

export interface SongBest {
  songId: string;
  sectionId: string;
  tempoPct: number;
  accuracy: number;
  /** hands-separate takes: which part was graded */
  scope?: 'melody' | 'left';
}

export interface DrillBest {
  /** human label, e.g. 'chord grabs · D♭ major · triads' or 'song grabs · <id>' */
  label: string;
  songId?: string;
  seconds: number;
}

/** 'op1playground.best.<song>.<section>.<pct>' -> SongBest */
export function parseSongBest(key: string, value: string): SongBest | undefined {
  const parts = key.split('.');
  if (parts.length !== 5 || parts[0] !== STORAGE_PREFIX || parts[1] !== 'best') return undefined;
  const accuracy = Number(value);
  const [pct, scope] = parts[4].split('~');
  const tempoPct = Number(pct);
  if (!Number.isFinite(accuracy) || !Number.isFinite(tempoPct)) return undefined;
  return {
    songId: parts[2], sectionId: parts[3], tempoPct, accuracy,
    ...(scope === 'melody' || scope === 'left' ? { scope } : {}),
  };
}

/** 'op1playground.drill.…' -> DrillBest */
export function parseDrillBest(key: string, value: string): DrillBest | undefined {
  const parts = key.split('.');
  if (parts[0] !== STORAGE_PREFIX || parts[1] !== 'drill') return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return undefined;
  if (parts[2] === 'song' && parts.length === 4) {
    return { label: 'song grabs', songId: parts[3], seconds };
  }
  if (parts.length === 6) {
    const kind = { chord: 'chord grabs', keytag: 'key tags', note: 'note names' }[parts[2]] ?? parts[2];
    return { label: `${kind} · ${parts[3]} ${parts[4]} · ${parts[5] === '7' ? 'sevenths' : 'triads'}`, seconds };
  }
  return undefined;
}

export interface Progress {
  songBests: SongBest[];
  drillBests: DrillBest[];
}

export function collectProgress(entries: [string, string][]): Progress {
  const songBests: SongBest[] = [];
  const drillBests: DrillBest[] = [];
  for (const [key, value] of entries) {
    const sb = parseSongBest(key, value);
    if (sb) { songBests.push(sb); continue; }
    const db = parseDrillBest(key, value);
    if (db) drillBests.push(db);
  }
  songBests.sort((a, b) => b.tempoPct - a.tempoPct || b.accuracy - a.accuracy);
  drillBests.sort((a, b) => a.seconds - b.seconds);
  return { songBests, drillBests };
}

export const storageEntries = (): [string, string][] => {
  const out: [string, string][] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) out.push([key, window.localStorage.getItem(key) ?? '']);
    }
  }
  catch { /* private browsing */ }
  return out;
};

// ---------------------------------------------------------------------------
// Where you left off: last song, section, and practice tempo.

export interface LastSpot {
  songId: string;
  sectionIdx: number;
  tempoPct: number;
}

const LAST_KEY = `${STORAGE_PREFIX}.last`;

export function saveLast(spot: LastSpot): void {
  try {
    window.localStorage.setItem(LAST_KEY, JSON.stringify(spot));
  }
  catch { /* private browsing */ }
}

export function readLast(): LastSpot | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LAST_KEY) ?? 'null');
    if (raw && typeof raw.songId === 'string' &&
        Number.isInteger(raw.sectionIdx) && Number.isFinite(raw.tempoPct)) {
      return { songId: raw.songId, sectionIdx: raw.sectionIdx, tempoPct: raw.tempoPct };
    }
  }
  catch { /* fall through */ }
  return undefined;
}

// ---------------------------------------------------------------------------
// The take journal: every graded play-along, in order.

export interface Take {
  /** day stamp, YYYY-MM-DD */
  d: string;
  songId: string;
  sectionId: string;
  tempoPct: number;
  accuracy: number;
  scope?: 'melody' | 'left';
}

const TAKES_KEY = `${STORAGE_PREFIX}.takes`;

export function readTakes(): Take[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(TAKES_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is Take =>
      t && typeof t === 'object' && typeof t.songId === 'string' &&
      Number.isFinite(t.accuracy) && Number.isFinite(t.tempoPct));
  }
  catch {
    return [];
  }
}

export function recordTake(take: Take): void {
  try {
    const takes = readTakes();
    takes.push(take);
    window.localStorage.setItem(TAKES_KEY, JSON.stringify(takes.slice(-500)));
  }
  catch { /* private browsing */ }
}

export const takesFor = (takes: Take[], songId: string): Take[] =>
  takes.filter((t) => t.songId === songId);

/** SVG polyline points for an accuracy trend, newest right. */
export function sparkPoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  if (values.length === 1) return `0,${height / 2} ${width},${height / 2}`;
  const step = width / (values.length - 1);
  return values
    .map((v, i) => `${Math.round(i * step * 10) / 10},${Math.round((height - (Math.max(0, Math.min(100, v)) / 100) * height) * 10) / 10}`)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Trouble keys: which physical keys keep getting missed, per song.

const troubleKey = (songId: string): string => `${STORAGE_PREFIX}.trouble.${songId}`;

export function readTrouble(songId: string): Record<number, number> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(troubleKey(songId)) ?? '{}');
    const out: Record<number, number> = {};
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        const idx = Number(k);
        if (Number.isInteger(idx) && idx >= 0 && idx < 24 && Number.isFinite(Number(v))) {
          out[idx] = Number(v);
        }
      }
    }
    return out;
  }
  catch {
    return {};
  }
}

/** Fold one take's missed keys into the song's running memory. */
export function recordTrouble(songId: string, missed: Map<number, number>): void {
  if (!missed.size) return;
  try {
    const cur = readTrouble(songId);
    for (const [idx, n] of missed) cur[idx] = (cur[idx] ?? 0) + n;
    window.localStorage.setItem(troubleKey(songId), JSON.stringify(cur));
  }
  catch { /* private browsing */ }
}

export function clearTrouble(songId: string): void {
  try {
    window.localStorage.removeItem(troubleKey(songId));
  }
  catch { /* private browsing */ }
}

/** The worst offenders, most-missed first. */
export function topTrouble(counts: Record<number, number>, limit = 4): { index: number; count: number }[] {
  return Object.entries(counts)
    .map(([k, v]) => ({ index: Number(k), count: v }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Showing up: the practice-day log and streak.

const DAYS_KEY = `${STORAGE_PREFIX}.days`;

export const dayStamp = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Consecutive days ending today (or yesterday — tonight still counts as alive). */
export function streakOf(days: string[], today: string): number {
  const set = new Set(days);
  const cursor = new Date(`${today}T12:00:00`);
  if (!set.has(dayStamp(cursor))) cursor.setDate(cursor.getDate() - 1); // grace: yesterday keeps it alive
  let streak = 0;
  while (set.has(dayStamp(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function readDays(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DAYS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string') : [];
  }
  catch {
    return [];
  }
}

/** Log today as practiced (call on any graded finish). */
export function markPracticed(): void {
  try {
    const days = readDays();
    const today = dayStamp();
    if (!days.includes(today)) {
      days.push(today);
      window.localStorage.setItem(DAYS_KEY, JSON.stringify(days.slice(-366)));
    }
  }
  catch { /* private browsing */ }
}

// ---------------------------------------------------------------------------
// What to practice next: a three-step session from the record.

export interface SessionStep {
  title: string;
  why: string;
  go: { view: 'songs' | 'drills'; songId?: string };
}

export function suggestSession(
  songs: { id: string; title: string }[], progress: Progress,
): SessionStep[] {
  const bestBySong = new Map<string, SongBest>();
  for (const b of progress.songBests) {
    const cur = bestBySong.get(b.songId);
    if (!cur || b.tempoPct > cur.tempoPct || (b.tempoPct === cur.tempoPct && b.accuracy > cur.accuracy)) {
      bestBySong.set(b.songId, b);
    }
  }
  const untouched = songs.find((s) => !bestBySong.get(s.id));
  const inProgress = [...bestBySong.entries()]
    .map(([songId, best]) => ({ song: songs.find((s) => s.id === songId), best }))
    .filter((x): x is { song: { id: string; title: string }; best: SongBest } => !!x.song)
    .sort((a, b) => a.best.tempoPct - b.best.tempoPct || a.best.accuracy - b.best.accuracy)[0];

  const steps: SessionStep[] = [];
  const focus = inProgress?.song ?? untouched ?? songs[0];
  if (focus) {
    steps.push({
      title: `Warm up: ${focus.title} grabs`,
      why: 'exact chord shapes from the song you are about to play',
      go: { view: 'drills', songId: focus.id },
    });
    if (inProgress && inProgress.song.id === focus.id) {
      const { best } = inProgress;
      const nextTempo = best.accuracy >= 85 ? Math.min(120, best.tempoPct + 10) : best.tempoPct;
      steps.push({
        title: `${focus.title} — play-along at ${nextTempo}%`,
        why: best.accuracy >= 85
          ? `you hit ${best.accuracy}% at ${best.tempoPct}% — time to speed up`
          : `best so far ${best.accuracy}% at ${best.tempoPct}% — beat it before speeding up`,
        go: { view: 'songs', songId: focus.id },
      });
    }
    else {
      steps.push({
        title: `${focus.title} — first graded take`,
        why: 'no play-along on record yet; start at 70% tempo',
        go: { view: 'songs', songId: focus.id },
      });
    }
  }
  const staleSong = songs.find((s) => s.id !== focus?.id && bestBySong.has(s.id)) ??
    songs.find((s) => s.id !== focus?.id);
  if (staleSong) {
    steps.push({
      title: `Keep ${staleSong.title} warm`,
      why: 'one relaxed pass so the last song stays in your hands',
      go: { view: 'songs', songId: staleSong.id },
    });
  }
  return steps;
}
