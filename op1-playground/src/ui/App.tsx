import { useEffect, useMemo, useRef, useState } from 'react';
import { Note } from 'tonal';
import {
  ChordInfo, FuncTag, KeySig, MODE_NAMES, ModeId, TONIC_CHOICES,
  formulaFromIntervals, keyLabel, midiName, parseToken, prettyNote, prettyNumeral,
  scaleChromas, scaleNotes, tokenize,
} from '../theory/harmony';
import { Voicing, fitChord, handDistance, keyTag, midiToKeyIndex, rangeLabel, scaleKeyIndices } from '../op1/op1';
import { DEFAULT_MELODY_PARAMS, Contour, Density, MelodyParams, Register, generateMelody, segmentsOf } from '../theory/melody';
import { MOODS, Mood, autoFinish, nextCandidates, rollDice, spiceOptions } from '../theory/suggest';
import { PRESETS, Preset } from '../data/presets';
import { buildChart } from '../export/tab';
import { ArpStyle, player } from '../audio/player';
import { buildMidiFile, downloadBlob, midiFilename } from '../audio/midiExport';
import { webMidiOut, MidiOutInfo } from '../audio/webmidi';
import { mixSeeds, mulberry32 } from '../lib/rng';
import { LitKey, Op1Keyboard } from './Op1Keyboard';
import { MelodyStrip } from './MelodyStrip';
import { SongView } from './SongView';
import { DrillsView } from './DrillsView';
import { NavTabs, ViewId } from './NavTabs';
import { HomeView } from './HomeView';

interface UserSlot {
  id: number;
  token: string;
  bars: number;
}

const DEFAULT_TOKENS = ['Imaj7', 'vi7', 'IVmaj7', 'V7'];
const MODE_ORDER: ModeId[] = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian'];

const FUNC_LABEL: Record<FuncTag, string> = {
  tonic: 'tonic',
  subdominant: 'predominant',
  dominant: 'dominant',
  borrowed: 'borrowed color',
  secondary: 'secondary dominant',
};

const FUNC_COPY: Record<FuncTag, string> = {
  tonic: 'A resting sonority. It can hold the phrase, restart the loop, or move out to a predominant chord.',
  subdominant: 'A motion chord. It points away from home and usually sets up a dominant or a return.',
  dominant: 'The tension chord. Its pull wants to resolve, so landing on tonic will sound complete.',
  borrowed: 'A color chord from a nearby mode. It works best when its altered note moves by step.',
  secondary: 'A temporary dominant. Treat the chord it points at as a short-lived destination.',
};

let nextSlotId = 1;
const makeSlot = (token: string, bars = 1): UserSlot => ({ id: nextSlotId++, token, bars });

function litForChord(chord: ChordInfo, voicing: Voicing): Map<number, LitKey> {
  const labels = new Map<number, string>();
  chord.notes.forEach((n) => {
    const chroma = Note.chroma(n);
    if (chroma !== undefined && chroma !== null) labels.set(chroma, prettyNote(n));
  });
  const rootChroma = Note.chroma(chord.root) ?? -1;
  const lit = new Map<number, LitKey>();
  for (const midi of voicing.midis) {
    const index = midiToKeyIndex(midi);
    if (index < 0 || index >= 24) continue;
    const chroma = midi % 12;
    lit.set(index, { label: labels.get(chroma) ?? '', isRoot: chroma === rootChroma });
  }
  return lit;
}

function litForScale(key: KeySig): Map<number, LitKey> {
  const names = scaleNotes(key);
  const labels = new Map<number, string>();
  names.forEach((n) => {
    const chroma = Note.chroma(n);
    if (chroma !== undefined && chroma !== null) labels.set(chroma, prettyNote(n));
  });
  const chromas = scaleChromas(key);
  return new Map(scaleKeyIndices(chromas, chromas[0]).map((k) => {
    const chroma = (65 + k.index) % 12;
    return [k.index, { label: labels.get(chroma) ?? '', isRoot: k.isRoot }];
  }));
}

