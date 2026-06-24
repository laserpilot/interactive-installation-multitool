// Pure acoustics for the speaker-SPL-coverage tab. No React, no WebGL — just the
// geometry + photometry-style dropoff that the 3D scene, the coverage heatmap,
// and the readout all consume, so they can never disagree.
//
// This is the projection tab's inverse-square engine, made acoustic. A projector
// throws lumens; a speaker throws sound power. Both fall off with the square of
// distance — the projector loses foot-candles, the speaker loses 6 dB per
// doubling of distance. The differences:
//   • The "lens" is a DIRECTIVITY CONE: a speaker is loudest on-axis and rolls
//     off toward its rated coverage angle (the −6 dB beamwidth).
//   • Multiple speakers OVERLAP. Uncorrelated broadband sources add by POWER, so
//     two equal speakers make +3 dB, not +6 — the incoherent sum below.
//   • The verdict is two-sided: too quiet AND too loud (fatiguing) are both bad;
//     the comfortable band sits in the middle, set by the listening scenario.
//
// Units: the scene works in FEET; the store keeps lengths in INCHES and angles in
// DEGREES. The dB math is inherently per-METRE (speaker sensitivity is spec'd at
// 1 W / 1 m), so distances convert to metres right where the log lives.

export type Vec3 = [number, number, number];

export const IN_PER_FT = 12;
export const M_PER_FT = 0.3048;
export const ftFromIn = (inches: number): number => inches / IN_PER_FT;
export const inFromFt = (ft: number): number => ft * IN_PER_FT;
export const mFromFt = (ft: number): number => ft * M_PER_FT;

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

/** dB attenuation at the rated coverage half-angle (the −6 dB beamwidth spec). */
export const EDGE_DB = 6;

/** Flat dB SPL → dBA for a typical full-range programme. Broadband approximation:
 *  a single offset standing in for the frequency-weighted A-curve, so the verdict
 *  (spec'd in dBA) and a meter set to "A" roughly agree. Speech-heavy programme is
 *  nearer 0; bass-heavy nearer −3. */
export const A_WEIGHT_OFFSET = -1.5;
export const dbaFromFlat = (flatDb: number): number => flatDb + A_WEIGHT_OFFSET;
export const flatFromDba = (dba: number): number => dba - A_WEIGHT_OFFSET;

// --- a single speaker ---------------------------------------------------------

export type SpeakerMount = 'ceiling' | 'wall';

export interface SpeakerUnit {
  mount: SpeakerMount;
  /** Plan position in the room, INCHES. x = side, z = forward into the room. */
  xIn: number;
  zIn: number;
  /** Driver height above the floor, INCHES. */
  mountAffIn: number;
  /** Pan about vertical, degrees. 0 = facing into the room (+z). */
  yawDeg: number;
  /** Elevation aim, degrees. 0 = horizontal, −90 = straight down, +90 = up. */
  pitchDeg: number;
  /** Horizontal coverage angle (−6 dB beamwidth), degrees. */
  hCovDeg: number;
  /** Vertical coverage angle (−6 dB beamwidth), degrees. */
  vCovDeg: number;
  /** Sensitivity: dB SPL at 1 W / 1 m, on-axis (broadband, flat). Spec sheet:
   *  "Sensitivity". */
  sensitivity: number;
  /** Drive power, watts. On-axis 1 m SPL = sensitivity + 10·log10(power), capped
   *  at maxSplDb. On a 70 V/100 V line this is your tap setting. */
  powerW: number;
  /** Maximum continuous SPL at 1 m — the loudest it physically sustains. Spec
   *  sheet: "Maximum SPL (Continuous)". The level can never exceed this. */
  maxSplDb: number;
}

/** Common 70 V / 100 V transformer tap wattages, for the quick-pick selector. */
export const COMMON_TAPS = [7.5, 15, 30, 60];

// --- mount presets: sensible defaults so picking a mount just works -----------

export interface MountDefaults {
  mountAffIn: number;
  pitchDeg: number;
}

