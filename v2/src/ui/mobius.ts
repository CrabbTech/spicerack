// A Möbius strip, for the crab canon: the picture people draw for Bach's one
// line that is its own accompaniment. A surface with a single side — go round
// once and you are travelling the same notes the other way up. Pure geometry
// here (parametric surface, a tilt, a mild perspective, painter's order); the
// component just paints what comes back, far to near.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StripView {
  /** radius of the strip's centre line */
  R: number;
  /** half-width of the strip */
  w: number;
  /** lean toward the viewer, radians */
  tilt: number;
  /** turn in the strip's own plane, radians */
  spin: number;
  cx: number;
  cy: number;
  /** eye distance for the perspective — larger is flatter */
  eye: number;
}

export const mobiusPoint = (u: number, v: number, R: number, w: number): Vec3 => {
  const r = R + w * v * Math.cos(u / 2);
  return { x: r * Math.cos(u), y: r * Math.sin(u), z: w * v * Math.sin(u / 2) };
};

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const normalize = (a: Vec3): Vec3 => {
  const len = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
};

/** Spin in the strip's own plane, then tilt toward the viewer (who looks down the +z axis). */
export function rotate(p: Vec3, view: Pick<StripView, 'tilt' | 'spin'>): Vec3 {
  const cs = Math.cos(view.spin);
  const ss = Math.sin(view.spin);
  const x = p.x * cs - p.y * ss;
  const y = p.x * ss + p.y * cs;
  const ct = Math.cos(view.tilt);
  const st = Math.sin(view.tilt);
  return { x, y: y * ct - p.z * st, z: y * st + p.z * ct };
}

export interface Projected {
  x: number;
  y: number;
  /** toward the viewer — larger is nearer */
  z: number;
  /** perspective size factor at this depth */
  scale: number;
}

export function project(p: Vec3, view: StripView): Projected {
  const r = rotate(p, view);
  const scale = view.eye / (view.eye - r.z);
  return { x: view.cx + r.x * scale, y: view.cy - r.y * scale, z: r.z, scale };
}

export interface Facet {
  /** SVG polygon points */
  points: string;
  z: number;
  /** does this bit of surface face the viewer? (the strip has one side — but locally there is still a front) */
  front: boolean;
  /** 0..1 — how squarely the light hits it */
  shade: number;
}

const LIGHT = normalize({ x: -0.35, y: 0.55, z: 0.75 });

/** The surface normal (in view space) at a point on the strip. */
export function normalAt(u: number, v: number, view: StripView): Vec3 {
  const p = mobiusPoint(u, v, view.R, view.w);
  const tu = sub(mobiusPoint(u + 1e-3, v, view.R, view.w), p);
  const tv = sub(mobiusPoint(u, v + 1e-3, view.R, view.w), p);
  return normalize(rotate(cross(tu, tv), view)); // the rotation is linear, so it carries normals too
}

/** The strip as quads along its length, painted far to near. */
export function stripFacets(segments: number, view: StripView): Facet[] {
  const out: Facet[] = [];
  for (let i = 0; i < segments; i++) {
    const u0 = (2 * Math.PI * i) / segments;
    const u1 = (2 * Math.PI * (i + 1)) / segments;
    const corners = ([[u0, -1], [u1, -1], [u1, 1], [u0, 1]] as const).map(([u, v]) => project(mobiusPoint(u, v, view.R, view.w), view));
    const n = normalAt((u0 + u1) / 2, 0, view);
    out.push({
      points: corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      z: corners.reduce((s, c) => s + c.z, 0) / 4,
      front: n.z >= 0,
      shade: Math.abs(dot(n, LIGHT)),
    });
  }
  return out.sort((a, b) => a.z - b.z);
}

/** A point on the surface, with which way that bit of surface faces. */
export function stripPoint(u: number, v: number, view: StripView): Projected & { front: boolean } {
  return { ...project(mobiusPoint(u, v, view.R, view.w), view), front: normalAt(u, v, view).z >= 0 };
}
