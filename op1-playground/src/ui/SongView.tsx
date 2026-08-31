// The Songs view, built like a practice stand: the source score image on top,
// the full OP-1 keyboard right under it lighting up where your fingers go, and
// step controls (arrow keys work too) that walk the song moment by moment.
// Playback drives the same keyboard. Everything below — bar cards, part grids,
// the text tab — is reference material.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Note } from 'tonal';
import { formulaFromIntervals, keyLabel, prettyNote, prettyNumeral } from '../theory/harmony';
import { OP1_BASE_MIDI, keyTag, rangeLabel } from '../op1/op1';
import { CompiledBar, CompiledSection, PartId, compileScore, expandPasses, gridFor, playbackFor, practicePlayback } from '../songs/compile';
import { FIGURES } from '../songs/figures';
import { Moment, firstMomentOfBar, momentsOf } from '../songs/moments';
import { Score } from '../songs/types';
import { SCORE_TEMPLATE, parseScoreJson, scoreToJson } from '../songs/parse';
import { SONGS } from '../data/songs';
import { buildSongChart, songMidiFilename } from '../export/songTab';
import { player } from '../audio/player';
import { buildMidiFile, downloadBlob } from '../audio/midiExport';
import { webMidiIn } from '../audio/webmidi';
import { Grader, expectedFor } from '../practice/score';
import { INDEX_TO_QWERTY, qwertyIndex } from '../practice/qwerty';
import { clearTrouble, dayStamp, markPracticed, readTrouble, recordTake, recordTrouble, topTrouble } from '../practice/progress';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { NavTabs, ViewId } from './NavTabs';

const STORE_KEY = 'op1playground.songs';

export function loadImportedSongs(): Score[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const parsed = parseScoreJson(JSON.stringify(item));
      return parsed.ok ? [parsed.score] : [];
    });
  }
  catch {
    return [];
  }
}

const saveImportedSongs = (songs: Score[]): void => {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(songs));
  }
  catch {
    // private browsing / quota — the song still works for this session
  }
};

/** Chord voicing as dim keys; root flagged. The base layer of the display. */
function litForBar(bar: CompiledBar): Map<number, LitKey> {
  const names = new Map<number, string>();
  bar.chord.notes.forEach((n) => {
    const chroma = Note.chroma(n);
    if (chroma !== undefined && chroma !== null) names.set(chroma, prettyNote(n));
  });
  const bassChroma = Note.chroma(bar.chord.bass ?? bar.chord.root) ?? -1;
  const lit = new Map<number, LitKey>();
  bar.voicing.midis.forEach((midi) => {
    const index = midi - OP1_BASE_MIDI;
    lit.set(index, { label: names.get(midi % 12) ?? '', isRoot: midi % 12 === bassChroma });
  });
  return lit;
}

/** The performance display: chord layer, plus the moment's own keys marked hot. */
function litForMoment(bar: CompiledBar, moment: Moment | undefined): Map<number, LitKey> {
  const lit = litForBar(bar);
  if (moment?.kind === 'notes') {
    moment.keys.forEach((key, i) => {
      lit.set(key, { label: moment.names[i]?.replace(/-?\d+$/, '') ?? '', isRoot: true });
    });
  }
  return lit;
}

function copyText(text: string, onDone: () => void): void {
  navigator.clipboard?.writeText(text).then(onDone).catch(() => {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    onDone();
  });
}

const scoreImageSrc = (image: string): string =>
  image.startsWith('data:') ? image : import.meta.env.BASE_URL + image;

export interface SongViewProps {
  onNav: (view: ViewId) => void;
  initialSongId?: string;
}

