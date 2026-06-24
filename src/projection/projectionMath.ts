// Pure optics for the single-projector tab. No React, no WebGL — just the
// geometry + photometry that the 3D scene, the heatmap texture, and the readout
// all consume, so they can never disagree.
//
// The projector world is the user's domain: lengths in FEET, brightness in
// FOOT-CANDLES (1 lm/ft² = 1 fc). Distances that come from the store arrive in
// INCHES (the store's convention); convert at the boundary with `ftFromIn`.
//
// Core throw relation (the whole reason this tab exists): a lens is spec'd by
// its THROW RATIO = throw distance / image width. So width and distance are two
// ends of one number — pin either, derive the other.

export const IN_PER_FT = 12;
export const LUX_PER_FC = 10.7639;
export const NITS_PER_FL = 3.426; // 1 foot-Lambert = 3.426 cd/m²

/** Foot-candle thresholds (from the user's spreadsheet). */
export const FC_MIN_ACCEPTABLE = 20; // below this: unusable in any real room
export const FC_DESIRABLE = 400; // at/above this: bright, holds up in light

export const ftFromIn = (inches: number): number => inches / IN_PER_FT;
export const inFromFt = (ft: number): number => ft * IN_PER_FT;

// --- the linked pair (unit-agnostic: ratio cancels units) ---

/** Image width from throw distance and throw ratio. */
export function widthFromDistance(distance: number, throwRatio: number): number {
  return throwRatio > 0 ? distance / throwRatio : 0;
}

/** Throw distance needed to hit a target image width at a throw ratio. */
export function distanceFromWidth(width: number, throwRatio: number): number {
  return width * throwRatio;
}

export type FcBand = 'too-dim' | 'marginal' | 'good' | 'bright';

export function bandForFc(fc: number): FcBand {
  if (fc < FC_MIN_ACCEPTABLE) return 'too-dim';
  if (fc < 100) return 'marginal';
  if (fc < FC_DESIRABLE) return 'good';
  return 'bright';
}

export const BAND_TONE: Record<FcBand, 'good' | 'caution' | 'bad'> = {
  'too-dim': 'bad',
  marginal: 'caution',
  good: 'good',
  bright: 'good',
};

export const BAND_LABEL: Record<FcBand, string> = {
  'too-dim': 'Too dim',
  marginal: 'Marginal',
  good: 'Good brightness',
  bright: 'Very bright',
};

export interface ProjectionInputs {
  throwRatio: number;
  /** Perpendicular distance from the wall to the lens, INCHES. */
  distanceIn: number;
  aspectW: number;
  aspectH: number;
  /** Rated lumens of a single projector. */
  lumens: number;
  /** Stacked projector count — multiplies lumens. */
  projectorCount: number;
  /** Fraction (0–1) of a single unit's lumens each ADDED stacked unit contributes.
   *  1 = ideal linear stacking; ~0.9 reflects real alignment/overlap losses. */
  stackEff: number;
  resW: number;
  resH: number;
  /** Ambient light on the surface, foot-candles. */
  ambientFc: number;
  /** Screen gain — luminance (fL) = illuminance (fc) × gain. */
  screenGain: number;
}

export interface ProjectionMetrics {
  widthFt: number;
  heightFt: number;
  widthIn: number;
  heightIn: number;
  areaSqFt: number;
  effectiveLumens: number;
  /** Nominal on-axis illuminance = lumens / area (lm/ft² = fc). */
  footCandles: number;
  /** Surface luminance = fc × screen gain. */
  footLamberts: number;
  /** Same luminance in cd/m² (1 fL = 3.426 nits). */
  nits: number;
  /** How far the image out-shines ambient. <~5 washes out. */
  contrastRatio: number;
  /** Native pixels per linear foot, horizontal / vertical. */
  hPpf: number;
  vPpf: number;
  band: FcBand;
}