export const MOUNT_DEFAULTS: Record<SpeakerMount, MountDefaults> = {
  ceiling: { mountAffIn: 108, pitchDeg: -90 }, // 9 ft, firing straight down
  wall: { mountAffIn: 96, pitchDeg: -30 }, // 8 ft, angled down into the room
};

// --- speaker model presets: published sensitivity + coverage ------------------

export interface SpeakerPreset {
  label: string;
  sensitivity: number;
  powerW: number;
  maxSplDb: number;
  hCovDeg: number;
  vCovDeg: number;
  /** The mount this model is usually deployed on (seeds the mount + aim). */
  mount: SpeakerMount;
}

// `powerW` is the applied DRIVE power / tap (a sensible programme level for the
// type), not the power-handling max — that's what sets the level, up to maxSplDb.
// Numbers track real published specs (the pendant is a QSC AD-P6T).
export const SPEAKER_PRESETS: SpeakerPreset[] = [
  { label: 'Ceiling 8" coaxial — 89 dB, 90°', sensitivity: 89, powerW: 2, maxSplDb: 110, hCovDeg: 90, vCovDeg: 90, mount: 'ceiling' },
  { label: 'Pendant (QSC AD-P6T) — 88 dB, 135°', sensitivity: 88, powerW: 7.5, maxSplDb: 106, hCovDeg: 135, vCovDeg: 135, mount: 'ceiling' },
  { label: 'Surface column / line — 90 dB, 120°×30°', sensitivity: 90, powerW: 15, maxSplDb: 116, hCovDeg: 120, vCovDeg: 30, mount: 'wall' },
  { label: 'Compact point-source — 92 dB, 90°×60°', sensitivity: 92, powerW: 40, maxSplDb: 121, hCovDeg: 90, vCovDeg: 60, mount: 'wall' },
  { label: 'Coaxial point-source — 95 dB, 75°', sensitivity: 95, powerW: 80, maxSplDb: 126, hCovDeg: 75, vCovDeg: 75, mount: 'wall' },
];

// --- listening scenarios: set the comfortable band + verdict thresholds -------

export type UseCase = 'speech' | 'music' | 'pa';

export interface UseCaseDef {
  id: UseCase;
  label: string;
  blurb: string;
  /** dBA at the listener. Below min: too quiet. min→lo: a touch quiet. lo→hi: the
   *  comfortable target. hi→max: getting loud. Above max: fatiguing. */
  minDba: number;
  loDba: number;
  hiDba: number;
  maxDba: number;
  /** Speech-style intelligibility wants this much signal over the noise floor. */
  targetSnr: number;
}

export const USE_CASES: Record<UseCase, UseCaseDef> = {
  speech: {
    id: 'speech',
    label: 'Speech / paging',
    blurb: 'Announcements and voice. Intelligibility-led — wants clear headroom over the room noise.',
    minDba: 60, loDba: 65, hiDba: 75, maxDba: 85, targetSnr: 15,
  },
  music: {
    id: 'music',
    label: 'Background music',
    blurb: 'Ambient bed for retail / hospitality. Even coverage matters more than sheer level.',
    minDba: 65, loDba: 70, hiDba: 80, maxDba: 90, targetSnr: 8,
  },
  pa: {
    id: 'pa',
    label: 'Full-range PA',
    blurb: 'Programme and immersive sound. Wants level and headroom, but fatigues above ~95 dBA.',
    minDba: 80, loDba: 85, hiDba: 95, maxDba: 105, targetSnr: 20,
  },
};

export const TARGET_CENTER = (u: UseCaseDef): number => (u.loDba + u.hiDba) / 2;

// --- system power budget (taps vs amplifier) ----------------------------------

/** Load a 70 V/100 V line — or an amp channel — to at most this fraction of its
 *  rating, leaving headroom for peaks and transformer insertion loss. */
export const AMP_HEADROOM = 0.8;

export type PowerBand = 'ok' | 'tight' | 'over';