export function SongView({ onNav, initialSongId }: SongViewProps) {
  const [imported, setImported] = useState<Score[]>(() => loadImportedSongs());
  const library = useMemo(() => [...SONGS, ...imported], [imported]);
  const [songId, setSongId] = useState(() =>
    (initialSongId && library.some((s) => s.id === initialSongId) ? initialSongId : library[0]?.id) ?? '');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [smooth, setSmooth] = useState(false);
  const [chordsOn, setChordsOn] = useState(true);
  const [partOn, setPartOn] = useState(true);
  const [wholeSong, setWholeSong] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playingBar, setPlayingBar] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState<'tab' | 'json' | 'midi' | null>(null);
  const [tempoPct, setTempoPct] = useState(100);
  const [metronome, setMetronome] = useState(false);
  const [countIn, setCountIn] = useState(true);
  const [loopFrom, setLoopFrom] = useState(0);
  const [loopTo, setLoopTo] = useState(Infinity);
  const [playAlong, setPlayAlong] = useState(false);
  const [alongStats, setAlongStats] = useState<{ hits: number; expected: number; extras: number; avgAbsMs: number; accuracy: number } | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [judge, setJudge] = useState<Map<number, 'hit' | 'miss'>>(() => new Map());
  const [midiInName, setMidiInName] = useState<string | null>(null);
  const [troubleTick, setTroubleTick] = useState(0);
  const [partScope, setPartScope] = useState<'both' | PartId>('both');
  const graderRef = useRef<Grader | null>(null);
  const alongT0 = useRef(0);
  const judgeTimers = useRef<number[]>([]);
  const midiUnsub = useRef<(() => void) | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState(SCORE_TEMPLATE);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const playToken = useRef(0);

  const score = useMemo(() => library.find((s) => s.id === songId) ?? library[0], [library, songId]);
  const song = useMemo(() => (score ? compileScore(score, { smooth }) : undefined), [score, smooth]);
  const sections = song?.sections ?? [];
  const section: CompiledSection | undefined = sections[Math.min(sectionIdx, sections.length - 1)];
  const moments = useMemo(() => (section ? momentsOf(section) : []), [section]);
  const moment = moments[Math.min(stepIdx, moments.length - 1)];
  const bar = section?.bars[moment?.barIdx ?? 0];
  const chart = useMemo(() => (song ? buildSongChart(song) : ''), [song]);

  const playedSections = useMemo(
    () => (wholeSong ? sections : section ? [section] : []),
    [wholeSong, sections, section],
  );
  const passBars = useMemo(() => playedSections.flatMap((s) => expandPasses(s)), [playedSections]);

  const bestKey = `op1playground.best.${score?.id}.${section?.id}.${tempoPct}${partScope === 'both' ? '' : `~${partScope}`}`;

  useEffect(() => { setSectionIdx(0); setStepIdx(0); setTempoPct(100); }, [songId]);
  useEffect(() => { setStepIdx(0); setLoopFrom(0); setLoopTo(Infinity); setPartScope('both'); }, [sectionIdx, songId]);
  useEffect(() => {
    setAlongStats(null);
    try {
      const stored = window.localStorage.getItem(bestKey);
      setBestScore(stored === null ? null : Number(stored));
    }
    catch {
      setBestScore(null);
    }
  }, [bestKey]);

  const stop = useCallback(() => {
    player.stop();
    setPlaying(false);
    setPlayingBar(null);
    setPlayingIndex(null);
    midiUnsub.current?.();
    midiUnsub.current = null;
    for (const t of judgeTimers.current) window.clearTimeout(t);
    judgeTimers.current = [];
    setJudge(new Map());
    const grader = graderRef.current;
    graderRef.current = null;
    if (grader && grader.stats().hits + grader.stats().extras > 0) {
      const accuracy = grader.accuracy;
      setAlongStats({ ...grader.stats(), accuracy });
      markPracticed();
      if (score && section) {
        recordTrouble(score.id, grader.missedByKey());
        setTroubleTick((t) => t + 1);
        recordTake({
          d: dayStamp(), songId: score.id, sectionId: section.id,
          tempoPct, accuracy,
          ...(partScope === 'both' ? {} : { scope: partScope }),
        });
      }
      try {
        const prev = Number(window.localStorage.getItem(bestKey) ?? -1);
        if (accuracy > prev) {
          window.localStorage.setItem(bestKey, String(accuracy));
          setBestScore(accuracy);
          setNewBest(true);
          window.setTimeout(() => setNewBest(false), 1600);
        }
      }
      catch { /* private browsing */ }
    }
  }, [bestKey]);

  // never let the sound and the display drift apart
  useEffect(() => { stop(); }, [chart, wholeSong, chordsOn, partOn, sectionIdx, tempoPct, metronome, countIn, loopFrom, loopTo, partScope, stop]);
  useEffect(() => stop, [stop]);

  const shift = section?.octaveShift ?? 0;

  /** Step to a moment and let you hear what that press sounds like. */
  const goToStep = useCallback((next: number, audible: boolean) => {
    if (!moments.length) return;
    const clamped = Math.max(0, Math.min(moments.length - 1, next));
    setStepIdx(clamped);
    const m = moments[clamped];
    if (!audible || !m) return;
    if (m.kind === 'chord') void player.audition(m.midis.map((x) => x + 12 * shift));
    else for (const midi of m.midis) void player.auditionNote(midi + 12 * shift);
  }, [moments, shift]);

  const stepBar = useCallback((dir: 1 | -1) => {
    if (!section || !moment) return;
    const targetBar = Math.max(0, Math.min(section.bars.length - 1, moment.barIdx + dir));
    goToStep(firstMomentOfBar(moments, targetBar), true);
  }, [section, moment, moments, goToStep]);

  /** One incoming press (QWERTY or hardware) while play-along is armed. */
  const feedPress = useCallback((midi: number, sound: boolean) => {
    const grader = graderRef.current;
    if (!grader) return;
    if (sound) void player.auditionNote(midi);
    const relMs = performance.now() - alongT0.current;
    const verdict = grader.play(relMs, midi);
    setJudge((prev) => {
      const next = new Map(prev);
      next.set(verdict.index, verdict.kind);
      return next;
    });
    const timer = window.setTimeout(() => {
      setJudge((prev) => {
        const next = new Map(prev);
        next.delete(verdict.index);
        return next;
      });
    }, 260);
    judgeTimers.current.push(timer);
    setAlongStats({ ...grader.stats(), accuracy: grader.accuracy });
  }, []);

  // QWERTY piano: active whenever play-along is running
  useEffect(() => {
    if (!playAlong || !playing) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const index = qwertyIndex(e.key);
      if (index === undefined) return;
      e.preventDefault();
      feedPress(OP1_BASE_MIDI + index + 12 * shift, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playAlong, playing, shift, feedPress]);

  // arrow keys drive the walk: ←/→ one moment, shift+←/→ one bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (e.shiftKey) stepBar(dir);
      else goToStep(stepIdx + dir, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIdx, goToStep, stepBar]);

  if (!score || !song || !section || !moment || !bar) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand"><div className="mark">F4</div><div className="brand-name">SONGS</div></div>
          <NavTabs active="songs" onNav={onNav} />
        </header>
        <p className="meta-line">No songs in the library yet.</p>
      </div>
    );
  }

  const rangeLo = Math.max(0, Math.min(loopFrom, loopTo));
  const rangeHi = Math.min(section ? section.bars.length - 1 : 0, Math.max(loopFrom, loopTo));
  const rangeActive = !wholeSong && section !== undefined &&
    (rangeLo > 0 || rangeHi < section.bars.length - 1);
  const practiceBpm = Math.max(30, Math.min(240, Math.round(score.bpm * tempoPct / 100)));

  const start = async () => {
    const token = ++playToken.current;
    const scope = partScope === 'both' ? undefined : partScope;
    const spec = wholeSong
      ? playbackFor(playedSections)
      : practicePlayback(section, rangeLo, rangeHi, undefined, scope);
    const practiceBars = wholeSong ? [] : section.bars.filter((b) => b.index >= rangeLo && b.index <= rangeHi);
    if (playAlong && !wholeSong) {
      graderRef.current = new Grader(expectedFor(section, rangeLo, rangeHi, practiceBpm, scope));
      setAlongStats(null);
      const unsub = await webMidiIn.listen((midi) => feedPress(midi, false));
      midiUnsub.current = unsub;
      const names = await webMidiIn.inputNames();
      setMidiInName(names[0] ?? null);
    }
    await player.play({
      slots: spec.slots,
      melody: spec.melody,
      bpm: practiceBpm,
      swing: 0,
      arp: 'off',
      chordsOn: playAlong ? false : chordsOn,
      melodyOn: playAlong ? false : partOn,
      beatsPerBar: song.meter[0],
      countInBeats: countIn ? song.meter[0] : 0,
      click: metronome,
      onSlot: (i) => {
        if (i === null) { setPlayingBar(null); return; }
        const bar = wholeSong ? passBars[i]?.bar : practiceBars[i];
        if (!bar) return;
        setPlayingBar(bar.index);
        if (wholeSong) {
          const sectionOf = playedSections.findIndex((s) => s.bars.includes(bar));
          if (sectionOf >= 0) setSectionIdx(sectionOf);
        }
        // keep the step cursor trailing playback so stopping leaves you in place
        setStepIdx(firstMomentOfBar(momentsOf(playedSections.find((s) => s.bars.includes(bar)) ?? section), bar.index));
      },
      onMelody: (midi) => setPlayingIndex(midi === null ? null : midi - OP1_BASE_MIDI - 12 * shift),
    });
    // grading clock starts when the count-in ends (transport starts at +0.05s)
    const countInMs = (countIn ? song.meter[0] : 0) * (60000 / practiceBpm);
    alongT0.current = performance.now() + 50 + countInMs;
    if (token === playToken.current) setPlaying(true);
  };

  const auditionBar = (b: CompiledBar) => {
    void player.audition(b.voicing.midis.map((m) => m + 12 * shift));
  };

  const exportMidi = () => {
    const spec = playbackFor(playedSections);
    downloadBlob(buildMidiFile({
      name: `${score.title} — OP-1 tab`,
      bpm: score.bpm,
      swing: 0,
      arp: 'off',
      slots: spec.slots,
      melody: spec.melody,
      includeChords: chordsOn,
      includeMelody: partOn,
    }), songMidiFilename(score.title));
    setCopied('midi');
    window.setTimeout(() => setCopied(null), 1400);
  };

  const flash = (what: 'tab' | 'json') => () => {
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const runImport = () => {
    const parsed = parseScoreJson(importText);
    if (!parsed.ok) { setImportErrors(parsed.errors); return; }
    const next = [...imported.filter((s) => s.id !== parsed.score.id), parsed.score];
    setImported(next);
    saveImportedSongs(next);
    setImportErrors([]);
    setImportOpen(false);
    setSongId(parsed.score.id);
  };

  const removeImported = (id: string) => {
    const next = imported.filter((s) => s.id !== id);
    setImported(next);
    saveImportedSongs(next);
    if (songId === id) setSongId(SONGS[0]?.id ?? next[0]?.id ?? '');
  };

  const trouble = useMemo(
    () => (score ? topTrouble(readTrouble(score.id)) : []),
    // troubleTick invalidates after each graded take
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [score?.id, troubleTick],
  );

  // while playing, the keyboard follows the transport; stopped, it shows the step
  const displayBar = playing && playingBar !== null ? section.bars[playingBar] ?? bar : bar;
  const displayLit = playing && playingBar !== null
    ? litForBar(displayBar)
    : litForMoment(bar, moment);
  const flashIndex = playing ? playingIndex : null;
  const parts = section.notes.length ? [...new Set(section.notes.map((n) => n.part))] : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">F4</div>
          <div>
            <div className="brand-name">SONG TABS</div>
            <div className="brand-sub">
              {score.title} · {keyLabel(song.key)} · {song.meter[0]}/{song.meter[1]} · ♩={score.bpm}
              {score.feel ? ` · ${score.feel.toLowerCase()}` : ''}
            </div>
          </div>
        </div>
        <div className="transport">
          <label className="smooth-toggle">
            <input type="checkbox" checked={chordsOn} onChange={(e) => setChordsOn(e.target.checked)} />
            chords
          </label>
          <label className="smooth-toggle">
            <input type="checkbox" checked={partOn} onChange={(e) => setPartOn(e.target.checked)} />
            written part
          </label>
          <label className="smooth-toggle">
            <input type="checkbox" checked={wholeSong} onChange={(e) => setWholeSong(e.target.checked)} />
            whole song
          </label>
          <button className={`primary-btn${playing ? ' stop' : ''}`} onClick={playing ? stop : () => void start()}>
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <button className="tool-btn" onClick={() => copyText(chart, flash('tab'))}>
            {copied === 'tab' ? 'Copied' : 'Copy tab'}
          </button>
          <button className="tool-btn" onClick={exportMidi}>{copied === 'midi' ? 'Saved' : 'MIDI'}</button>
          <NavTabs active="songs" onNav={onNav} />
        </div>
      </header>

      <section className="preset-zone">
        <div className="preset-filters">
          <span className="mini-label">songs</span>
          <button className="chip" onClick={() => { setImportText(SCORE_TEMPLATE); setImportErrors([]); setImportOpen(true); }}>
            + import a score
          </button>
        </div>
        <div className="preset-rail">
          {library.map((s) => (
            <button key={s.id} className={`preset-card${s.id === score.id ? ' preset-on' : ''}`}
              onClick={() => setSongId(s.id)}>
              <strong>{s.title}</strong>
              <span className="preset-tokens">
                {s.sections.map((sec) => sec.name).join(' · ')}
              </span>
              <small>{s.artist ? `${s.artist} — ` : ''}{s.source ?? 'transcribed score'}</small>
              <em>
                {keyLabel(s.key)} · ♩={s.bpm}
                {imported.some((i) => i.id === s.id) ? ' · imported' : ''}
              </em>
              {imported.some((i) => i.id === s.id) && (
                <span className="card-remove" title="remove imported song"
                  onClick={(e) => { e.stopPropagation(); removeImported(s.id); }}>×</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <main className="song-flow">
        <section className="perform-zone">
          {score.image && (
            <div className="score-image">
              <img src={scoreImageSrc(score.image)} alt={`score: ${score.title}`} />
            </div>
          )}

          <div className="perform-readout">
            <div className="perform-now">
              <div className="perform-chord">
                <span className={`numeral numeral-${displayBar.chord.func}`}>
                  {displayBar.chord.numeral ? prettyNumeral(displayBar.chord.numeral) : '—'}
                </span>
                <h1>{displayBar.chord.symbol}</h1>
              </div>
              <div className="meta-line">
                {playing
                  ? `playing · bar ${displayBar.number}`
                  : `${moment.label} · step ${stepIdx + 1}/${moments.length}`}
                {' · '}{section.name}
                {section.passes > 1 ? ` (play ${section.passes}×)` : ''}
              </div>
            </div>
            <div className="perform-oct">
              <span className="mini-label">octave switch</span>
              <strong>OCT {shift > 0 ? `+${shift}` : shift}</strong>
              <em>keys sound {rangeLabel(shift)}</em>
            </div>
            <div className="perform-keys">
              <span className="mini-label">{playing || moment.kind === 'chord' ? 'hold' : 'press'}</span>
              <strong>
                {playing || moment.kind === 'chord'
                  ? displayBar.keyTags.join(' · ')
                  : moment.keys.map((k) => keyTag(k)).join(' · ')}
              </strong>
              <em>{(playing || moment.kind === 'chord' ? displayBar.sounding : moment.names).join(' · ')}</em>
            </div>
            {sections.length > 1 && (
              <div className="mode-picker">
                {sections.map((s, i) => (
                  <button key={s.id} className={i === sectionIdx ? 'chip chip-on' : 'chip'}
                    onClick={() => setSectionIdx(i)}>{s.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="perform-keyboard">
            <Op1Keyboard lit={displayLit} flashIndex={flashIndex} judge={judge} fluid />
          </div>

          <div className="perform-controls">
            <button className="tool-btn" title="previous bar (shift+←)" onClick={() => stepBar(-1)}>⏮ bar</button>
            <button className="tool-btn" title="previous step (←)" onClick={() => goToStep(stepIdx - 1, true)}>◀ step</button>
            <button className="tool-btn" title="next step (→)" onClick={() => goToStep(stepIdx + 1, true)}>step ▶</button>
            <button className="tool-btn" title="next bar (shift+→)" onClick={() => stepBar(1)}>bar ⏭</button>
            <button className="tool-btn" onClick={() => auditionBar(bar)}>Audition bar</button>
            <span className="meta-line">← → step through · shift+← → jump bars</span>
          </div>

          <div className="practice-strip">
            <span className="mini-label">practice</span>
            <label className="practice-tempo" title="practice tempo — start slow, earn the real one">
              <input type="range" min={40} max={120} step={5} value={tempoPct}
                onChange={(e) => setTempoPct(Number(e.target.value))} />
              <strong>{tempoPct}%</strong>
              <em>♩={practiceBpm}</em>
            </label>
            <label className="smooth-toggle" title="one bar of clicks before the top; the loop skips it on repeats">
              <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />
              count-in
            </label>
            <label className="smooth-toggle" title="click through the music, accented on bar starts">
              <input type="checkbox" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} />
              metronome
            </label>
            {!wholeSong && parts.length > 1 && (
              <span className="practice-range" title="which written part plays and gets graded">
                <span className="mini-label">hands</span>
                {(['both', 'melody', 'left'] as const).map((p) => (
                  <button key={p} className={partScope === p ? 'chip chip-on' : 'chip'}
                    onClick={() => setPartScope(p)}>{p === 'melody' ? 'right' : p}</button>
                ))}
              </span>
            )}
            {!wholeSong && section.bars.length > 1 && (
              <span className="practice-range">
                <span className="mini-label">loop bars</span>
                <select value={rangeLo} onChange={(e) => setLoopFrom(Number(e.target.value))}>
                  {section.bars.map((b) => <option key={b.index} value={b.index}>{b.number}</option>)}
                </select>
                <span>–</span>
                <select value={rangeHi} onChange={(e) => setLoopTo(Number(e.target.value))}>
                  {section.bars.map((b) => <option key={b.index} value={b.index}>{b.number}</option>)}
                </select>
                {rangeActive && (
                  <button className="tool-btn" title="loop the whole section again"
                    onClick={() => { setLoopFrom(0); setLoopTo(Infinity); }}>clear</button>
                )}
              </span>
            )}
            {tempoPct !== 100 && (
              <button className="tool-btn" onClick={() => setTempoPct(100)}>full speed</button>
            )}
            {!wholeSong && (
              <button className={`tool-btn${playAlong ? ' hw-on' : ''}`}
                title="the app goes quiet except the click and grades what you play — OP-1 over USB MIDI, or the QWERTY piano"
                onClick={() => setPlayAlong((v) => !v)}>
                {playAlong ? '🎹 Play-along ON' : '🎹 Play-along'}
              </button>
            )}
          </div>

          {playAlong && !wholeSong && (
            <div className="along-panel">
              <div className="meta-line">
                {playing
                  ? `listening — ${midiInName ?? 'no MIDI input'} · QWERTY piano armed (Z-row + Q-row)`
                  : 'press ▶ Play: you get the count-in and the click, then the app listens and grades you'}
              </div>
              <div className="along-stats">
                {alongStats ? (
                  <>
                    <span className={`along-score${newBest ? ' new-best' : ''}`}>{alongStats.accuracy}%</span>
                    <span>{alongStats.hits}/{alongStats.expected} notes</span>
                    <span>{alongStats.extras} stray</span>
                    <span>±{alongStats.avgAbsMs}ms feel</span>
                  </>
                ) : (
                  <span className="meta-line">no take yet at this tempo</span>
                )}
                {bestScore !== null && <span className="along-best">best {bestScore}%</span>}
              </div>
              {trouble.length > 0 && (
                <div className="trouble-row">
                  <span className="mini-label">trouble keys</span>
                  {trouble.map((t) => (
                    <span key={t.index} className="trouble-chip" title={`missed ${t.count}× across your takes`}>
                      {keyTag(t.index)} ×{t.count}
                    </span>
                  ))}
                  <button className="tool-btn" title="forget these and start fresh"
                    onClick={() => { clearTrouble(score.id); setTroubleTick((t) => t + 1); }}>reset</button>
                </div>
              )}
              <div className="qwerty-hint">
                {INDEX_TO_QWERTY.map((k, i) => (
                  <span key={i} className={`qwerty-key${judge.get(i) ? ` q-${judge.get(i)}` : ''}`}>{k}</span>
                ))}
              </div>
            </div>
          )}

          {section.note && <p className="section-note">{section.note}</p>}
          {bar.figure && !playing && (
            <p className="section-note">
              Left hand: {FIGURES[bar.figure].blurb.toLowerCase()} (stand-in figure — {FIGURES[bar.figure].label}).
            </p>
          )}
        </section>

        {score.caveats?.length ? (
          <section className="caveat-strip">
            <span className="mini-label">transcription notes</span>
            <ul>{score.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
        ) : null}

        <section className="song-bars">
          <div className="section-head">
            <div>
              <h1>{section.name} — bar by bar</h1>
              <div className="meta-line">
                {section.bars.length} bars
                {section.passes > 1 ? ` · play ${section.passes}×` : ''}
                {' · '}click a bar to jump the keyboard there
              </div>
            </div>
          </div>

          <div className="slot-grid">
            {section.bars.map((b) => (
              <article key={b.index}
                className={`slot-card func-${b.chord.func}${b.index === moment.barIdx ? ' slot-active' : ''}${playingBar === b.index ? ' slot-playing' : ''}${rangeActive && b.index >= rangeLo && b.index <= rangeHi ? ' slot-looped' : ''}`}
                onClick={() => goToStep(firstMomentOfBar(moments, b.index), false)}>
                <div className="slot-top">
                  <span className={`numeral numeral-${b.chord.func}`}>
                    {b.chord.numeral ? prettyNumeral(b.chord.numeral) : '—'}
                  </span>
                  <span>bar {b.number}{b.ending ? ` · ${b.ending}st ending` : ''}</span>
                  <button title="play this bar" onClick={(e) => { e.stopPropagation(); auditionBar(b); }}>▶</button>
                </div>
                <div className="slot-symbol">{b.chord.symbol}</div>
                <div className="slot-tones">{b.keyTags.join(' · ')}</div>
                <div className="slot-tones">
                  {formulaFromIntervals(b.chord.intervals)} · {b.voicing.label}
                  {b.mark ? ` · ${b.mark}` : ''}
                </div>
              </article>
            ))}
          </div>

          {parts.map((part) => {
            const partNotes = section.notes.filter((n) => n.part === part);
            const grid = gridFor(partNotes, section.bars);
            return (
            <div key={part} className="part-block">
              <div className="section-head compact-head">
                <div>
                  <h2>{part === 'left' ? 'Left hand' : 'Melody'}</h2>
                  <div className="meta-line">
                    {grid.label} grid · {partNotes.some((n) => n.derived)
                      ? 'stand-in figure from the chord tones'
                      : 'as written on the page'} · click a cell to hear it
                  </div>
                </div>
              </div>
              <div className="melody-strip">
                {section.bars.map((b) => {
                  const inBar = partNotes.filter((n) => n.barIdx === b.index);
                  const cellCount = Math.max(1, Math.round(b.beats * grid.cells));
                  const cells: ({ tag: string; name: string; index: number; ghost: boolean; folded: boolean } | 'hold' | null)[] =
                    Array.from({ length: cellCount }, () => null);
                  for (const note of inBar) {
                    const cell = Math.round((note.start - b.startBeat) * grid.cells);
                    if (cell < 0 || cell >= cellCount) continue;
                    cells[cell] = {
                      tag: note.keyTag, name: note.name, index: note.index,
                      ghost: note.ghost, folded: note.folded,
                    };
                    const held = Math.min(cellCount, cell + Math.round(note.dur * grid.cells));
                    for (let c = cell + 1; c < held; c++) if (cells[c] === null) cells[c] = 'hold';
                  }
                  return (
                    <div key={b.index} className="melody-bar">
                      <div className="melody-bar-label">
                        <span>{String(b.number).padStart(2, '0')}</span>
                        <strong>{b.chord.symbol}</strong>
                      </div>
                      <div className="melody-cells" style={{ gridTemplateColumns: `repeat(${cellCount}, 1fr)` }}>
                        {cells.map((cell, i) => {
                          if (cell === null) return <div key={i} className="melody-cell melody-rest">·</div>;
                          if (cell === 'hold') return <div key={i} className="melody-cell melody-hold">—</div>;
                          const active = playing ? playingIndex === cell.index : false;
                          return (
                            <button key={i}
                              className={`melody-cell melody-note melody-chord${active ? ' melody-active' : ''}${cell.ghost ? ' melody-ghost' : ''}`}
                              title={cell.folded ? `${cell.name} — folded an octave to fit` : cell.name}
                              onClick={() => void player.auditionNote(OP1_BASE_MIDI + cell.index + 12 * shift)}>
                              <span>{cell.tag}{cell.folded ? '*' : ''}</span>
                              <small>{cell.name}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}

          <label className="smooth-toggle">
            <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
            smooth voice-leading where the page leaves the inversion open
          </label>
        </section>

        <section className="tab-zone">
          <div className="section-head">
            <div>
              <h1>Song Tab</h1>
              <div className="meta-line">
                {song.totalBars} bars · B = bottom row, T = raised row · * = folded an octave to fit
              </div>
            </div>
            <div className="melody-controls">
              <button className="tool-btn" onClick={() => copyText(scoreToJson(score), flash('json'))}>
                {copied === 'json' ? 'Copied' : 'Copy score JSON'}
              </button>
              <button className="tool-btn" onClick={() => copyText(chart, flash('tab'))}>
                {copied === 'tab' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <pre className="tab-output">{chart}</pre>
        </section>
      </main>

      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <div>
                <h1>Import a score</h1>
                <div className="meta-line">
                  paste a transcribed score — see docs/adding-a-song.md for the shape
                </div>
              </div>
              <button className="tool-btn" onClick={() => setImportOpen(false)}>Close</button>
            </div>
            <textarea className="import-area" spellCheck={false} value={importText}
              onChange={(e) => setImportText(e.target.value)} />
            {importErrors.length > 0 && (
              <div className="parse-warnings">{importErrors.map((e, i) => <span key={i}>{e}</span>)}</div>
            )}
            <div className="melody-controls">
              <button className="tool-btn" onClick={() => setImportText(SCORE_TEMPLATE)}>Reset to template</button>
              <button className="primary-btn" onClick={runImport}>Add to library</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
