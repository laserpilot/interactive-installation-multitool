// Pure geometry + tracking-confidence model for the sensor-coverage tab. No
// React, no WebGL — shared by the 3D scene, the trackable-zone texture, the
// avatar colouring, and the readout so they can never disagree.
//
// The framing is PERSON-CENTRIC: the question is not "what fraction of the cone
// hits a surface" but "how well is a body tracked, here, for this sensing task."
// Two ideas drive everything:
//   • A sensor has a MOUNT POSE (ceiling/wall/floor, with pan + tilt) and an FOV
//     cone — the projection-tab frustum generalised.
//   • Tracking CONFIDENCE is a smooth function of depth, set by the SENSING MODE.
//     A depth cam's spec range is not its usable range: skeletal tracking gets
//     noisy well before the advertised max. So a mode defines a high-confidence
//     sweet spot (conf=1) with ramps to 0 at the near/far limits.
//
// World units are FEET. The store keeps lengths in INCHES, angles in DEGREES;
// convert at the boundary with `ftFromIn`.

import type { Persona } from '../ergonomics/constants';
import { bodyKeypoints, type Keypoint } from './bodyModel';

export type Vec3 = [number, number, number];

export const IN_PER_FT = 12;
export const ftFromIn = (inches: number): number => inches / IN_PER_FT;
export const inFromFt = (ft: number): number => ft * IN_PER_FT;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
};

const DEG = Math.PI / 180;
const M_TO_IN = 39.3701;
export const mToIn = (m: number): number => m * M_TO_IN;

