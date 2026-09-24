// Ear training drawn from the app's own material: take one of the genre's
// loops, spice exactly one chord, play before then after, and ask which chord
// changed. The reveal is the spice's own explanation, so every round teaches
// the move it just tested.

import { Slot } from '../theory/progression';
import { SpiceContext, SpiceId, findAllApplications } from '../theory/spices';
import { ProgressionTemplate } from '../data/genres';

export interface EarRound {
  templateName: string;
  before: Slot[];
  after: Slot[];
  /** index of the one chord that differs */
  changed: number;
  spiceName: string;
  explanation: string;
}

/** Build a round, or undefined when no single-chord spice fits any of the templates. */
export function buildEarRound(
  templates: ProgressionTemplate[], makeSlots: (t: ProgressionTemplate) => Slot[],
  ctx: SpiceContext, spices: SpiceId[], rand: () => number = Math.random,
): EarRound | undefined {
  const pool = templates.filter((t) => t.numerals.length >= 3 && t.numerals.length <= 6);
  const order = [...pool].sort(() => rand() - 0.5);
  for (const tpl of order) {
    const before = makeSlots(tpl);
    const rounds: EarRound[] = [];
    for (const app of findAllApplications(before, ctx, spices)) {
      const after = app.apply().slots;
      if (!after || after.length !== before.length) continue;
      const diff = after.map((s, i) => (s.numeral !== before[i].numeral ? i : -1)).filter((i) => i >= 0);
      if (diff.length !== 1) continue;
      rounds.push({ templateName: tpl.name, before, after, changed: diff[0], spiceName: app.spiceName, explanation: app.explanation });
    }
    if (rounds.length) return rounds[Math.floor(rand() * rounds.length)];
  }
  return undefined;
}
