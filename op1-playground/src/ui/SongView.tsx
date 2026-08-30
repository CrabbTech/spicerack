// The Songs view, built like a practice stand: the source score image on top,
// the full OP-1 keyboard right under it lighting up where your fingers go, and
// step controls (arrow keys work too) that walk the song moment by moment.
// Playback drives the same keyboard. Everything below — bar cards, part grids,
// the text tab — is reference material.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Note } from 'tonal';
import { formulaFromIntervals, keyLabel, prettyNote, prettyNumeral } from '../theory/harmony';
import { OP1_BASE_MIDI, keyTag, rangeLabel } from '../op1/op1';
import { CompiledBar, CompiledSection, compileScore, expandPasses, gridFor, playbackFor } from '../songs/compile';
import { FIGURES } from '../songs/figures';
import { Moment, firstMomentOfBar, momentsOf } from '../songs/moments';
import { Score } from '../songs/types';
import { SCORE_TEMPLATE, parseScoreJson, scoreToJson } from '../songs/parse';
import { SONGS } from '../data/songs';
import { buildSongChart, songMidiFilename } from '../export/songTab';
import { player } from '../audio/player';
import { buildMidiFile, downloadBlob } from '../audio/midiExport';
import { LitKey, Op1Keyboard } from './Op1Keyboard';

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
  onExit: () => void;
  initialSongId?: string;
}

export function SongView({ onExit, initialSongId }: SongViewProps) {
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

  useEffect(() => { setSectionIdx(0); setStepIdx(0); }, [songId]);
  useEffect(() => { setStepIdx(0); }, [sectionIdx]);

  const stop = useCallback(() => {
    player.stop();
    setPlaying(false);
    setPlayingBar(null);
    setPlayingIndex(null);
  }, []);

  // never let the sound and the display drift apart
  useEffect(() => { stop(); }, [chart, wholeSong, chordsOn, partOn, sectionIdx, stop]);
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
          <button className="tool-btn" onClick={onExit}>← Playground</button>
        </header>
        <p className="meta-line">No songs in the library yet.</p>
      </div>
    );
  }

  const start = async () => {
    const token = ++playToken.current;
    const spec = playbackFor(playedSections);
    await player.play({
      slots: spec.slots,
      melody: spec.melody,
      bpm: Math.max(40, Math.min(220, score.bpm)),
      swing: 0,
      arp: 'off',
      chordsOn,
      melodyOn: partOn,
      onSlot: (i) => {
        if (i === null) { setPlayingBar(null); return; }
        const passBar = passBars[i];
        if (!passBar) return;
        setPlayingBar(passBar.bar.index);
        if (wholeSong) {
          const sectionOf = playedSections.findIndex((s) => s.bars.includes(passBar.bar));
          if (sectionOf >= 0) setSectionIdx(sectionOf);
        }
        // keep the step cursor trailing playback so stopping leaves you in place
        setStepIdx(firstMomentOfBar(momentsOf(playedSections.find((s) => s.bars.includes(passBar.bar)) ?? section), passBar.bar.index));
      },
      onMelody: (midi) => setPlayingIndex(midi === null ? null : midi - OP1_BASE_MIDI - 12 * shift),
    });
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
          <button className="tool-btn" onClick={onExit}>← Playground</button>
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
            <Op1Keyboard lit={displayLit} flashIndex={flashIndex} fluid />
          </div>

          <div className="perform-controls">
            <button className="tool-btn" title="previous bar (shift+←)" onClick={() => stepBar(-1)}>⏮ bar</button>
            <button className="tool-btn" title="previous step (←)" onClick={() => goToStep(stepIdx - 1, true)}>◀ step</button>
            <button className="tool-btn" title="next step (→)" onClick={() => goToStep(stepIdx + 1, true)}>step ▶</button>
            <button className="tool-btn" title="next bar (shift+→)" onClick={() => stepBar(1)}>bar ⏭</button>
            <button className="tool-btn" onClick={() => auditionBar(bar)}>Audition bar</button>
            <span className="meta-line">← → step through · shift+← → jump bars</span>
          </div>

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
                className={`slot-card func-${b.chord.func}${b.index === moment.barIdx ? ' slot-active' : ''}${playingBar === b.index ? ' slot-playing' : ''}`}
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
