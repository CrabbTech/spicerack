// Grading a take: someone played along with the loop (guitar through the mic,
// OP-1 over MIDI, or the computer keyboard) and the drill had a rule. Did the
// chord changes land? Did the notes stay inside the drill? The feedback is
// specific on purpose — "Dm: you hit F♯, its target is F" beats a bare score.

import { midiLabel, mod12 } from '../theory/notes';
import { chordSymbol } from '../theory/chords';
import { LensId } from '../theory/solo';
import { MelNote, MelodyContext, noteAtChange, sortNotes } from '../theory/melody';

export interface SegmentGrade {
  chord: string;
  /** null = this drill doesn't grade landings, or nothing was played at the change */
  landed: boolean | null;
  /** what was sounding as the chord arrived */
  playedLabel?: string;
  targetLabels: string[];
  notes: number;
  inside: number;
}

export interface TakeGrade {
  segments: SegmentGrade[];
  landings: { hit: number; total: number };
  /** share of notes that obeyed the drill, 0..1 */
  inside: number;
  score: number;
  lines: string[];
}

/** Drills where "be on the target when the chord changes" is the point. */
const LANDING_DRILLS: LensId[] = ['map', 'roots', 'thirds', 'arps', 'guide'];

export function gradeTake(notes: MelNote[], ctx: MelodyContext, lens: LensId): TakeGrade {
  const sorted = sortNotes(notes);
  const gradesLandings = LANDING_DRILLS.includes(lens);
  const name = (midi: number) => midiLabel(midi, ctx.preferFlat ? 'flat' : 'sharp').replace(/-?\d+$/, '');

  const segments: SegmentGrade[] = ctx.segments.map((seg) => {
    const mine = sorted.filter((n) => n.beat >= seg.start - 1e-6 && n.beat < seg.start + seg.beats - 1e-6);
    const at = noteAtChange(sorted, seg.start, ctx.totalBeats);
    // the full map grades "any chord tone"; the drills grade their own targets
    const good = (pc: number) => (lens === 'map' ? seg.map.byPc.get(pc)?.chordDegree !== undefined : seg.targets.has(pc));
    const targetLabels = seg.map.notes.filter((x) => (lens === 'map' ? x.chordDegree !== undefined : seg.targets.has(x.pc))).map((x) => x.label);
    return {
      chord: chordSymbol(seg.map.chord),
      landed: gradesLandings && at ? good(mod12(at.midi)) : null,
      playedLabel: at ? name(at.midi) : undefined,
      targetLabels,
      notes: mine.length,
      inside: mine.filter((n) => seg.lit.has(mod12(n.midi))).length,
    };
  });

  const total = sorted.length;
  const insideCount = segments.reduce((a, s) => a + s.inside, 0);
  const inside = total ? insideCount / total : 0;
  const graded = segments.filter((s) => s.landed !== null);
  const hit = graded.filter((s) => s.landed).length;
  // a change with nothing played is a miss too — silence doesn't outline harmony
  const landingTotal = gradesLandings ? segments.length : 0;
  const score = !total ? 0
    : Math.round(100 * (landingTotal ? 0.6 * (hit / landingTotal) + 0.4 * inside : inside));

  const lines: string[] = [];
  if (!total) lines.push('Nothing heard on that pass — play along and the next one gets graded.');
  else {
    if (landingTotal) {
      lines.push(hit === landingTotal
        ? `Landed all ${landingTotal} chord changes. That's the whole game — do it again so it wasn't luck.`
        : `Landed ${hit} of ${landingTotal} chord changes.`);
      for (const s of segments.filter((x) => x.landed === false).slice(0, 2)) {
        lines.push(`${s.chord}: you arrived on ${s.playedLabel} — aim for ${s.targetLabels.slice(0, 3).join(' / ')}.`);
      }
      const silent = segments.filter((x) => x.landed === null);
      if (silent.length && silent.length < segments.length) lines.push(`Nothing sounding when ${silent[0].chord} arrived — be there on beat 1, even with one note.`);
    }
    const strays = total - insideCount;
    if (strays === 0) lines.push(`Every note stayed inside the drill (${total} notes).`);
    else lines.push(`${Math.round(inside * 100)}% of your notes were inside the drill — ${strays} strayed.`);
  }
  return { segments, landings: { hit, total: landingTotal }, inside, score, lines };
}