function motionLabel(prev: Voicing | undefined, current: Voicing): string {
  if (!prev) return 'start';
  const d = handDistance(prev.midis, current.midis);
  return d <= 5 ? 'tight' : d <= 11 ? 'medium' : 'wide';
}

function copyText(text: string, onDone: () => void): void {
  navigator.clipboard?.writeText(text).then(onDone).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    onDone();
  });
}

export default function App() {
  // ?song=<id> opens the song tab straight away (handy for screenshots)
  const initialSongId = useMemo(
    () => new URLSearchParams(window.location.search).get('song') ?? undefined, [],
  );
  const initialView = useMemo(() => new URLSearchParams(window.location.search).get('view'), []);
  const [view, setView] = useState<ViewId>(
    initialSongId ? 'songs'
      : initialView === 'drills' ? 'drills'
      : initialView === 'playground' ? 'playground'
      : initialView === 'songs' ? 'songs'
      : 'home');
  const [songFocus, setSongFocus] = useState<string | undefined>(initialSongId);
  const [tonicIdx, setTonicIdx] = useState(0);
  const [mode, setMode] = useState<ModeId>('major');
  const [slots, setSlots] = useState<UserSlot[]>(() => DEFAULT_TOKENS.map((t) => makeSlot(t)));
  const [draft, setDraft] = useState(DEFAULT_TOKENS.join(' '));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [bpm, setBpm] = useState(92);
  const [swing, setSwing] = useState(0.08);
  const [octaveShift, setOctaveShift] = useState(0);
  const [arp, setArp] = useState<ArpStyle>('off');
  const [smooth, setSmooth] = useState(true);
  const [melodyOn, setMelodyOn] = useState(true);
  const [melodyParams, setMelodyParams] = useState<MelodyParams>(DEFAULT_MELODY_PARAMS);
  const [mood, setMood] = useState<Mood>('wistful');
  const [diceLen, setDiceLen] = useState<4 | 8>(4);
  const [rollCount, setRollCount] = useState(0);
  const [finishCount, setFinishCount] = useState(0);
  const [vibe, setVibe] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playingSlot, setPlayingSlot] = useState<number | null>(null);
  const [playingMidi, setPlayingMidi] = useState<number | null>(null);
  const [copied, setCopied] = useState<'chart' | 'midi' | null>(null);
  const [midiOutputs, setMidiOutputs] = useState<MidiOutInfo[]>([]);
  const [midiOutId, setMidiOutId] = useState<string>('');
  const playToken = useRef(0);

  const key: KeySig = useMemo(() => ({ tonic: TONIC_CHOICES[tonicIdx], mode }), [tonicIdx, mode]);
  const parsed = useMemo(() => slots.map((s) => parseToken(s.token, key)), [slots, key]);
  const selected = parsed[Math.min(selectedIdx, parsed.length - 1)] ?? parsed[0];
  const selIdx = Math.max(0, Math.min(selectedIdx, parsed.length - 1));

  const voicings = useMemo(() => {
    const out: Voicing[] = [];
    parsed.forEach((p, i) => {
      out.push(fitChord(p.chord.notes, p.chord.intervals, { prev: out[i - 1]?.midis, smooth }));
    });
    return out;
  }, [parsed, smooth]);

  const parsedSlots = useMemo(
    () => parsed.map((p, i) => ({ chord: p.chord, bars: slots[i].bars })),
    [parsed, slots],
  );
  const melody = useMemo(() => generateMelody(parsedSlots, key, melodyParams), [parsedSlots, key, melodyParams]);
  const segments = useMemo(() => segmentsOf(parsedSlots), [parsedSlots]);
  const segmentLabels = useMemo(
    () => segments.map((seg) => parsed[seg.slotIdx]?.chord.symbol ?? ''),
    [segments, parsed],
  );

  const candidates = useMemo(
    () => nextCandidates(parsed[parsed.length - 1]?.chord, key),
    [parsed, key],
  );
  const spices = useMemo(
    () => spiceOptions(selIdx, parsed.map((p) => p.chord), key),
    [selIdx, parsed, key],
  );

  const chartSlots = useMemo(
    () => parsed.map((p, i) => ({ chord: p.chord, bars: slots[i].bars, voicing: voicings[i] })),
    [parsed, slots, voicings],
  );
  const chartOpts = useMemo(
    () => ({ key, bpm, swing, octaveShift, smooth }),
    [key, bpm, swing, octaveShift, smooth],
  );
  const chart = useMemo(
    () => buildChart(chartSlots, melodyOn ? melody : [], chartOpts),
    [chartSlots, melody, melodyOn, chartOpts],
  );
  const warnings = parsed.filter((p) => p.warning);

  const selectedVoicing = voicings[selIdx];
  const selectedLit = useMemo(
    () => (selected && selectedVoicing ? litForChord(selected.chord, selectedVoicing) : new Map<number, LitKey>()),
    [selected, selectedVoicing],
  );
  const scaleLit = useMemo(() => litForScale(key), [key]);

  useEffect(() => {
    if (selectedIdx >= parsed.length) setSelectedIdx(Math.max(0, parsed.length - 1));
  }, [parsed.length, selectedIdx]);

  const stopPlayback = () => {
    player.stop();
    setPlaying(false);
    setPlayingSlot(null);
    setPlayingMidi(null);
    if (midiOutId) webMidiOut.allNotesOff(midiOutId);
  };

  // structural edits stop the transport so the chart and the sound never diverge
  useEffect(() => {
    stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  const midiSend = midiOutId
    ? (midi: number, vel: number, durMs: number, atMs: number) => webMidiOut.send(midiOutId, midi, vel, durMs, atMs)
    : undefined;

  const startPlayback = async () => {
    const token = ++playToken.current;
    await player.play({
      slots: parsedSlots.map((s, i) => ({ bars: s.bars, midis: voicings[i].midis.map((m) => m + 12 * octaveShift) })),
      melody: melody.map((n) => ({ start: n.start, dur: n.dur, midi: n.midi + 12 * octaveShift })),
      bpm: Math.max(40, Math.min(220, bpm)),
      swing,
      arp,
      chordsOn: true,
      melodyOn,
      onSlot: setPlayingSlot,
      onMelody: (m) => setPlayingMidi(m === null ? null : m - 12 * octaveShift),
      midiSend,
    });
    if (token === playToken.current) setPlaying(true);
  };

  const syncSlots = (next: UserSlot[]) => {
    setSlots(next);
    setDraft(next.map((s) => s.token).join(' '));
  };

  const applyDraft = () => {
    const tokens = tokenize(draft);
    if (!tokens.length) return;
    setSlots(tokens.map((token, i) => ({ id: slots[i]?.id ?? nextSlotId++, token, bars: slots[i]?.bars ?? 1 })));
    setSelectedIdx(0);
  };

  const appendToken = (token: string) => {
    const next = [...slots, makeSlot(token)];
    syncSlots(next);
    setSelectedIdx(next.length - 1);
  };

  const removeSlot = (id: number) => {
    if (slots.length <= 1) return;
    syncSlots(slots.filter((s) => s.id !== id));
  };

  const replaceToken = (index: number, token: string) => {
    syncSlots(slots.map((s, i) => (i === index ? { ...s, token } : s)));
  };

  const setBars = (id: number, bars: number) => {
    setSlots(slots.map((s) => (s.id === id ? { ...s, bars } : s)));
  };

  const loadPreset = (preset: Preset) => {
    setMode(preset.mode);
    setBpm(preset.bpm);
    syncSlots(preset.tokens.map((t) => makeSlot(t.t, t.bars ?? 1)));
    setSelectedIdx(0);
  };

  const onDice = () => {
    const roll = rollDice(mood, mulberry32(mixSeeds(0xd1ce, rollCount)), diceLen === 8);
    setRollCount((n) => n + 1);
    setMode(roll.mode);
    syncSlots(roll.tokens.map((t) => makeSlot(t)));
    setSelectedIdx(0);
  };

  const onAutoFinish = () => {
    const added = autoFinish(slots.map((s) => s.token), key, mulberry32(mixSeeds(0xf1215, finishCount)));
    setFinishCount((n) => n + 1);
    if (added.length) syncSlots([...slots, ...added.map((t) => makeSlot(t))]);
  };

  const rerollMelody = () => setMelodyParams((p) => ({ ...p, seed: p.seed + 1, barSeeds: [] }));
  const rerollBar = (barIdx: number) => setMelodyParams((p) => {
    const barSeeds = [...p.barSeeds];
    barSeeds[barIdx] = (barSeeds[barIdx] ?? barIdx) + 97;
    return { ...p, barSeeds };
  });

  const auditionSlot = (index: number) => {
    void player.audition(voicings[index].midis.map((m) => m + 12 * octaveShift), midiSend);
  };

  const copyChart = () => copyText(chart, () => {
    setCopied('chart');
    window.setTimeout(() => setCopied(null), 1400);
  });

  const exportMidi = () => {
    const bytes = buildMidiFile({
      name: `OP-1 Field Playground — ${keyLabel(key)}`,
      bpm: Math.max(40, Math.min(220, bpm)),
      swing,
      arp,
      slots: parsedSlots.map((s, i) => ({ bars: s.bars, midis: voicings[i].midis.map((m) => m + 12 * octaveShift) })),
      melody: melody.map((n) => ({ start: n.start, dur: n.dur, midi: n.midi + 12 * octaveShift })),
      includeChords: true,
      includeMelody: melodyOn,
    });
    downloadBlob(bytes, midiFilename(keyLabel(key)));
    setCopied('midi');
    window.setTimeout(() => setCopied(null), 1400);
  };

  const toggleHardware = async () => {
    if (midiOutId) {
      webMidiOut.allNotesOff(midiOutId);
      setMidiOutId('');
      return;
    }
    const outputs = await webMidiOut.listOutputs();
    setMidiOutputs(outputs);
    if (outputs.length) setMidiOutId(outputs[0].id);
  };

  const shownPresets = vibe ? PRESETS.filter((p) => p.vibe.includes(vibe)) : PRESETS;
  const allVibes = [...new Set(PRESETS.flatMap((p) => p.vibe))].sort();
  const totalBars = slots.reduce((sum, s) => sum + s.bars, 0);

  if (view === 'home') {
    return <HomeView onNav={setView}
      onOpenSong={(songId, target) => { setSongFocus(songId); setView(target); }} />;
  }
  if (view === 'songs') {
    return <SongView initialSongId={songFocus} onNav={setView} />;
  }
  if (view === 'drills') {
    return <DrillsView initialSongId={songFocus} onNav={setView} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">F4</div>
          <div>
            <div className="brand-name">OP-1 FIELD STUDIO</div>
            <div className="brand-sub">{keyLabel(key)} · keys {rangeLabel(octaveShift)} · {totalBars} bars</div>
          </div>
        </div>

        <div className="transport">
          <label className="knob">
            <input type="number" min={40} max={220} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value) || 92)} />
            <span>BPM</span>
          </label>
          <label className="knob">
            <input type="number" min={0} max={40} step={2} value={Math.round(swing * 100)}
              onChange={(e) => setSwing(Math.max(0, Math.min(0.4, Number(e.target.value) / 100)))} />
            <span>SWING%</span>
          </label>
          <div className="octave">
            <button className="icon-btn" title="octave down" disabled={octaveShift <= -2}
              onClick={() => setOctaveShift(octaveShift - 1)}>−</button>
            <span>{octaveShift === 0 ? 'OCT 0' : octaveShift > 0 ? `OCT +${octaveShift}` : `OCT ${octaveShift}`}</span>
            <button className="icon-btn" title="octave up" disabled={octaveShift >= 2}
              onClick={() => setOctaveShift(octaveShift + 1)}>+</button>
          </div>
          <select className="arp-select" value={arp} title="arpeggiator"
            onChange={(e) => setArp(e.target.value as ArpStyle)}>
            <option value="off">block chords</option>
            <option value="up">arp up</option>
            <option value="down">arp down</option>
            <option value="updown">arp up-down</option>
          </select>
          <button className={`primary-btn${playing ? ' stop' : ''}`}
            onClick={playing ? stopPlayback : () => void startPlayback()}>
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <NavTabs active="playground" onNav={(v) => { stopPlayback(); setView(v); }} />
          <button className="tool-btn" onClick={copyChart}>{copied === 'chart' ? 'Copied' : 'Copy tab'}</button>
          <button className="tool-btn" onClick={exportMidi}>{copied === 'midi' ? 'Saved' : 'MIDI'}</button>
          {webMidiOut.supported && (
            <button className={`tool-btn${midiOutId ? ' hw-on' : ''}`} title="send to hardware over USB MIDI"
              onClick={() => void toggleHardware()}>
              {midiOutId ? 'HW ✓' : 'HW out'}
            </button>
          )}
          {midiOutId && midiOutputs.length > 1 && (
            <select className="arp-select" value={midiOutId} onChange={(e) => setMidiOutId(e.target.value)}>
              {midiOutputs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
      </header>

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

      <section className="preset-zone">
        <div className="preset-filters">
          <span className="mini-label">presets</span>
          <button className={vibe === null ? 'chip chip-on' : 'chip'} onClick={() => setVibe(null)}>all</button>
          {allVibes.map((v) => (
            <button key={v} className={vibe === v ? 'chip chip-on' : 'chip'} onClick={() => setVibe(v)}>{v}</button>
          ))}
        </div>
        <div className="preset-rail">
          {shownPresets.map((preset) => (
            <button key={preset.id} className="preset-card" onClick={() => loadPreset(preset)}>
              <strong>{preset.name}</strong>
              <span className="preset-tokens">{preset.tokens.map((t) => prettyNumeral(t.t)).join(' · ')}</span>
              <small>{preset.blurb}</small>
              <em>{MODE_NAMES[preset.mode]} · {preset.bpm} BPM</em>
            </button>
          ))}
        </div>
      </section>

      <main className="lab-grid">
        <section className="builder-zone">
          <div className="section-head">
            <div>
              <h1>Progression</h1>
              <div className="meta-line">{parsed.map((p) => p.chord.symbol).join(' · ')}</div>
            </div>
          </div>
          <textarea
            className="progression-input"
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={applyDraft}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDraft(); } }}
            placeholder="Imaj7 vi7 ii7 V7 — numerals or chord names (Am7, B♭maj7)"
          />
          {warnings.length > 0 && (
            <div className="parse-warnings">{warnings.map((w, i) => <span key={i}>{w.warning}</span>)}</div>
          )}

          <div className="gen-row">
            <select value={mood} title="dice mood" onChange={(e) => setMood(e.target.value as Mood)}>
              {MOODS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.blurb}</option>)}
            </select>
            <select value={diceLen} title="dice length" onChange={(e) => setDiceLen(Number(e.target.value) as 4 | 8)}>
              <option value={4}>4 chords</option>
              <option value={8}>8 chords</option>
            </select>
            <button className="tool-btn" onClick={onDice} title="roll a fresh progression">🎲 Dice</button>
            <button className="tool-btn" onClick={onAutoFinish} title="continue this progression to a cadence">✨ Auto-finish</button>
          </div>

          <div className="slot-grid">
            {parsed.map((p, index) => {
              const active = index === selIdx;
              return (
                <article
                  key={slots[index].id}
                  className={`slot-card func-${p.chord.func}${active ? ' slot-active' : ''}${playingSlot === index ? ' slot-playing' : ''}`}
                  onClick={() => setSelectedIdx(index)}
                >
                  <div className="slot-top">
                    <span className={`numeral numeral-${p.chord.func}`}>
                      {p.chord.numeral ? prettyNumeral(p.chord.numeral) : '—'}
                    </span>
                    <span>{FUNC_LABEL[p.chord.func]}</span>
                    <button title="remove" onClick={(e) => { e.stopPropagation(); removeSlot(slots[index].id); }}>×</button>
                  </div>
                  <div className="slot-symbol">{p.chord.symbol}</div>
                  <div className="slot-tones">{p.chord.notes.map(prettyNote).join(' · ')}</div>
                  <Op1Keyboard lit={litForChord(p.chord, voicings[index])} compact />
                  <div className="slot-actions">
                    <button title="play chord" onClick={(e) => { e.stopPropagation(); auditionSlot(index); }}>▶</button>
                    <select value={slots[index].bars} title="bars"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setBars(slots[index].id, Number(e.target.value))}>
                      <option value={0.5}>½ bar</option>
                      <option value={1}>1 bar</option>
                      <option value={2}>2 bars</option>
                      <option value={4}>4 bars</option>
                    </select>
                    <span className="motion-tag">{motionLabel(voicings[index - 1], voicings[index])}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="study-zone">
          <div className="study-main">
            <div className="section-head">
              <div>
                <h1>{selected?.chord.symbol}</h1>
                <div className="meta-line">
                  {selected && `${selected.chord.numeral ? prettyNumeral(selected.chord.numeral) + ' · ' : ''}${FUNC_LABEL[selected.chord.func]} · ${selected.chord.typeName}`}
                </div>
              </div>
              <button className="tool-btn" onClick={() => auditionSlot(selIdx)}>Audition</button>
            </div>

            <div className="hero-keyboard">
              <Op1Keyboard lit={selectedLit} flashIndex={playingMidi !== null ? midiToKeyIndex(playingMidi) : null} />
            </div>

            <div className="theory-grid">
              <div>
                <span className="mini-label">tones</span>
                <strong>{selected?.chord.notes.map(prettyNote).join(' · ')}</strong>
              </div>
              <div>
                <span className="mini-label">formula</span>
                <strong>{selected && formulaFromIntervals(selected.chord.intervals)}</strong>
              </div>
              <div>
                <span className="mini-label">op-1 keys</span>
                <strong>{selectedVoicing?.midis.map((m) => keyTag(midiToKeyIndex(m))).join(' · ')}</strong>
              </div>
              <div>
                <span className="mini-label">sounding</span>
                <strong>{selectedVoicing?.midis.map((m) => midiName(m + 12 * octaveShift, key)).join(' · ')}</strong>
              </div>
            </div>

            <div className="analysis-copy">
              <p>{selected && FUNC_COPY[selected.chord.func]}</p>
              <p>
                {selectedVoicing?.omitted.length
                  ? `One-hand voicing (${selectedVoicing.label}) — drops the ${selectedVoicing.omitted.map((o) => o.replace(/[A-Za-z]+$/, '') + 'th').join('/')} to fit the window.`
                  : `One-hand voicing (${selectedVoicing?.label}) — every chord tone fits the two-octave window.`}
                {smooth ? ' Smooth mode picks inversions that keep your hand still between chords.' : ''}
              </p>
            </div>

            <label className="smooth-toggle">
              <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
              smooth voice-leading (auto-pick inversions)
            </label>
          </div>

          <aside className="scale-panel">
            <div className="section-head compact-head">
              <div>
                <h2>{keyLabel(key)}</h2>
                <div className="meta-line">{scaleNotes(key).map(prettyNote).join(' ')}</div>
              </div>
            </div>
            <Op1Keyboard lit={scaleLit} compact />
            <div className="spice-list">
              <span className="mini-label">spice the selected chord</span>
              {spices.map((s) => (
                <button key={s.token} className="spice-btn" onClick={() => replaceToken(selIdx, s.token)}>
                  <strong>{s.label}</strong>
                  <em>{s.symbol}</em>
                  <small>{s.why}</small>
                </button>
              ))}
            </div>
          </aside>
        </section>

        <section className="assist-zone">
          <div className="section-head">
            <div>
              <h1>Next Chord</h1>
              <div className="meta-line">autocomplete after {parsed[parsed.length - 1]?.chord.symbol} — click to append</div>
            </div>
          </div>
          <div className="candidate-list">
            {candidates.map((c) => (
              <button key={c.token} className={`candidate lane-${c.lane}`} onClick={() => appendToken(c.token)}>
                <span>
                  <strong>{c.label}</strong>
                  <em>{c.symbol}</em>
                </span>
                <small>{c.why}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="melody-zone">
          <div className="section-head">
            <div>
              <h1>Melody Lab</h1>
              <div className="meta-line">
                {melody.length} notes · seed {melodyParams.seed} · chord tones on the strong beats, steps between
              </div>
            </div>
            <div className="melody-controls">
              <label className="smooth-toggle">
                <input type="checkbox" checked={melodyOn} onChange={(e) => setMelodyOn(e.target.checked)} />
                include melody
              </label>
              <button className="tool-btn" onClick={rerollMelody}>⟳ Reroll all</button>
            </div>
          </div>

          <div className="melody-params">
            <div className="param-group">
              <span className="mini-label">density</span>
              {(['sparse', 'flowing', 'busy'] as Density[]).map((d) => (
                <button key={d} className={melodyParams.density === d ? 'chip chip-on' : 'chip'}
                  onClick={() => setMelodyParams((p) => ({ ...p, density: d }))}>{d}</button>
              ))}
            </div>
            <div className="param-group">
              <span className="mini-label">contour</span>
              {(['arch', 'rise', 'fall', 'wave', 'valley'] as Contour[]).map((c) => (
                <button key={c} className={melodyParams.contour === c ? 'chip chip-on' : 'chip'}
                  onClick={() => setMelodyParams((p) => ({ ...p, contour: c }))}>{c}</button>
              ))}
            </div>
            <div className="param-group">
              <span className="mini-label">register</span>
              {(['high', 'mid', 'wide'] as Register[]).map((r) => (
                <button key={r} className={melodyParams.register === r ? 'chip chip-on' : 'chip'}
                  onClick={() => setMelodyParams((p) => ({ ...p, register: r }))}>{r}</button>
              ))}
            </div>
            <div className="param-group">
              <span className="mini-label">syncopation</span>
              <input type="range" min={0} max={100} value={Math.round(melodyParams.syncopation * 100)}
                onChange={(e) => setMelodyParams((p) => ({ ...p, syncopation: Number(e.target.value) / 100 }))} />
            </div>
          </div>

          <MelodyStrip
            segments={segments}
            melody={melody}
            labels={segmentLabels}
            playingMidi={playingMidi}
            noteNames={(m) => midiName(m + 12 * octaveShift, key)}
            onRerollBar={rerollBar}
            onAudition={(m) => void player.auditionNote(m + 12 * octaveShift)}
          />
        </section>

        <section className="tab-zone">
          <div className="section-head">
            <div>
              <h1>Generated Tab</h1>
              <div className="meta-line">{parsed.length} chords · {totalBars} bars · B = bottom row, T = raised row</div>
            </div>
            <button className="tool-btn" onClick={copyChart}>{copied === 'chart' ? 'Copied' : 'Copy'}</button>
          </div>
          <pre className="tab-output">{chart}</pre>
        </section>
      </main>
    </div>
  );
}