export interface PowerBudget {
  /** Sum of every speaker's tap / drive wattage. */
  totalTapW: number;
  ampW: number;
  /** Total tap load as a % of the amplifier rating. */
  loadPct: number;
  /** Watts still available under the headroom target (≤0 once tight/over). */
  spareW: number;
  band: PowerBand;
}

export const POWER_TONE: Record<PowerBand, 'good' | 'caution' | 'bad'> = {
  ok: 'good',
  tight: 'caution',
  over: 'bad',
};

export const POWER_LABEL: Record<PowerBand, string> = {
  ok: 'Within budget',
  tight: 'No headroom',
  over: 'Over budget',
};

/** Roll the speakers' taps up against the available amplifier power. On a 70 V
 *  line the taps sum directly; keep the total under AMP_HEADROOM of the amp so
 *  there's room for peaks. */
export function powerBudget(units: SpeakerUnit[], ampW: number): PowerBudget {
  const totalTapW = units.reduce((sum, u) => sum + Math.max(0, u.powerW), 0);
  const loadPct = ampW > 0 ? (totalTapW / ampW) * 100 : Infinity;
  const band: PowerBand =
    totalTapW > ampW ? 'over' : totalTapW > AMP_HEADROOM * ampW ? 'tight' : 'ok';
  return {
    totalTapW,
    ampW,
    loadPct,
    spareW: AMP_HEADROOM * ampW - totalTapW,
    band,
  };
}

// --- the directivity basis + on-axis level ------------------------------------

export interface SpeakerBasis {
  pos: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  halfHRad: number;
  halfVRad: number;
  /** On-axis SPL at 1 m, flat dB = min(sensitivity + 10·log10(power), maxSpl). */
  refDb1m: number;
  /** Headroom still available before the Max SPL ceiling, dB (≥0). */
  headroomDb: number;
  /** Driven past Max SPL — the amp is asking for more than the box can give. */
  clipped: boolean;
}

export function makeBasis(u: SpeakerUnit): SpeakerBasis {
  const pos: Vec3 = [ftFromIn(u.xIn), ftFromIn(u.mountAffIn), ftFromIn(u.zIn)];

  const yaw = u.yawDeg * DEG;
  const pitch = u.pitchDeg * DEG;
  const cp = Math.cos(pitch);
  const forward: Vec3 = [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];

  // World-up is degenerate aiming near-vertical (a ceiling speaker firing down);
  // fall back to the horizontal aim so the H/V frame stays defined and pan works.
  const refUp: Vec3 =
    Math.abs(forward[1]) > 0.999 ? [Math.sin(yaw), 0, Math.cos(yaw)] : [0, 1, 0];
  const right = norm(cross(forward, refUp));
  const up = norm(cross(right, forward));

  // Drive level at 1 m, then clamp at the Max SPL ceiling: an amp can ask for more
  // power, but the box won't make more sound than its rated maximum.
  const driveDb1m = u.sensitivity + 10 * Math.log10(Math.max(0.01, u.powerW));
  const refDb1m = Math.min(driveDb1m, u.maxSplDb);

  return {
    pos,
    forward,
    right,
    up,
    halfHRad: (u.hCovDeg * DEG) / 2,
    halfVRad: (u.vCovDeg * DEG) / 2,
    refDb1m,
    headroomDb: Math.max(0, u.maxSplDb - driveDb1m),
    clipped: driveDb1m > u.maxSplDb,
  };
}

/** Off-axis directivity attenuation (dB, ≤0) for horizontal/vertical off-axis
 *  angles. Elliptical model: normalise each angle by its coverage half-angle and
 *  combine, so the level is 0 dB on-axis and −EDGE_DB at the rated edge in either
 *  plane, rolling off quadratically beyond. */
export function directivityDb(B: SpeakerBasis, angH: number, angV: number): number {
  const nh = B.halfHRad > 0 ? angH / B.halfHRad : 0;
  const nv = B.halfVRad > 0 ? angV / B.halfVRad : 0;
  return -EDGE_DB * (nh * nh + nv * nv);
}

