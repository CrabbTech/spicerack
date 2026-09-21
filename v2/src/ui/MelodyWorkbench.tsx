// The melody workbench: the roll, the motif tools that develop one bar into a
// tune, the coach that reads the result against the chords, and — for the bar
// you're on — other chords that would fit under the same notes.

import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { chordSymbol } from '../theory/chords';
import { notePc } from '../theory/notes';
import { simpleInterval } from '../theory/solo';
import { keyLabel } from '../theory/progression';
import { prettyNumeral } from '../theory/roman';
import {
  answerBar, barCount, changeEnding, fixClashes, fromLick, invertBar, notesInBar, rerollPitches, roleAt,
  segmentAt, sequenceBar, shiftOctave, stretchBar, transposeToChord,
} from '../theory/melody';
import { OPEN_MIDI, STRING_NAMES } from '../guitar/shapes';
import { MAX_FRET } from '../guitar/voicing';
import { BASS_MAX_FRET, BASS_OPEN_MIDI, BASS_STRING_NAMES } from '../bass/bass';
import { melodyKeysText, melodyTabText } from '../guitar/melodyTab';
import { OP1_BASE_MIDI, OP1_KEY_COUNT } from '../op1/op1';
import { PIANO_BASE_MIDI, PIANO_KEY_COUNT } from '../piano/piano';
import { audio } from '../audio/engine';
import { Lick, STARTER_LICKS, lickFromBar, lickNumbers, loadLicks, parseTab, placeLick, saveLicks, tabToNotes } from '../guitar/licks';
import { MelodyRoll } from './MelodyRoll';

const FLAVOR_LABEL = { simple: 'simple', sus: 'suspended', rich: 'richer', borrowed: 'borrowed' } as const;
const NOTE_ICON = { good: '✅', fix: '🛠', idea: '💡' } as const;

