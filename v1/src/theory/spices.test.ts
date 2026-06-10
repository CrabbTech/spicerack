import { describe, expect, it } from 'vitest';
import { NoteName } from './notes';
import { Key } from './scales';
import { chordSymbol } from './chords';
import { resolveNumeral } from './roman';
import { Slot, newSlot, realize } from './progression';
import { SPICES, SUFFIX_OF, SpiceContext, findAllApplications } from './spices';
import { GENRES, GENRE_LIST } from '../data/genres';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const AMIN: Key = { tonic: N('A'), mode: 'minor' };

const slotsOf = (...numerals: string[]): Slot[] => numerals.map((n) => newSlot(n));
const numerals = (slots: Slot[]): string => slots.map((s) => s.numeral).join(' ');

const rockCtx: SpiceContext = { key: CMAJ, flavor: GENRES['classic-rock'].flavor };
const lofiCtx: SpiceContext = { key: CMAJ, flavor: GENRES.lofi.flavor };
const minorCtx: SpiceContext = { key: AMIN, flavor: GENRES['eighties-rock'].flavor };

describe('spices', () => {
  it('secondary dominant inserts V7 of a diatonic target', () => {
    const slots = slotsOf('I', 'vi', 'IV', 'V');
    const apps = SPICES['secondary-dominant'].find(slots, rockCtx);
    const toVi = apps.find((a) => a.label.startsWith('E7'));
    expect(toVi).toBeDefined();
    const patch = toVi!.apply();
    expect(numerals(patch.slots!)).toBe('I V7/vi vi IV V');
    expect(toVi!.explanation).toContain('G♯');
  });

  it('secondary dominant respects genre dominant flavor', () => {
    const slots = slotsOf('Imaj7', 'vi7');
    const apps = SPICES['secondary-dominant'].find(slots, lofiCtx);
    expect(apps[0].apply().slots![1].numeral).toBe('V7b9/vi');
  });

  it('borrowed iv inserts between IV and I, else replaces IV', () => {
    const melt = SPICES['borrowed-iv'].find(slotsOf('I', 'IV', 'I'), rockCtx)[0];
    expect(numerals(melt.apply().slots!)).toBe('I IV iv I');
    const swap = SPICES['borrowed-iv'].find(slotsOf('I', 'vi', 'IV', 'V'), rockCtx)[0];
    expect(numerals(swap.apply().slots!)).toBe('I vi iv V');
  });

  it('tritone sub replaces a resolving dominant', () => {
    const slots = slotsOf('ii7', 'V7', 'Imaj7');
    const apps = SPICES['tritone-sub'].find(slots, lofiCtx);
    expect(apps).toHaveLength(1);
    const out = apps[0].apply().slots!;
    expect(numerals(out)).toBe('ii7 bII7 Imaj7');
    expect(chordSymbol(realize(out, CMAJ)[1].chord)).toBe('D♭7');
  });

  it('extensions climb the genre ladder', () => {
    const slots = slotsOf('ii7', 'V7', 'Imaj7', 'vi7');
    const app = SPICES.extensions.find(slots, lofiCtx)[0];
    expect(numerals(app.apply().slots!)).toBe('ii9 V9 Imaj9 vi9');
  });

  it('passing dim bridges whole-step gaps', () => {
    const slots = slotsOf('I', 'vi', 'IV', 'V');
    const apps = SPICES['passing-dim'].find(slots, rockCtx);
    expect(apps).toHaveLength(1);
    expect(numerals(apps[0].apply().slots!)).toBe('I vi IV #ivo7 V');
    expect(chordSymbol(resolveNumeral('#ivo7', CMAJ))).toBe('F♯dim7');
  });

  it('picardy flips the final i', () => {
    const slots = slotsOf('i', 'bVI', 'bVII', 'i');
    const apps = SPICES.picardy.find(slots, minorCtx);
    expect(numerals(apps[0].apply().slots!)).toBe('i bVI bVII I');
  });

  it('line cliché expands a minor tonic', () => {
    const slots = slotsOf('i', 'bVI');
    const apps = SPICES['line-cliche'].find(slots, minorCtx);
    expect(numerals(apps[0].apply().slots!)).toBe('i imaj7 i7 i6 bVI');
  });

  it('truck driver modulates instead of editing slots', () => {
    const app = SPICES['truck-driver'].find(slotsOf('I', 'V', 'vi', 'IV'), rockCtx)[0];
    expect(app.apply().modulate).toBe(2);
    expect(app.label).toContain('D');
  });

  it('harmonic minor V upgrades v', () => {
    const apps = SPICES['harmonic-minor-v'].find(slotsOf('i', 'v', 'i'), minorCtx);
    expect(numerals(apps[0].apply().slots!)).toBe('i V i');
  });

  it('phrygian bite and tritone riff only fire in minor-ish modes', () => {
    expect(SPICES['phrygian-bite'].find(slotsOf('I', 'IV'), rockCtx)).toHaveLength(0);
    const bite = SPICES['phrygian-bite'].find(slotsOf('i', 'iv'), minorCtx);
    expect(numerals(bite[0].apply().slots!)).toBe('i bII iv');
  });

  it('pedal point marks non-tonic slots', () => {
    const apps = SPICES['pedal-point'].find(slotsOf('I', 'bVII', 'IV'), rockCtx);
    const out = apps[0].apply().slots!;
    expect(out.map((s) => !!s.pedalBass)).toEqual([false, true, true]);
    const realized = realize(out, CMAJ);
    expect(chordSymbol(realized[1].chord)).toBe('B♭/C');
  });

  it('half-step slide approaches seventh chords from above', () => {
    const apps = SPICES['half-step-slide'].find(slotsOf('Imaj7', 'vi7'), lofiCtx);
    const toVi = apps.find((a) => a.targetSlotId !== undefined && a.label.includes('B♭m7'));
    expect(toVi).toBeDefined();
    expect(numerals(toVi!.apply().slots!)).toBe('Imaj7 bvii7 vi7');
  });
});

