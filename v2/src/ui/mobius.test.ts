import { describe, expect, it } from 'vitest';
import { StripView, mobiusPoint, project, stripFacets, stripPoint } from './mobius';

const VIEW: StripView = { R: 100, w: 30, tilt: 1, spin: 0.4, cx: 250, cy: 150, eye: 900 };

describe('the Möbius strip', () => {
  it('closes on itself with a half twist: once around, the edges have swapped', () => {
    for (const v of [-1, -0.3, 0.5, 1]) {
      const a = mobiusPoint(2 * Math.PI, v, 100, 30);
      const b = mobiusPoint(0, -v, 100, 30);
      expect(a.x).toBeCloseTo(b.x);
      expect(a.y).toBeCloseTo(b.y);
      expect(a.z).toBeCloseTo(b.z);
    }
  });

  it('projects the centre to the centre and nearer things larger', () => {
    const o = project({ x: 0, y: 0, z: 0 }, VIEW);
    expect(o.x).toBe(VIEW.cx);
    expect(o.y).toBe(VIEW.cy);
    const near = project({ x: 0, y: 0, z: 100 }, VIEW);
    const far = project({ x: 0, y: 0, z: -100 }, VIEW);
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it('paints far to near and shows both faces of a one-sided surface', () => {
    const facets = stripFacets(64, VIEW);
    expect(facets).toHaveLength(64);
    for (let i = 1; i < facets.length; i++) expect(facets[i].z).toBeGreaterThanOrEqual(facets[i - 1].z);
    expect(facets.some((f) => f.front)).toBe(true);
    expect(facets.some((f) => !f.front)).toBe(true);
    for (const f of facets) {
      expect(f.shade).toBeGreaterThanOrEqual(0);
      expect(f.shade).toBeLessThanOrEqual(1);
    }
  });

  it('faces the other way after one trip round — that is the whole point of the strip', () => {
    const flat = { ...VIEW, tilt: 0, spin: 0 };
    expect(stripPoint(0.01, 0, flat).front).not.toBe(stripPoint(2 * Math.PI - 0.01, 0, flat).front);
    const p = stripPoint(0, -1, flat);
    const q = project(mobiusPoint(0, -1, flat.R, flat.w), flat);
    expect([p.x, p.y, p.z]).toEqual([q.x, q.y, q.z]);
  });
});