export interface SpeakerSample {
  /** Slant distance from driver to the point, feet. */
  distFt: number;
  /** Is the point in front of the driver (within the forward hemisphere)? */
  inFront: boolean;
  /** Off-axis angle in degrees (combined), for reporting. */
  offAxisDeg: number;
  /** This one speaker's contribution at the point, flat dB SPL. */
  splFlat: number;
}

const MIN_R_M = 0.5; // clamp the inverse-square so a point at the driver isn't ∞

/** One speaker's flat-dB contribution at a world point (feet). */
export function sampleSpeaker(B: SpeakerBasis, P: Vec3): SpeakerSample {
  const v = sub(P, B.pos);
  const distFt = len(v);
  const fwd = dot(v, B.forward);
  if (fwd <= 1e-6) {
    return { distFt, inFront: false, offAxisDeg: 90, splFlat: -Infinity };
  }
  const angH = Math.atan2(Math.abs(dot(v, B.right)), fwd);
  const angV = Math.atan2(Math.abs(dot(v, B.up)), fwd);
  const rM = Math.max(MIN_R_M, mFromFt(distFt));
  const splFlat = B.refDb1m - 20 * Math.log10(rM) + directivityDb(B, angH, angV);
  return {
    distFt,
    inFront: true,
    offAxisDeg: Math.hypot(angH, angV) / DEG,
    splFlat,
  };
}

/** Incoherent (power) sum of flat-dB contributions → combined flat dB SPL.
 *  Uncorrelated broadband sources add by power: two equal → +3 dB. */
export function combineDb(splsFlat: number[]): number {
  let p = 0;
  for (const s of splsFlat) {
    if (Number.isFinite(s)) p += Math.pow(10, s / 10);
  }
  return p > 0 ? 10 * Math.log10(p) : -Infinity;
}

export interface PointResult {
  /** Combined level at the point at the SET drive, dBA. */
  dba: number;
  /** Combined level at the set drive, flat dB SPL. */
  flat: number;
  /** Combined level if every speaker were pushed to its Max SPL, dBA — the
   *  loudest this layout can get here. */
  maxDba: number;
  /** Per-speaker contributions at the set drive, flat dB, in the speakers' order. */
  contributionsFlat: number[];
  /** Index of the loudest contributing speaker (−1 if silent). */
  dominant: number;
}

/** Total level at a world point from every speaker. */
export function pointLevel(bases: SpeakerBasis[], P: Vec3): PointResult {
  const samples = bases.map((B) => sampleSpeaker(B, P));
  const contributionsFlat = samples.map((s) => s.splFlat);
  const flat = combineDb(contributionsFlat);
  // Max output shares the same geometry + directivity; only the 1 m reference
  // changes, so each contribution rises by exactly that speaker's headroom.
  const maxFlat = combineDb(
    samples.map((s, i) => (Number.isFinite(s.splFlat) ? s.splFlat + bases[i].headroomDb : -Infinity)),
  );
  let dominant = -1;
  let best = -Infinity;
  contributionsFlat.forEach((c, i) => {
    if (c > best) {
      best = c;
      dominant = i;
    }
  });
  return { dba: dbaFromFlat(flat), flat, maxDba: dbaFromFlat(maxFlat), contributionsFlat, dominant };
}

// --- the verdict band ---------------------------------------------------------

export type SplBand = 'too-quiet' | 'quiet' | 'good' | 'loud' | 'fatiguing';

export function bandForDba(dba: number, u: UseCaseDef): SplBand {
  if (dba < u.minDba) return 'too-quiet';
  if (dba < u.loDba) return 'quiet';
  if (dba <= u.hiDba) return 'good';
  if (dba <= u.maxDba) return 'loud';
  return 'fatiguing';
}

export const BAND_TONE: Record<SplBand, 'good' | 'caution' | 'bad'> = {
  'too-quiet': 'bad',
  quiet: 'caution',
  good: 'good',
  loud: 'caution',
  fatiguing: 'bad',
};

export const BAND_LABEL: Record<SplBand, string> = {
  'too-quiet': 'Too quiet',
  quiet: 'A little quiet',
  good: 'Comfortable',
  loud: 'Getting loud',
  fatiguing: 'Fatiguing — too loud',
};