export function projectionMetrics(i: ProjectionInputs): ProjectionMetrics {
  const widthIn = widthFromDistance(i.distanceIn, i.throwRatio);
  const aspect = i.aspectW > 0 ? i.aspectH / i.aspectW : 0;
  const heightIn = widthIn * aspect;
  const widthFt = ftFromIn(widthIn);
  const heightFt = ftFromIn(heightIn);
  const areaSqFt = widthFt * heightFt;
  // Stacking is sub-linear in reality: the first unit counts fully, each added
  // unit contributes only `stackEff` of its lumens (alignment/overlap losses).
  const count = Math.max(1, i.projectorCount);
  const effectiveLumens = i.lumens * (1 + (count - 1) * i.stackEff);
  const footCandles = areaSqFt > 0 ? effectiveLumens / areaSqFt : 0;
  const footLamberts = footCandles * i.screenGain;
  const nits = footLamberts * NITS_PER_FL;
  const contrastRatio = i.ambientFc > 0 ? footCandles / i.ambientFc : Infinity;

  return {
    widthFt,
    heightFt,
    widthIn,
    heightIn,
    areaSqFt,
    effectiveLumens,
    footCandles,
    footLamberts,
    nits,
    contrastRatio,
    hPpf: widthFt > 0 ? i.resW / widthFt : 0,
    vPpf: heightFt > 0 ? i.resH / heightFt : 0,
    band: bandForFc(footCandles),
  };
}

// --- geometry: where the cone lands on the wall ---

export type Vec3 = [number, number, number];

export interface FrustumGeometry {
  /** Lens position in world feet (x=0, y=height, z=distance out from wall). */
  lens: Vec3;
  /** The four wall corners in world feet, on the z≈0 plane. */
  topLeft: Vec3;
  topRight: Vec3;
  bottomRight: Vec3;
  bottomLeft: Vec3;
  /** Vertical centre of the landed image, world feet (derived from shift/tilt). */
  imageCenterFt: number;
}

export type LensOrigin = 'center' | 'top';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export interface FrustumParams {
  distanceIn: number;
  throwRatio: number;
  aspectW: number;
  aspectH: number;
  /** Lens height above the floor, INCHES. */
  lensAffIn: number;
  /** Vertical lens shift, % of half the image height. +up / −down. No keystone. */
  lensShiftPct: number;
  /** Where 0% shift sits: 'center' (image centred on the lens axis) or 'top'
   *  (periscope — image hangs fully below the lens at 0%). */
  lensOrigin: LensOrigin;
  /** Projector tilt, degrees. 0 = perpendicular (no keystone); +aims up. */
  tiltDeg: number;
}

/**
 * The projector sits at (0, lensAff, distance). Two independent mechanisms place
 * the image:
 *   • LENS SHIFT translates the frustum's centre ray up/down with the body still
 *     square to the wall — the image stays a clean rectangle (NO keystone).
 *   • TILT rotates the whole body about world-x; off-axis rays then land as a
 *     vertical keystone.
 * The four corner rays intersect the wall (z=0) to give the landed quad.
 * World units: FEET.
 */
export function frustumGeometry(p: FrustumParams): FrustumGeometry {
  const d = ftFromIn(p.distanceIn);
  const lensY = ftFromIn(p.lensAffIn);
  const lens: Vec3 = [0, lensY, d];

  // Half-angles from the throw ratio (on-axis image of width d/throwRatio at d).
  const tanX = p.throwRatio > 0 ? 1 / (2 * p.throwRatio) : 0;
  const aspect = p.aspectW > 0 ? p.aspectH / p.aspectW : 0;
  const tanY = tanX * aspect;

  // Vertical shift in tan-units: ±100% moves the image centre by a full half-
  // height (tanY). 'top' origin drops the baseline so the image starts below
  // the lens (image top edge at the lens axis when shift = 0).
  const baseline = p.lensOrigin === 'top' ? -tanY : 0;
  const shiftY = (p.lensShiftPct / 100) * tanY + baseline;

  // Body frame: forward toward the wall (−z), rotated about world-x by the tilt.
  const tilt = (p.tiltDeg * Math.PI) / 180;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const forward: Vec3 = [0, sin, -cos]; // +tilt aims up
  const up: Vec3 = [0, cos, sin];
  const right: Vec3 = [1, 0, 0];

  const corner = (sx: number, sy: number): Vec3 => {
    const dir = add(
      forward,
      add(scale(right, sx * tanX), scale(up, sy * tanY + shiftY)),
    );
    // Travel from the lens until the ray reaches the wall plane z=0.
    const t = dir[2] !== 0 ? -lens[2] / dir[2] : 0;
    return add(lens, scale(dir, t));
  };

  // Order corners by where they actually land so "top" is always higher in y,
  // regardless of the up-vector's sign under extreme aims.
  const raw = {
    a: corner(-1, +1),
    b: corner(+1, +1),
    c: corner(+1, -1),
    d: corner(-1, -1),
  };
  const upper = raw.a[1] >= raw.d[1] ? [raw.a, raw.b] : [raw.d, raw.c];
  const lower = raw.a[1] >= raw.d[1] ? [raw.d, raw.c] : [raw.a, raw.b];
  const imageCenterFt =
    (upper[0][1] + upper[1][1] + lower[0][1] + lower[1][1]) / 4;

  return {
    lens,
    topLeft: upper[0],
    topRight: upper[1],
    bottomRight: lower[1],
    bottomLeft: lower[0],
    imageCenterFt,
  };
}