describe('genre data integrity', () => {
  it('every template numeral resolves in its mode', () => {
    for (const g of GENRE_LIST) {
      for (const t of g.templates) {
        const key: Key = { tonic: N('C'), mode: t.mode };
        for (const numeral of t.numerals) {
          expect(() => resolveNumeral(numeral, key), `${g.id}/${t.name}/${numeral}`).not.toThrow();
        }
        if (t.bars) expect(t.bars, `${g.id}/${t.name} bars`).toHaveLength(t.numerals.length);
        expect(g.modes, `${g.id} modes include ${t.mode}`).toContain(t.mode);
      }
    }
  });

  it('every genre mode has at least one template', () => {
    for (const g of GENRE_LIST) {
      for (const mode of g.modes) {
        expect(g.templates.some((t) => t.mode === mode), `${g.id} ${mode}`).toBe(true);
      }
    }
  });

  it('every scale rec root resolves and applies to a real mode', () => {
    for (const g of GENRE_LIST) {
      for (const rec of g.scaleRecs) {
        expect(() => resolveNumeral(rec.root, { tonic: N('C'), mode: g.modes[0] }), `${g.id} rec ${rec.scale}`).not.toThrow();
        if (rec.modes) for (const m of rec.modes) expect(g.modes, `${g.id} rec mode ${m}`).toContain(m);
      }
    }
  });

  it('every ladder target has a numeral suffix', () => {
    for (const g of GENRE_LIST) {
      for (const target of Object.values(g.flavor.ladder)) {
        expect(SUFFIX_OF[target], `${g.id} ladder -> ${target}`).toBeDefined();
      }
    }
  });

  it('every genre spice list finds something on its own templates', () => {
    for (const g of GENRE_LIST) {
      for (const mode of g.modes) {
        const t = g.templates.find((tpl) => tpl.mode === mode)!;
        const slots = t.numerals.map((n) => newSlot(n));
        const ctx: SpiceContext = { key: { tonic: N('C'), mode }, flavor: g.flavor };
        const apps = findAllApplications(slots, ctx, g.spices);
        expect(apps.length, `${g.id}/${mode} should have ≥1 spice application`).toBeGreaterThan(0);
      }
    }
  });
});
