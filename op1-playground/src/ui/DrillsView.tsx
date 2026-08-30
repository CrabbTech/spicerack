// Drills: 10-card sprints that build the hand-to-name reflexes the songs
// lean on — chord grabs, physical key tags, note names. Press on the QWERTY
// piano or the connected OP-1; the clock runs, mistakes cost two seconds.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeySig, MODE_NAMES, ModeId, TONIC_CHOICES, prettyNote } from '../theory/harmony';
import { OP1_BASE_MIDI } from '../op1/op1';
import { mixSeeds, mulberry32 } from '../lib/rng';
import { DRILL_KINDS, DrillCard, DrillKind, SongDrillBar, judgePress, makeCard, makeSongCard, runScore } from '../practice/drills';
import { SONGS } from '../data/songs';
import { compileScore } from '../songs/compile';
import { NavTabs, ViewId } from './NavTabs';
import { INDEX_TO_QWERTY, qwertyIndex } from '../practice/qwerty';
import { webMidiIn } from '../audio/webmidi';
import { player } from '../audio/player';
import { markPracticed } from '../practice/progress';
import { LitKey, Op1Keyboard } from './Op1Keyboard';

const RUN_LENGTH = 10;
const MODE_ORDER: ModeId[] = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian'];

export interface DrillsViewProps {
  onNav: (view: ViewId) => void;
  /** open with this song's grab drill selected */
  initialSongId?: string;
}