/** Slide a landed frustum (lens + corners) sideways along world-x by `dx` feet. */
export function translateGeometryX(g: FrustumGeometry, dx: number): FrustumGeometry {
  const t = (p: Vec3): Vec3 => [p[0] + dx, p[1], p[2]];
  return {
    lens: t(g.lens),
    topLeft: t(g.topLeft),
    topRight: t(g.topRight),
    bottomRight: t(g.bottomRight),
    bottomLeft: t(g.bottomLeft),
    imageCenterFt: g.imageCenterFt,
  };
}

// --- horizontal edge-blended array (1×N) ---

export interface ArrayLayout {
  /** Projector count (≥1). */
  count: number;
  /** Overlap between neighbours as a fraction of one image width, 0–1. */
  overlapFrac: number;
  /** One projector's image width, feet. */
  singleWidthFt: number;
  /** Overlap strip width, feet (= overlapFrac × singleWidthFt). */
  overlapWidthFt: number;
  /** Combined wall width, feet: N·W − (N−1)·O. */
  totalWidthFt: number;
  /** World-x of each projector's image centre, array centred on x=0. */
  centersX: number[];
  /** World-x of each blend seam (midpoint between neighbours). */
  seamsX: number[];
}

/**
 * Lay N identical images side by side, each overlapping its neighbour by
 * `overlapPct`%, centred on x=0. Centre-to-centre spacing is one image minus the
 * overlap, so the run packs to `N·W − (N−1)·O` total width.
 */
export function arrayLayout(
  count: number,
  overlapPct: number,
  singleWidthFt: number,
): ArrayLayout {
  const n = Math.max(1, Math.round(count));
  const overlapFrac = Math.min(0.95, Math.max(0, overlapPct / 100));
  const W = singleWidthFt;
  const O = overlapFrac * W;
  const step = W - O; // centre-to-centre spacing
  const totalWidthFt = n * W - (n - 1) * O;
  const firstCenter = -totalWidthFt / 2 + W / 2;
  const centersX = Array.from({ length: n }, (_, i) => firstCenter + i * step);
  const seamsX = Array.from({ length: n - 1 }, (_, i) =>
    (centersX[i] + centersX[i + 1]) / 2,
  );
  return {
    count: n,
    overlapFrac,
    singleWidthFt: W,
    overlapWidthFt: O,
    totalWidthFt,
    centersX,
    seamsX,
  };
}

export interface ArrayMetrics {
  count: number;
  totalWidthFt: number;
  heightFt: number;
  totalAreaSqFt: number;
  /** Combined native horizontal pixels: N·resW − (N−1)·overlapPx. */
  combinedResW: number;
  /** Hot overlap illuminance before the blend curve evens it out: 2× single. */
  blendFc: number;
  /** Sum of every projector's effective lumens. */
  systemLumens: number;
  /** Combined horizontal pixels per foot across the whole image. */
  hPpf: number;
}

/**
 * Roll one projector's metrics up to the whole array. After edge blending the
 * usable on-screen brightness is the SINGLE-projector fc (the blend curve tapers
 * each overlap so the seam matches its neighbours), so the band/photometry stay
 * `m`'s; the array only changes total size, combined resolution, hot-seam
 * brightness, and system lumens.
 */