export interface ListenerVerdict {
  point: PointResult;
  /** Raw SPL band at the set drive (drives the listener-marker colour). */
  band: SplBand;
  /** Headline + reasoning + badge tone, after weighing loudness AND "loud enough". */
  label: string;
  detail: string;
  tone: 'good' | 'caution' | 'bad';
  /** Signal-to-noise over the ambient floor at the set drive, dB. */
  snr: number;
  /** Speech-style intelligibility flag from the SNR. */
  intelligible: 'good' | 'fair' | 'poor';
  /** Level this room demands: clear the noise floor by the use-case SNR, and at
   *  least reach the comfortable floor. */
  requiredDba: number;
  /** Is the SET level already at/above what the room needs? */
  loudEnough: boolean;
  /** Could it reach the required level if driven to Max SPL? */
  canReach: boolean;
  /** Spare output before the Max SPL ceiling, dB (maxDba − set dba). */
  headroomDb: number;
}

export function listenerVerdict(
  bases: SpeakerBasis[],
  P: Vec3,
  u: UseCaseDef,
  noiseFloorDba: number,
): ListenerVerdict {
  const point = pointLevel(bases, P);
  const dba = Number.isFinite(point.dba) ? point.dba : 0;
  const maxDba = Number.isFinite(point.maxDba) ? point.maxDba : 0;
  const band = bandForDba(dba, u);
  const snr = dba - noiseFloorDba;
  const intelligible: ListenerVerdict['intelligible'] =
    snr >= u.targetSnr ? 'good' : snr >= u.targetSnr - 7 ? 'fair' : 'poor';

  // What the room actually demands: loud enough to clear the noise by the use-case
  // margin, and at least into the comfortable band.
  const requiredDba = Math.max(u.loDba, noiseFloorDba + u.targetSnr);
  const loudEnough = dba >= requiredDba - 0.5;
  const canReach = maxDba >= requiredDba - 0.5;
  const headroomDb = Math.max(0, maxDba - dba);

  let label: string;
  let detail: string;
  let tone: 'good' | 'caution' | 'bad';

  if (!canReach) {
    // The core "will it be loud enough" answer: even maxed, it can't clear the
    // room. Outranks "fatiguing" — when a loud room needs more SPL than the gear
    // can give, the actionable problem is the shortfall, not the current setting.
    tone = 'bad';
    label = 'Can’t get loud enough';
    detail = `Even at full output it tops out near ${Math.round(maxDba)} dBA, under the ${Math.round(requiredDba)} dBA this ${Math.round(noiseFloorDba)} dBA room needs. Add units, move closer, or pick a louder speaker.`;
  } else if (dba > u.maxDba) {
    tone = 'bad';
    label = 'Fatiguing — too loud';
    detail = `${Math.round(dba)} dBA, past the ${u.maxDba} dBA fatigue line. Drop the tap/level or spread the coverage.`;
  } else if (!loudEnough) {
    tone = 'caution';
    label = 'Below the room — turn it up';
    detail = `${Math.round(dba)} dBA now vs ${Math.round(requiredDba)} dBA needed over ${Math.round(noiseFloorDba)} dBA noise. You have ${Math.round(headroomDb)} dB of headroom to give.`;
  } else if (band === 'good') {
    tone = 'good';
    label = 'Comfortable';
    detail = `${Math.round(dba)} dBA — inside the ${u.loDba}–${u.hiDba} dBA target and ${Math.round(snr)} dB over the room.`;
  } else if (band === 'loud') {
    tone = 'caution';
    label = 'Getting loud';
    detail = `${Math.round(dba)} dBA — above the ${u.hiDba} dBA target; fine for bursts, tiring if sustained.`;
  } else {
    // Quiet/too-quiet but technically clears the (low) required level.
    tone = 'caution';
    label = BAND_LABEL[band];
    detail = `${Math.round(dba)} dBA — a touch under the ${u.loDba}–${u.hiDba} dBA target.`;
  }

  if (intelligible === 'poor' && tone === 'good') {
    tone = 'caution';
    detail += ` Only ${Math.round(snr)} dB over the noise — speech may struggle.`;
  }

  return {
    point,
    band,
    label,
    detail,
    tone,
    snr,
    intelligible,
    requiredDba,
    loudEnough,
    canReach,
    headroomDb,
  };
}