export function DrillsView({ onNav, initialSongId }: DrillsViewProps) {
  const [kind, setKind] = useState<DrillKind>('chord');
  const [sourceId, setSourceId] = useState<'keys' | string>(
    () => (initialSongId && SONGS.some((s) => s.id === initialSongId) ? initialSongId : 'keys'));
  const [tonicIdx, setTonicIdx] = useState(0);
  const [mode, setMode] = useState<ModeId>('major');
  const [sevenths, setSevenths] = useState(false);
  const [runSeed, setRunSeed] = useState(1);
  const [cardIdx, setCardIdx] = useState<number | null>(null);
  const [collected, setCollected] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ score: number; mistakes: number; seconds: number } | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [judge, setJudge] = useState<Map<number, 'hit' | 'miss'>>(() => new Map());
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const judgeTimers = useRef<number[]>([]);
  const midiUnsub = useRef<(() => void) | null>(null);

  const key: KeySig = useMemo(() => ({ tonic: TONIC_CHOICES[tonicIdx], mode }), [tonicIdx, mode]);
  const songSource = useMemo(() => {
    const score = SONGS.find((s) => s.id === sourceId);
    if (!score) return undefined;
    const song = compileScore(score);
    const bars: SongDrillBar[] = song.sections.flatMap((sec) =>
      sec.bars.map((bar) => ({ bar, sectionName: sec.name })));
    return { title: score.title, bars };
  }, [sourceId]);
  const cards = useMemo(() => {
    const rng = mulberry32(mixSeeds(0xd811, runSeed));
    return Array.from({ length: RUN_LENGTH }, () =>
      songSource ? makeSongCard(songSource.bars, rng) : makeCard(kind, key, sevenths, rng));
  }, [kind, key, sevenths, runSeed, songSource]);
  const card: DrillCard | undefined = cardIdx === null ? undefined : cards[cardIdx];

  const bestKey = songSource
    ? `op1playground.drill.song.${sourceId}`
    : `op1playground.drill.${kind}.${key.tonic}.${key.mode}.${sevenths ? '7' : '3'}`;
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(bestKey);
      setBest(stored === null ? null : Number(stored));
    }
    catch {
      setBest(null);
    }
    setResult(null);
  }, [bestKey]);

  const stopRun = useCallback(() => {
    setCardIdx(null);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    for (const t of judgeTimers.current) window.clearTimeout(t);
    judgeTimers.current = [];
    setJudge(new Map());
    midiUnsub.current?.();
    midiUnsub.current = null;
  }, []);

  useEffect(() => stopRun, [stopRun]);
  useEffect(() => { stopRun(); setResult(null); }, [kind, key, sevenths, sourceId, stopRun]);

  const startRun = async () => {
    setRunSeed((s) => s + 1);
    setCardIdx(0);
    setCollected([]);
    setMistakes(0);
    setRevealed(false);
    setResult(null);
    setElapsed(0);
    startRef.current = performance.now();
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(
      () => setElapsed((performance.now() - startRef.current) / 1000), 100);
    midiUnsub.current = await webMidiIn.listen((midi) => pressRef.current(midi - OP1_BASE_MIDI));
  };

  const finishRun = useCallback((finalMistakes: number) => {
    const seconds = (performance.now() - startRef.current) / 1000;
    const score = runScore(performance.now() - startRef.current, finalMistakes);
    setResult({ score, mistakes: finalMistakes, seconds: Math.round(seconds * 10) / 10 });
    markPracticed();
    try {
      const prev = Number(window.localStorage.getItem(bestKey) ?? Infinity);
      if (score < prev) {
        window.localStorage.setItem(bestKey, String(score));
        setBest(score);
      }
    }
    catch { /* private browsing */ }
    stopRun();
  }, [bestKey, stopRun]);

  const flash = useCallback((index: number, verdict: 'hit' | 'miss') => {
    setJudge((prev) => new Map(prev).set(index, verdict));
    const t = window.setTimeout(() => {
      setJudge((prev) => {
        const next = new Map(prev);
        next.delete(index);
        return next;
      });
    }, 240);
    judgeTimers.current.push(t);
  }, []);

  const press = useCallback((index: number) => {
    if (index < 0 || index > 23 || cardIdx === null || revealed) return;
    const current = cards[cardIdx];
    void player.auditionNote(OP1_BASE_MIDI + index);
    const res = judgePress(current, index, collected);
    if (res.verdict === 'wrong') {
      setMistakes((m) => m + 1);
      flash(index, 'miss');
      return;
    }
    flash(index, 'hit');
    setCollected(res.collected);
    if (res.done) {
      setRevealed(true);
      window.setTimeout(() => {
        setRevealed(false);
        setCollected([]);
        if (cardIdx + 1 >= RUN_LENGTH) finishRun(mistakes);
        else setCardIdx(cardIdx + 1);
      }, 420);
    }
  }, [cardIdx, cards, collected, revealed, mistakes, flash, finishRun]);

  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; }, [press]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const index = qwertyIndex(e.key);
      if (index === undefined) return;
      e.preventDefault();
      pressRef.current(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lit = useMemo(() => {
    const map = new Map<number, LitKey>();
    if (card && revealed) {
      for (const r of card.reveal) map.set(r.index, { label: r.label, isRoot: r.isRoot });
    }
    else if (card?.targetChromas) {
      // show progress: collected chromas stay dimly lit on their keys
      for (let i = 0; i < 24; i++) {
        const chroma = (OP1_BASE_MIDI + i) % 12;
        if (collected.includes(chroma)) map.set(i, { label: '', isRoot: false });
      }
    }
    return map;
  }, [card, revealed, collected]);

  const running = cardIdx !== null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">F4</div>
          <div>
            <div className="brand-name">DRILLS</div>
            <div className="brand-sub">
              {songSource
                ? `song grabs · ${songSource.title}`
                : `${DRILL_KINDS.find((k) => k.id === kind)?.label} · ${prettyNote(key.tonic)} ${MODE_NAMES[key.mode]}${kind === 'chord' ? (sevenths ? ' · sevenths' : ' · triads') : ''}`}
            </div>
          </div>
        </div>
        <div className="transport">
          <NavTabs active="drills" onNav={onNav} />
        </div>
      </header>

      <section className="preset-zone">
        <div className="preset-filters">
          <span className="mini-label">drill from</span>
          <button className={sourceId === 'keys' ? 'chip chip-on' : 'chip'}
            onClick={() => setSourceId('keys')}>any key</button>
          {SONGS.map((s) => (
            <button key={s.id} className={sourceId === s.id ? 'chip chip-on' : 'chip'}
              title="chord grabs from this song's tab, exact keys"
              onClick={() => setSourceId(s.id)}>{s.title}</button>
          ))}
        </div>
      </section>

      {!songSource && (
      <section className="key-strip">
        <div className="key-picker" aria-label="key">
          {TONIC_CHOICES.map((tonic, i) => (
            <button key={tonic} className={i === tonicIdx ? 'key-on' : ''} onClick={() => setTonicIdx(i)}>
              {prettyNote(tonic)}
            </button>
          ))}
        </div>
        <div className="mode-picker" aria-label="mode">
          {MODE_ORDER.map((m) => (
            <button key={m} className={m === mode ? 'chip chip-on' : 'chip'} onClick={() => setMode(m)}>
              {MODE_NAMES[m]}
            </button>
          ))}
        </div>
      </section>
      )}

      <main className="drill-grid">
        <section className="drill-zone">
          {!songSource && (
          <div className="drill-kinds">
            {DRILL_KINDS.map((k) => (
              <button key={k.id} className={`drill-kind${k.id === kind ? ' drill-kind-on' : ''}`}
                onClick={() => setKind(k.id)}>
                <strong>{k.label}</strong>
                <small>{k.blurb}</small>
              </button>
            ))}
            {kind === 'chord' && (
              <label className="smooth-toggle">
                <input type="checkbox" checked={sevenths} onChange={(e) => setSevenths(e.target.checked)} />
                sevenths
              </label>
            )}
          </div>
          )}
          {songSource && (
            <p className="meta-line">
              chord grabs from <strong>{songSource.title}</strong> — {songSource.bars.length} bars in the pool,
              exact keys as the tab voices them
            </p>
          )}

          <div className="drill-card">
            {running && card ? (
              <>
                <div className="drill-progress">
                  card {cardIdx! + 1}/{RUN_LENGTH} · {elapsed.toFixed(1)}s · {mistakes} wrong
                </div>
                <h1 className="drill-prompt">{card.prompt}</h1>
                <div className="meta-line">{card.sub}</div>
              </>
            ) : result ? (
              <>
                <div className="drill-progress">run complete</div>
                <h1 className="drill-prompt">{result.score}s</h1>
                <div className="meta-line">
                  {result.seconds}s + {result.mistakes} wrong ×2s
                  {best !== null ? ` · best ${best}s` : ''}
                </div>
              </>
            ) : (
              <>
                <div className="drill-progress">ready</div>
                <h1 className="drill-prompt">{RUN_LENGTH} cards</h1>
                <div className="meta-line">
                  {DRILL_KINDS.find((k) => k.id === kind)?.blurb}
                  {best !== null ? ` · best ${best}s` : ''}
                </div>
              </>
            )}
            <div className="drill-actions">
              {running
                ? <button className="tool-btn" onClick={() => { stopRun(); setResult(null); }}>Abandon</button>
                : <button className="primary-btn" onClick={() => void startRun()}>▶ Start run</button>}
            </div>
          </div>

          <div className="perform-keyboard">
            <Op1Keyboard lit={lit} judge={judge} fluid />
          </div>

          <div className="qwerty-hint drill-hint">
            {INDEX_TO_QWERTY.map((k, i) => (
              <span key={i} className={`qwerty-key${judge.get(i) ? ` q-${judge.get(i)}` : ''}`}>{k}</span>
            ))}
          </div>
          <p className="meta-line drill-foot">
            QWERTY piano above, or plug the OP-1 in over USB — it just works. Wrong presses cost 2s.
          </p>
        </section>
      </main>
    </div>
  );
}