export function projectionArrayMetrics(
  m: ProjectionMetrics,
  layout: ArrayLayout,
  resW: number,
): ArrayMetrics {
  const n = layout.count;
  const combinedResW = Math.round(resW * (n - (n - 1) * layout.overlapFrac));
  return {
    count: n,
    totalWidthFt: layout.totalWidthFt,
    heightFt: m.heightFt,
    totalAreaSqFt: layout.totalWidthFt * m.heightFt,
    combinedResW,
    blendFc: m.footCandles * 2,
    systemLumens: m.effectiveLumens * n,
    hPpf: layout.totalWidthFt > 0 ? combinedResW / layout.totalWidthFt : 0,
  };
}

// --- photometry across the landed quad ---

/** Bilinear point inside the quad. u: 0=left→1=right, v: 0=top→1=bottom. */
export function quadPoint(g: FrustumGeometry, u: number, v: number): Vec3 {
  const top = add(g.topLeft, scale(sub(g.topRight, g.topLeft), u));
  const bot = add(g.bottomLeft, scale(sub(g.bottomRight, g.bottomLeft), u));
  return add(top, scale(sub(bot, top), v));
}

/** Relative falloff at a surface point: inverse-square × surface cosine. */
function falloffAt(g: FrustumGeometry, u: number, v: number): number {
  const pt = quadPoint(g, u, v);
  const toLens = sub(g.lens, pt);
  const r = len(toLens);
  if (r <= 0) return 0;
  const cosIncidence = Math.abs(toLens[2]) / r; // wall normal is (0,0,1)
  return cosIncidence / (r * r);
}

export interface IlluminanceField {
  n: number;
  /** Foot-candles per cell, row-major, row 0 = top of image. */
  data: Float32Array;
  min: number;
  max: number;
}

/**
 * Sample illuminance across the quad on an n×n grid. The relative falloff field
 * is normalised so its mean equals the nominal `footCandles` — the heatmap shows
 * the gradient while the area-average still matches the spreadsheet readout. For
 * a perpendicular projector the falloff is flat, so every cell == footCandles.
 */
export function illuminanceField(
  g: FrustumGeometry,
  footCandles: number,
  n = 24,
): IlluminanceField {
  const raw = new Float32Array(n * n);
  let sum = 0;
  for (let row = 0; row < n; row++) {
    const v = (row + 0.5) / n;
    for (let col = 0; col < n; col++) {
      const u = (col + 0.5) / n;
      const f = falloffAt(g, u, v);
      raw[row * n + col] = f;
      sum += f;
    }
  }
  const mean = sum / (n * n) || 1;
  const data = new Float32Array(n * n);
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < raw.length; k++) {
    const fc = (footCandles * raw[k]) / mean;
    data[k] = fc;
    if (fc < min) min = fc;
    if (fc > max) max = fc;
  }
  return { n, data, min, max };
}

// --- colour ramp (shared by texture, legend, badge) ---

type RGB = [number, number, number];

// fc anchors → colour. Semantic: red flags "too dim", green is the target band,
// lightening toward washout-bright above the desirable threshold.
const RAMP: { fc: number; rgb: RGB }[] = [
  { fc: 0, rgb: [40, 22, 28] },
  { fc: FC_MIN_ACCEPTABLE, rgb: [224, 65, 65] }, // 20 fc — the dim flag
  { fc: 100, rgb: [230, 126, 34] }, // marginal → good boundary
  { fc: FC_DESIRABLE, rgb: [46, 204, 113] }, // 400 fc — desirable
  { fc: 800, rgb: [160, 236, 224] }, // very bright
];

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function fcToRgb(fc: number): RGB {
  if (fc <= RAMP[0].fc) return RAMP[0].rgb;
  const last = RAMP[RAMP.length - 1];
  if (fc >= last.fc) return last.rgb;
  for (let i = 1; i < RAMP.length; i++) {
    if (fc <= RAMP[i].fc) {
      const lo = RAMP[i - 1];
      const hi = RAMP[i];
      const t = (fc - lo.fc) / (hi.fc - lo.fc);
      return lerpRgb(lo.rgb, hi.rgb, t);
    }
  }
  return last.rgb;
}

export function fcToColor(fc: number): string {
  const [r, g, b] = fcToRgb(fc);
  return `rgb(${r}, ${g}, ${b})`;
}

/** CSS gradient stops for the legend bar, spanning 0 → 800 fc. */
export function rampGradientCss(): string {
  const max = RAMP[RAMP.length - 1].fc;
  const stops = RAMP.map(
    (s) => `${fcToColor(s.fc)} ${Math.round((s.fc / max) * 100)}%`,
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