// --- the design throw (how far a speaker reaches on-axis) ----------------------

/** On-axis distance (feet) where this speaker alone falls to `targetDba`. Used to
 *  size the directivity cone so it visually "reaches" as far as it's useful. */
export function designThrowFt(B: SpeakerBasis, targetDba: number): number {
  const targetFlat = flatFromDba(targetDba);
  const rM = Math.pow(10, (B.refDb1m - targetFlat) / 20);
  return Math.min(80, Math.max(2, rM / M_PER_FT));
}

// --- the cone corner rays (for the gradient directivity cone) -----------------

export interface ConeRays {
  pos: Vec3;
  /** Unit corner directions [TL, TR, BR, BL] at the coverage edges. */
  dirs: [Vec3, Vec3, Vec3, Vec3];
  basis: SpeakerBasis;
  throwFt: number;
}

export function coneRays(u: SpeakerUnit, targetDba: number): ConeRays {
  const B = makeBasis(u);
  const tanX = Math.tan(B.halfHRad);
  const tanY = Math.tan(B.halfVRad);
  const corner = (a: number, b: number): Vec3 =>
    norm(add(B.forward, add(scale(B.right, a * tanX), scale(B.up, b * tanY))));
  return {
    pos: B.pos,
    dirs: [corner(-1, +1), corner(+1, +1), corner(+1, -1), corner(-1, -1)],
    basis: B,
    throwFt: designThrowFt(B, targetDba),
  };
}

// --- the ear-height coverage field --------------------------------------------

export interface CoverageField {
  n: number;
  /** Combined level per cell, dBA. Row-major, row 0 = +z far. */
  data: Float32Array;
  minX: number;
  minZ: number;
  sizeFt: number;
  earFt: number;
  /** dBA range across cells that clear the audible floor. */
  loDba: number;
  hiDba: number;
  /** Coverage spread (hi − lo) over the in-target footprint — the evenness metric. */
  spreadDb: number;
  /** Floor area at/above the comfortable band's low edge, ft². */
  goodAreaSqFt: number;
  /** Floor area audible (≥ the use-case floor), ft². */
  audibleAreaSqFt: number;
}

/**
 * Score a horizontal plane at ear height by the combined level a listener's ears
 * would meet at each cell. Centred on the speaker cluster and sized to its spread
 * plus the longest design throw, so the map frames every unit's coverage.
 */
export function coverageField(
  units: SpeakerUnit[],
  earHeightIn: number,
  u: UseCaseDef,
  n = 60,
): CoverageField {
  const earFt = ftFromIn(earHeightIn);
  const bases = units.map(makeBasis);

  // Frame the cluster: bounding box of the speakers + the longest design throw.
  const xs = units.map((s) => ftFromIn(s.xIn));
  const zs = units.map((s) => ftFromIn(s.zIn));
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
  const spread = Math.max(
    xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    zs.length ? Math.max(...zs) - Math.min(...zs) : 0,
  );
  const reach = bases.length
    ? Math.max(...bases.map((B) => designThrowFt(B, u.minDba)))
    : 8;
  const sizeFt = Math.max(spread + reach * 1.4, 16);
  const minX = cx - sizeFt / 2;
  const minZ = cz - sizeFt / 2;
  const cell = sizeFt / n;

  const data = new Float32Array(n * n);
  let lo = Infinity;
  let hi = -Infinity;
  let good = 0;
  let audible = 0;
  for (let row = 0; row < n; row++) {
    // row 0 = far (+z high) → row n−1 = near, so the texture's top is "far".
    const z = minZ + sizeFt - (row + 0.5) * cell;
    for (let col = 0; col < n; col++) {
      const x = minX + (col + 0.5) * cell;
      const flat = combineDb(bases.map((B) => sampleSpeaker(B, [x, earFt, z]).splFlat));
      const dba = dbaFromFlat(flat);
      data[row * n + col] = dba;
      if (dba >= u.minDba) {
        audible++;
        if (dba < lo) lo = dba;
        if (dba > hi) hi = dba;
      }
      if (dba >= u.loDba) good++;
    }
  }
  const cellArea = cell * cell;
  return {
    n,
    data,
    minX,
    minZ,
    sizeFt,
    earFt,
    loDba: Number.isFinite(lo) ? lo : 0,
    hiDba: Number.isFinite(hi) ? hi : 0,
    spreadDb: Number.isFinite(hi) && Number.isFinite(lo) ? hi - lo : 0,
    goodAreaSqFt: good * cellArea,
    audibleAreaSqFt: audible * cellArea,
  };
}