export function MelodyWorkbench() {
  const app = useApp();
  const {
    state, melodyCtx: ctx, melodyReport: report, setMelody, grid, setGrid, recording, startRecording, stopPlayback,
    writeSolo, order, songAt, ab, inputSource, key, preferFlat, copied,
  } = app;
  const [bar, setBar] = useState<number | null>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [rolls, setRolls] = useState(1);
  // lick lab: tab in, numbers out, a library that stores licks as numbers
  const [asPlayed, setAsPlayed] = useState(true);
  const [pasting, setPasting] = useState(false);
  const [tabText, setTabText] = useState('');
  const [lickShelf, setLickShelf] = useState(false);
  const [licks, setLicks] = useState<Lick[]>(loadLicks);
  const [lickName, setLickName] = useState('');
  const [note, setNote] = useState('');
  const { stepEntry, setStepEntry, stepBeat, setStepBeat } = app;
  const notes = state.melody;
  const selected = notes.find((n) => n.id === noteId);

  // Delete / lock from the keyboard — unless the keyboard is busy being a piano
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (stepEntry && ctx) {
        // the step cursor: arrows move it, Backspace takes back the last note
        const wrap = (b: number) => (b + ctx.totalBeats) % ctx.totalBeats;
        if (e.key === 'ArrowRight') { e.preventDefault(); setStepBeat(wrap(stepBeat + grid)); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); setStepBeat(wrap(stepBeat - grid)); return; }
        if (e.key === 'Backspace') {
          e.preventDefault();
          const back = wrap(stepBeat - grid);
          setMelody(notes.filter((n) => n.locked || Math.abs(n.beat - back) > 1e-6));
          setStepBeat(back);
          return;
        }
      }
      if (!selected) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !selected.locked) {
        e.preventDefault();
        setMelody(notes.filter((n) => n.id !== selected.id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!ctx || !writeSolo) return null;
  const bars = barCount(ctx);
  const next = bar === null ? null : (bar + 1) % bars;
  const hasMotif = bar !== null && notesInBar(notes, ctx, bar).length > 0;
  const slotIdx = bar === null ? null : app.slotAtBeat(bar * ctx.beatsPerBar);
  const harmony = slotIdx !== null && hasMotif ? app.harmonyFor(slotIdx).slice(0, 6) : [];
  const slotChord = slotIdx !== null ? app.realized[slotIdx]?.chord : undefined;

  const seed = () => {
    setMelody(fromLick(writeSolo.lick));
    setRolls(rolls + 1);
  };
  const tool = (fn: () => typeof notes) => () => {
    setMelody(fn());
    setRolls(rolls + 1);
  };

  // tab is this player's native script — so the melody is always shown in it, with each note's number underneath
  const onStrings = state.instrument === 'guitar' || state.instrument === 'bass';
  const degreeOf = (n: (typeof notes)[number]) => {
    const role = roleAt(ctx, n.beat, n.midi);
    if (role) return role.interval === '1' ? 'R' : role.interval;
    // outside the chord and the scale it still has a number — that's the whole point of the line
    const root = segmentAt(ctx, n.beat)?.map.chord.root;
    return root ? simpleInterval(n.midi - notePc(root)) : '?';
  };
  const tabOf = (title: string) => {
    const low = state.instrument === 'bass';
    return melodyTabText(title, notes, ctx.totalBeats, ctx.beatsPerBar,
      low ? BASS_OPEN_MIDI : OPEN_MIDI, low ? BASS_STRING_NAMES : STRING_NAMES,
      writeSolo.window ?? { lo: 0, hi: 4 }, low ? BASS_MAX_FRET : MAX_FRET, grid, degreeOf, asPlayed);
  };

  const copyOut = () => {
    const title = `${state.templateName} — melody · ${keyLabel(key)}`;
    const inst = state.instrument;
    if (inst === 'guitar' || inst === 'bass') app.copyText('melody', tabOf(title));
    else {
      const piano = inst === 'piano';
      app.copyText('melody', melodyKeysText(title, notes, ctx.totalBeats, ctx.beatsPerBar,
        (piano ? PIANO_BASE_MIDI : OP1_BASE_MIDI) + 12 * state.octaveShift, piano ? PIANO_KEY_COUNT : OP1_KEY_COUNT, preferFlat ? 'flat' : 'sharp'));
    }
  };

  return (
    <section className="panel melody-panel">
      <div className="panel-head">
        <div>
          <h2>Melody workbench</h2>
          <div className="panel-sub">
            rows are tinted by the chord underneath: bright = chord tone, purple = spice, dashed = rubs. Click to add, drag to move or stretch, double-click to delete.
          </div>
        </div>
        <div className="panel-actions">
          <button className={`btn ${recording ? 'btn-rec' : ''}`} onClick={recording ? stopPlayback : startRecording}
            title={`count-in, then one pass is captured from ${inputSource === 'off' ? 'the computer keyboard (pick mic or MIDI in Jam → Listen)' : inputSource} and snapped to the grid`}>
            {recording ? '■ Recording…' : '⏺ Record a pass'}
          </button>
          <div className="seg" title="grid: eighths or sixteenths">
            <button className={grid === 0.5 ? 'seg-on' : ''} onClick={() => setGrid(0.5)}>♪ 8ths</button>
            <button className={grid === 0.25 ? 'seg-on' : ''} onClick={() => setGrid(0.25)}>♬ 16ths</button>
          </div>
          <button className="btn" onClick={seed} title="fill the roll with a generated lick — then delete down to the bar you like">🌱 Seed from lick</button>
          <button className="btn" onClick={copyOut} disabled={!notes.length}>
            {copied === 'melody' ? '✓ Copied' : state.instrument === 'guitar' || state.instrument === 'bass' ? '📋 Copy as tab' : '📋 Copy key chart'}
          </button>
          <button className="btn" onClick={() => setMelody(notes.filter((n) => n.locked))} disabled={!notes.length}>🧹 Clear</button>
        </div>
      </div>

      <MelodyRoll ctx={ctx} notes={notes} grid={grid} selectedBar={bar} selectedId={noteId}
        followTransport={state.playing && !order && songAt === null && !ab}
        stepBeat={stepEntry ? stepBeat : null}
        onChange={(n) => setMelody(n)} onSelectNote={setNoteId}
        onSelectBar={(b) => { setBar(b); if (b !== null) setStepBeat(b * ctx.beatsPerBar); }}
        onAudition={(midi) => audio.note(midi, state.instrument, 0.5)} />

      {onStrings && notes.length > 0 && (
        <div className="tab-strip" title="fingered inside the neck position chosen in the panel below; the bottom line is each note's number against the chord under it">
          <pre>{tabOf('').split('\n').slice(1).join('\n')}</pre>
        </div>
      )}

      <div className="motif-row">
        <span className="control-label">LICK</span>
        <button className={`chip ${stepEntry ? 'chip-on' : ''}`} onClick={() => setStepEntry(!stepEntry)}
          title="click notes on the instrument diagram below and they land at the dashed cursor, one grid step each · ←/→ move the cursor · Backspace takes one back">
          ✏️ Step entry{stepEntry ? ' — click the diagram below' : ''}
        </button>
        {stepEntry && <button className="chip" onClick={() => setStepBeat((stepBeat + grid) % ctx.totalBeats)} title="leave this step empty">rest ➡</button>}
        {onStrings && <button className={`chip ${pasting ? 'chip-on' : ''}`} onClick={() => setPasting(!pasting)} title="paste ASCII tab of a lick you already play">📋 Paste tab</button>}
        {onStrings && notes.some((n) => n.string !== undefined) && (
          <div className="seg" title="the tab below: fingered where you entered it, or re-fingered inside the neck position chosen in the panel underneath — the same lick, somewhere else on the neck">
            <button className={asPlayed ? 'seg-on' : ''} onClick={() => setAsPlayed(true)}>🖐 as played</button>
            <button className={!asPlayed ? 'seg-on' : ''} onClick={() => setAsPlayed(false)}>📦 in position</button>
          </div>
        )}
        <button className={`chip ${lickShelf ? 'chip-on' : ''}`} onClick={() => setLickShelf(!lickShelf)} title="licks stored as numbers against a chord — drop one onto any bar, in any key">📚 Lick shelf</button>
        {note && <span className="practice-hint">{note}</span>}
      </div>

      {pasting && (
        <div className="paste-box">
          <textarea rows={7} spellCheck={false} value={tabText} onChange={(e) => setTabText(e.target.value)}
            placeholder={'e|-----------5-8-5--------|\nB|---------5-------8-5----|\nG|-----5h7-------------7--|\nD|---7--------------------|\nA|------------------------|\nE|------------------------|'} />
          <div className="paste-side">
            <p>Tab carries the notes and their order, not the rhythm — each column becomes one {grid === 0.5 ? 'eighth' : 'sixteenth'}, starting at {bar === null ? 'the top' : `bar ${bar + 1}`}. Fix the timing on the roll afterwards; hammer-ons, slides and bends are read as plain notes.</p>
            <button className="btn btn-spice" disabled={!tabText.trim()} onClick={() => {
              const low = state.instrument === 'bass';
              const events = parseTab(tabText, low ? 4 : 6);
              if (!events.length) { setNote(`Couldn't find ${low ? 'four' : 'six'} tab lines in that.`); return; }
              const start = bar === null ? 0 : bar * ctx.beatsPerBar;
              const read = tabToNotes(events, low ? BASS_OPEN_MIDI : OPEN_MIDI, grid, start, ctx.totalBeats);
              const taken = new Set(read.notes.map((n) => n.beat));
              setMelody([...notes.filter((n) => n.locked || !taken.has(n.beat)), ...read.notes]);
              setNote(`Read ${read.notes.length} notes${read.dropped ? ` — ${read.dropped} more ran past the end of the section` : ''}. The line under the tab is each note's number against its chord.`);
              setPasting(false);
              setAsPlayed(true);
            }}>Read it in</button>
          </div>
        </div>
      )}

      {lickShelf && (
        <div className="lick-shelf">
          <div className="lick-save">
            <input className="text-input" placeholder={bar === null ? 'select a bar to save it as a lick' : `name bar ${bar + 1} to save it`} value={lickName}
              disabled={!hasMotif} onChange={(e) => setLickName(e.target.value)} />
            <button className="btn" disabled={!hasMotif || !lickName.trim()} onClick={() => {
              const lick = lickFromBar(notes, ctx, bar!, lickName.trim());
              if (!lick) return;
              lick.from = slotChord ? `written over ${chordSymbol(slotChord)}` : undefined;
              const nextLicks = [lick, ...licks].slice(0, 80);
              setLicks(nextLicks);
              saveLicks(nextLicks);
              setLickName('');
            }}>⭐ Save as numbers</button>
            <span className="practice-hint">a saved lick forgets its key and its frets — it keeps its rhythm and its numbers, so it fits any chord</span>
          </div>
          {[...licks, ...STARTER_LICKS].map((lick) => (
            <div key={lick.id} className="lick-row">
              <div className="lick-info">
                <strong>{lick.name}</strong> <span className="lick-numbers">{lickNumbers(lick)}</span>
                {lick.from && <div className="practice-hint">{lick.from}</div>}
              </div>
              <button className="btn" title={`hear it over ${slotChord ? chordSymbol(slotChord) : 'the first chord'}`} onClick={() => {
                if (state.playing) stopPlayback();
                const placed = placeLick(lick, ctx, bar ?? 0);
                const beat = 60 / app.bpm;
                const from = (bar ?? 0) * ctx.beatsPerBar;
                audio.playSequence(placed.map((n) => ({ at: (n.beat - from) * beat, midis: [n.midi], dur: n.dur * beat, vel: 0.9 })), state.instrument);
              }}>▶</button>
              <button className="btn" onClick={() => {
                const at = bar ?? 0;
                const inBar = new Set(notesInBar(notes, ctx, at).filter((n) => !n.locked).map((n) => n.id));
                setMelody([...notes.filter((n) => !inBar.has(n.id)), ...placeLick(lick, ctx, at)]);
                setBar(at);
                setRolls(rolls + 1);
              }}>⤵ Drop into bar {(bar ?? 0) + 1}</button>
              {!lick.starter && (
                <button className="btn" title="forget this lick" onClick={() => {
                  const nextLicks = licks.filter((l) => l.id !== lick.id);
                  setLicks(nextLicks);
                  saveLicks(nextLicks);
                }}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="motif-row">
        <span className="control-label">MOTIF</span>
        {bar === null
          ? <span className="practice-hint">click a bar number to pick your motif — then develop it instead of writing new notes</span>
          : (
            <>
              <span className="motif-bar">bar {bar + 1}</span>
              <button className="chip" disabled={!hasMotif || next === null} title="the same shape, moved along the scale so it lands on the next chord's target"
                onClick={tool(() => sequenceBar(notes, ctx, bar, next!))}>⤴ Sequence → bar {next! + 1}</button>
              <button className="chip" disabled={!hasMotif || next === null}
                title="the lick moved by exactly the distance between the two chord roots, so every note keeps its number — how a lick you know becomes a lick for every chord"
                onClick={tool(() => transposeToChord(notes, ctx, bar, next!))}>🎯 Same numbers → bar {next! + 1}</button>
              <button className="chip" disabled={!hasMotif} title="same rhythm, contour turned over, ending at rest on the root"
                onClick={tool(() => answerBar(notes, ctx, bar, next!))}>💬 Answer → bar {next! + 1}</button>
              <button className="chip" disabled={!hasMotif} title="keep the rhythm, find new pitches"
                onClick={tool(() => rerollPitches(notes, ctx, bar, rolls))}>🎲 New pitches</button>
              <button className="chip" disabled={!hasMotif} title="rewrite where the phrase goes: lean into the next chord, or come to rest (click again for the other)"
                onClick={tool(() => changeEnding(notes, ctx, bar, rolls))}>🔚 Change ending</button>
              <button className="chip" disabled={!hasMotif} title="twice as slow, spilling into the next bar"
                onClick={tool(() => stretchBar(notes, ctx, bar, 2))}>↔ Stretch ×2</button>
              <button className="chip" disabled={!hasMotif} title="twice as fast, played twice"
                onClick={tool(() => stretchBar(notes, ctx, bar, 0.5))}>⇥ Squeeze ×½</button>
              <button className="chip" disabled={!hasMotif} title="mirror the contour around the first note"
                onClick={tool(() => invertBar(notes, ctx, bar))}>🙃 Invert</button>
              <button className="chip" disabled={!hasMotif}
                onClick={tool(() => notes.filter((n) => n.locked || !notesInBar(notes, ctx, bar).includes(n)))}>🧹 Clear bar</button>
            </>
          )}
      </div>
      <div className="motif-row">
        <span className="control-label">ALL</span>
        <button className="chip" disabled={!notes.length} title="strong-beat and held notes that fight their chord move to the nearest chord tone"
          onClick={tool(() => fixClashes(notes, ctx))}>🩹 Fix clashes</button>
        <button className="chip" disabled={!notes.length} onClick={tool(() => shiftOctave(notes, ctx, -1))}>octave ↓</button>
        <button className="chip" disabled={!notes.length} onClick={tool(() => shiftOctave(notes, ctx, 1))}>octave ↑</button>
        {selected && (
          <>
            <span className="control-label band-label">NOTE</span>
            <button className={`chip ${selected.locked ? 'chip-on' : ''}`} title="locked notes survive every motif tool, Clear and Record"
              onClick={() => setMelody(notes.map((n) => (n.id === selected.id ? { ...n, locked: !n.locked } : n)))}>
              {selected.locked ? '🔒 Locked' : '🔓 Lock'}
            </button>
            <button className="chip" disabled={selected.locked} onClick={() => setMelody(notes.filter((n) => n.id !== selected.id))}>🗑 Delete</button>
          </>
        )}
      </div>

      {report && notes.length >= 2 && (
        <div className="coach">
          <div className="coach-head">
            <span className="control-label">COACH</span>
            <div className="coach-landings" title="does each chord arrive on one of its own notes?">
              {report.landings.map((l, i) => (
                <span key={i} className={`landing ${l.midi === undefined ? 'landing-none' : l.hit ? 'landing-hit' : 'landing-miss'}`}>
                  {l.chord} {l.midi === undefined ? '·' : l.hit ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
          {report.observations.map((o, i) => (
            <div key={i} className={`coach-note coach-${o.kind}`} onClick={() => o.bar !== undefined && setBar(o.bar)}>
              {NOTE_ICON[o.kind]} {o.text}
            </div>
          ))}
        </div>
      )}

      {harmony.length > 0 && slotChord && slotIdx !== null && (
        <div className="harmonize">
          <div className="harmonize-head">
            <span className="control-label">REHARMONIZE</span>
            <span className="practice-hint">bar {bar! + 1} sits on {chordSymbol(slotChord)} — these would also carry its melody. The notes stay; the meaning changes.</span>
          </div>
          <div className="harmonize-options">
            {harmony.map((o) => (
              <button key={o.numeral} className={`harm-option numeral-${o.chord.func}`} title={o.why} onClick={() => app.reharmonize(slotIdx, o)}>
                <span className="harm-symbol">{chordSymbol(o.chord)}</span>
                <span className="harm-meta">{prettyNumeral(o.numeral)} · {FLAVOR_LABEL[o.flavor]}</span>
                <span className="harm-fit"><i style={{ width: `${Math.round(o.fit * 100)}%` }} /></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