function smoothstep(e0: number, e1: number, x: number): number {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export type SensorMount = 'ceiling' | 'wall' | 'floor';
export type SensorTarget = 'floor' | 'wall';

export interface SensorParams {
  mount: SensorMount;
  /** Sensor height above the floor, INCHES (ceiling height, wall height, or 0). */
  mountAffIn: number;
  /** Elevation aim, degrees. 0 = horizontal, −90 = straight down, +90 = up. */
  pitchDeg: number;
  /** Pan about vertical, degrees. 0 = facing into the room (+z). */
  yawDeg: number;
  hFovDeg: number;
  vFovDeg: number;
  /** Hard near cutoff — blind nearer than this, INCHES. */
  minRangeIn: number;
  /** Near edge of the high-confidence sweet spot, INCHES. */
  confNearIn: number;
  /** Far edge of the high-confidence sweet spot, INCHES. */
  confFarIn: number;
  /** Far cutoff — confidence reaches 0 here, INCHES. */
  maxRangeIn: number;
}

// --- mount presets: sensible defaults so picking a mount just works ----------

export interface MountDefaults {
  mountAffIn: number;
  pitchDeg: number;
  target: SensorTarget;
}

export const MOUNT_DEFAULTS: Record<SensorMount, MountDefaults> = {
  ceiling: { mountAffIn: 108, pitchDeg: -90, target: 'floor' },
  wall: { mountAffIn: 96, pitchDeg: -20, target: 'floor' },
  floor: { mountAffIn: 4, pitchDeg: 35, target: 'wall' },
};

// --- sensor presets: published FOV + hardware depth range --------------------

export interface SensorPreset {
  label: string;
  hFovDeg: number;
  vFovDeg: number;
  /** Hardware depth window, METRES. */
  minM: number;
  maxM: number;
}

export const SENSOR_PRESETS: SensorPreset[] = [
  { label: 'Azure Kinect — NFOV', hFovDeg: 75, vFovDeg: 65, minM: 0.5, maxM: 3.86 },
  { label: 'Azure Kinect — WFOV', hFovDeg: 120, vFovDeg: 120, minM: 0.25, maxM: 2.88 },
  { label: 'Kinect v2', hFovDeg: 70, vFovDeg: 60, minM: 0.5, maxM: 4.5 },
  { label: 'RealSense D435', hFovDeg: 87, vFovDeg: 58, minM: 0.3, maxM: 3.0 },
  { label: 'RealSense D455', hFovDeg: 87, vFovDeg: 58, minM: 0.6, maxM: 6.0 },
  { label: 'Orbbec Femto Bolt', hFovDeg: 75, vFovDeg: 65, minM: 0.25, maxM: 5.46 },
  { label: 'ZED 2 (stereo)', hFovDeg: 110, vFovDeg: 70, minM: 0.3, maxM: 20 },
];

// --- sensing modes: spec range ≠ usable range --------------------------------

export type SensingMode = 'skeletal' | 'hand' | 'pointcloud' | 'presence';

export interface SensingProfile {
  minM: number;
  confNearM: number;
  confFarM: number;
  maxM: number;
}

export interface SensingModeDef {
  id: SensingMode;
  label: string;
  blurb: string;
  /** Resolve the confidence window for a given hardware max depth (metres). */
  profile: (hwMaxM: number) => SensingProfile;
}

// Typical usable windows per task. Skeletal/hand are tighter than the hardware
// depth range; point-cloud/presence ride most of it. All editable after seeding.
export const SENSING_MODES: Record<SensingMode, SensingModeDef> = {
  skeletal: {
    id: 'skeletal',
    label: 'Skeletal',
    blurb: 'Full-body joints. Reliable in a tight mid-range; noisy past ~3.5 m even when depth still reads.',
    profile: (hw) => ({
      minM: 0.5,
      confNearM: 1.2,
      confFarM: Math.min(3.5, hw),
      maxM: Math.min(4.5, hw),
    }),
  },
  hand: {
    id: 'hand',
    label: 'Hand / gesture',
    blurb: 'Fingers and fine gesture — only works up close.',
    profile: () => ({ minM: 0.25, confNearM: 0.4, confFarM: 1.0, maxM: 1.5 }),
  },
  pointcloud: {
    id: 'pointcloud',
    label: 'Point cloud',
    blurb: 'Raw depth / geometry. Uses most of the hardware range, softening near the limit.',
    profile: (hw) => ({
      minM: 0.3,
      confNearM: 0.5,
      confFarM: 0.85 * hw,
      maxM: hw,
    }),
  },
  presence: {
    id: 'presence',
    label: 'Presence',
    blurb: 'Blob / occupancy. Forgiving — anywhere in range counts.',
    profile: (hw) => ({ minM: 0.3, confNearM: 0.5, confFarM: hw, maxM: hw }),
  },
};

/** Resolve a sensing mode's confidence thresholds (inches) for a hardware max. */
export function modeProfileIn(
  mode: SensingMode,
  hwMaxIn: number,
): { minRangeIn: number; confNearIn: number; confFarIn: number; maxRangeIn: number } {
  const p = SENSING_MODES[mode].profile(hwMaxIn / M_TO_IN);
  return {
    minRangeIn: mToIn(p.minM),
    confNearIn: mToIn(p.confNearM),
    confFarIn: mToIn(p.confFarM),
    maxRangeIn: mToIn(p.maxM),
  };
}

// --- the frustum basis + confidence-by-depth ---------------------------------

export interface Basis {
  sensor: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  tanX: number;
  tanY: number;
  minFt: number;
  confNearFt: number;
  confFarFt: number;
  maxFt: number;
}

export function makeBasis(p: SensorParams): Basis {
  const sensor: Vec3 = [0, ftFromIn(p.mountAffIn), 0];

  const yaw = p.yawDeg * DEG;
  const pitch = p.pitchDeg * DEG;
  const cp = Math.cos(pitch);
  const forward: Vec3 = [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];

  // World-up is degenerate when aiming near-vertical; fall back to the horizontal
  // aim direction so the image frame stays defined and pan still rotates it.
  const refUp: Vec3 =
    Math.abs(forward[1]) > 0.999 ? [Math.sin(yaw), 0, Math.cos(yaw)] : [0, 1, 0];
  const right = norm(cross(forward, refUp));
  const up = norm(cross(right, forward));

  return {
    sensor,
    forward,
    right,
    up,
    tanX: Math.tan((p.hFovDeg * DEG) / 2),
    tanY: Math.tan((p.vFovDeg * DEG) / 2),
    minFt: ftFromIn(p.minRangeIn),
    confNearFt: ftFromIn(Math.max(p.minRangeIn, p.confNearIn)),
    confFarFt: ftFromIn(Math.min(p.maxRangeIn, p.confFarIn)),
    maxFt: ftFromIn(p.maxRangeIn),
  };
}

/** Smooth tracking confidence [0,1] at a slant distance (feet). */
export function confidenceAtFt(distFt: number, B: Basis): number {
  if (distFt < B.minFt) return 0;
  if (distFt < B.confNearFt) return smoothstep(B.minFt, B.confNearFt, distFt);
  if (distFt <= B.confFarFt) return 1;
  if (distFt < B.maxFt) return 1 - smoothstep(B.confFarFt, B.maxFt, distFt);
  return 0;
}

export interface PointSample {
  inFOV: boolean;
  distFt: number;
  conf: number;
}

/** Test a world point against the sensor: in the FOV cone? how confident? */
export function samplePointB(B: Basis, P: Vec3): PointSample {
  const v = sub(P, B.sensor);
  const fwd = dot(v, B.forward);
  if (fwd <= 1e-6) return { inFOV: false, distFt: len(v), conf: 0 };
  const tanH = Math.abs(dot(v, B.right) / fwd);
  const tanV = Math.abs(dot(v, B.up) / fwd);
  const inFOV = tanH <= B.tanX && tanV <= B.tanY;
  const distFt = len(v);
  return { inFOV, distFt, conf: inFOV ? confidenceAtFt(distFt, B) : 0 };
}

export function samplePoint(p: SensorParams, P: Vec3): PointSample {
  return samplePointB(makeBasis(p), P);
}

// --- the cone rays (for the gradient frustum) --------------------------------

export interface ConeRays {
  sensor: Vec3;
  /** Unit corner directions [TL, TR, BR, BL]. */
  dirs: [Vec3, Vec3, Vec3, Vec3];
  minFt: number;
  confNearFt: number;
  confFarFt: number;
  maxFt: number;
  basis: Basis;
}

export function coneRays(p: SensorParams): ConeRays {
  const B = makeBasis(p);
  const corner = (a: number, b: number): Vec3 =>
    norm(add(B.forward, add(scale(B.right, a * B.tanX), scale(B.up, b * B.tanY))));
  return {
    sensor: B.sensor,
    dirs: [corner(-1, +1), corner(+1, +1), corner(+1, -1), corner(-1, -1)],
    minFt: B.minFt,
    confNearFt: B.confNearFt,
    confFarFt: B.confFarFt,
    maxFt: B.maxFt,
    basis: B,
  };
}

// --- body coverage at a placed person ----------------------------------------

export type CoverageBand = 'good' | 'noisy' | 'partial' | 'tooclose' | 'toofar' | 'out';

export interface PartCoverage extends PointSample {
  name: string;
  core: boolean;
  point: Vec3;
}

export interface BodyCoverage {
  parts: PartCoverage[];
  band: CoverageBand;
  label: string;
  detail: string;
  /** Min confidence across the core (must-track) keypoints. */
  minCoreConf: number;
  /** Fraction of core keypoints inside the FOV. */
  fracCoreInFov: number;
}

export const BAND_TONE: Record<CoverageBand, 'good' | 'caution' | 'bad'> = {
  good: 'good',
  noisy: 'caution',
  partial: 'caution',
  tooclose: 'bad',
  toofar: 'bad',
  out: 'bad',
};

export const BAND_LABEL: Record<CoverageBand, string> = {
  good: 'Full body tracked',
  noisy: 'Tracked but noisy',
  partial: 'Partly out of frame',
  tooclose: 'Too close',
  toofar: 'Too far — out of range',
  out: 'Outside coverage',
};

export function bodyCoverage(
  p: SensorParams,
  persona: Persona,
  x: number,
  z: number,
): BodyCoverage {
  const B = makeBasis(p);
  const kps: Keypoint[] = bodyKeypoints(persona, x, z);
  const parts: PartCoverage[] = kps.map((k) => ({
    name: k.name,
    core: k.core,
    point: k.point,
    ...samplePointB(B, k.point),
  }));

  const core = parts.filter((pt) => pt.core);
  const coreInFov = core.filter((pt) => pt.inFOV);
  const fracCoreInFov = core.length ? coreInFov.length / core.length : 0;
  const minCoreConf = coreInFov.length
    ? Math.min(...coreInFov.map((pt) => pt.conf))
    : 0;

  // Classify. Order matters: nothing visible → out; a core part clipped by the
  // FOV → partial; inside the near blind zone → too close; beyond max range → too
  // far; else by confidence. Near and far are distinct failures (conf is 0 for
  // both, so split them by distance, not by conf).
  let band: CoverageBand;
  let detail = '';
  const outParts = core.filter((pt) => !pt.inFOV).map((pt) => pt.name);
  const nearBlind = coreInFov.some((pt) => pt.distFt < B.minFt);
  const farOut = coreInFov.some((pt) => pt.distFt > B.maxFt);

  if (fracCoreInFov === 0) {
    band = 'out';
    detail = 'No part of the body is inside the field of view.';
  } else if (outParts.length > 0) {
    band = 'partial';
    detail = `${outParts.join(', ')} outside the field of view.`;
  } else if (nearBlind) {
    band = 'tooclose';
    detail = 'Body is inside the blind zone — back it away from the sensor.';
  } else if (farOut) {
    band = 'toofar';
    detail = 'Body is beyond the usable range — move it closer or lower the sensor.';
  } else if (minCoreConf >= 0.66) {
    band = 'good';
    detail = 'Whole body sits in the high-confidence zone.';
  } else {
    band = 'noisy';
    detail = 'In range but past the reliable zone — tracking will be jittery.';
  }

  return {
    parts,
    band,
    label: BAND_LABEL[band],
    detail,
    minCoreConf,
    fracCoreInFov,
  };
}

// --- trackable-zone floor field ----------------------------------------------

export interface TrackableField {
  n: number;
  /** Whole-body trackability score [0,1] per cell. Row-major, row 0 = +z far. */
  data: Float32Array;
  /** World extent of the grid (feet). */
  minX: number;
  minZ: number;
  sizeFt: number;
  /** Floor area scoring above the "tracked" threshold, ft². */
  coveredAreaSqFt: number;
}

const TRACK_THRESHOLD = 0.5; // score at/above this counts as "trackable"

/**
 * Score a floor grid by whether a standing body of `persona` would be tracked if
 * it stood on each cell: min confidence across the core keypoints, or 0 if any
 * core keypoint falls outside the FOV. Centred on where the sensor aims at the
 * floor, sized to its reach.
 */
export function trackableField(
  p: SensorParams,
  persona: Persona,
  n = 56,
): TrackableField {
  const B = makeBasis(p);

  // Centre the grid on the floor aim point (or the horizontal aim if it never
  // dips to the floor), and size it to a little past max range.
  let cx: number;
  let cz: number;
  if (B.forward[1] < -0.05) {
    const t = -B.sensor[1] / B.forward[1];
    cx = B.forward[0] * t;
    cz = B.forward[2] * t;
  } else {
    const horiz = norm([B.forward[0], 0, B.forward[2]]);
    cx = horiz[0] * B.confFarFt;
    cz = horiz[2] * B.confFarFt;
  }
  const sizeFt = Math.max(2 * B.maxFt, 8);
  const minX = cx - sizeFt / 2;
  const minZ = cz - sizeFt / 2;
  const cell = sizeFt / n;

  const data = new Float32Array(n * n);
  let covered = 0;
  for (let row = 0; row < n; row++) {
    // row 0 = far (+z high) → row n-1 = near, so the texture's top is "far".
    const z = minZ + sizeFt - (row + 0.5) * cell;
    for (let col = 0; col < n; col++) {
      const x = minX + (col + 0.5) * cell;
      const kps = bodyKeypoints(persona, x, z).filter((k) => k.core);
      let score = 1;
      for (const k of kps) {
        const s = samplePointB(B, k.point);
        if (!s.inFOV) {
          score = 0;
          break;
        }
        score = Math.min(score, s.conf);
      }
      data[row * n + col] = score;
      if (score >= TRACK_THRESHOLD) covered++;
    }
  }
  return {
    n,
    data,
    minX,
    minZ,
    sizeFt,
    coveredAreaSqFt: covered * cell * cell,
  };
}

// --- confidence colour ramp (avatar, zone, frustum all share it) -------------

type RGB = [number, number, number];

const OUT: RGB = [70, 78, 92]; // outside the field of view
const C0: RGB = [224, 65, 65]; // conf 0 — blind / unreliable
const C50: RGB = [230, 170, 40]; // conf 0.5 — noisy
const C1: RGB = [46, 204, 113]; // conf 1 — high confidence

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** conf [0,1] → red→amber→green. */
export function confRgb(conf: number): RGB {
  const c = Math.min(1, Math.max(0, conf));
  return c < 0.5 ? lerpRgb(C0, C50, c / 0.5) : lerpRgb(C50, C1, (c - 0.5) / 0.5);
}

export function confColor(conf: number, inFOV: boolean): string {
  const [r, g, b] = inFOV ? confRgb(conf) : OUT;
  return `rgb(${r}, ${g}, ${b})`;
}

/** CSS gradient for the legend bar: low → high confidence. */
export function rampGradientCss(): string {
  const stop = (c: RGB, pct: number) => `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${pct}%`;
  return `linear-gradient(90deg, ${stop(C0, 0)}, ${stop(C50, 50)}, ${stop(C1, 100)})`;
}