// --- colour ramps (shared by texture, legend, cone, badge) --------------------

type RGB = [number, number, number];

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rampLookup(anchors: { at: number; rgb: RGB }[], x: number): RGB {
  if (x <= anchors[0].at) return anchors[0].rgb;
  const last = anchors[anchors.length - 1];
  if (x >= last.at) return last.rgb;
  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i].at) {
      const a = anchors[i - 1];
      const b = anchors[i];
      return lerpRgb(a.rgb, b.rgb, (x - a.at) / (b.at - a.at));
    }
  }
  return last.rgb;
}

// SPL ramp: cold blue (too quiet) → green (comfortable) → amber → red (fatiguing),
// anchored to the active scenario's band so the map recolours per use case.
export function splToRgb(dba: number, u: UseCaseDef): RGB {
  const anchors: { at: number; rgb: RGB }[] = [
    { at: u.minDba - 12, rgb: [38, 58, 110] },
    { at: u.minDba, rgb: [60, 110, 190] },
    { at: u.loDba, rgb: [46, 204, 113] },
    { at: u.hiDba, rgb: [120, 205, 70] },
    { at: u.maxDba, rgb: [230, 150, 40] },
    { at: u.maxDba + 10, rgb: [224, 65, 65] },
  ];
  return rampLookup(anchors, dba);
}

export function splColor(dba: number, u: UseCaseDef): string {
  const [r, g, b] = splToRgb(dba, u);
  return `rgb(${r}, ${g}, ${b})`;
}

// Uniformity ramp: how far a cell sits from the target centre level, in dB.
// 0 = green (on target), ±3 = yellow, ±6+ = red — the classic ±3 dB evenness goal.
const UNIFORM: { at: number; rgb: RGB }[] = [
  { at: 0, rgb: [46, 204, 113] },
  { at: 3, rgb: [230, 200, 60] },
  { at: 6, rgb: [230, 140, 40] },
  { at: 10, rgb: [224, 65, 65] },
];

export function uniformityToRgb(devDb: number): RGB {
  return rampLookup(UNIFORM, Math.abs(devDb));
}

export function uniformityColor(devDb: number): string {
  const [r, g, b] = uniformityToRgb(devDb);
  return `rgb(${r}, ${g}, ${b})`;
}

/** CSS gradient for the SPL legend bar across the scenario's band. */
export function splGradientCss(u: UseCaseDef): string {
  const span = u.maxDba + 10 - (u.minDba - 12);
  const stop = (at: number) =>
    `${splColor(at, u)} ${Math.round(((at - (u.minDba - 12)) / span) * 100)}%`;
  return `linear-gradient(90deg, ${[u.minDba - 12, u.minDba, u.loDba, u.hiDba, u.maxDba, u.maxDba + 10].map(stop).join(', ')})`;
}

/** CSS gradient for the uniformity legend bar, 0 → 10 dB deviation. */
export function uniformityGradientCss(): string {
  const stop = (a: { at: number; rgb: RGB }) =>
    `rgb(${a.rgb[0]}, ${a.rgb[1]}, ${a.rgb[2]}) ${Math.round((a.at / 10) * 100)}%`;
  return `linear-gradient(90deg, ${UNIFORM.map(stop).join(', ')})`;
}
