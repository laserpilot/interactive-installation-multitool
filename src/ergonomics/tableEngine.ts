// Ergonomics engine for a HORIZONTAL table touchscreen. Pure math, no React.
// Lengths in INCHES. The vertical-wall engine (engine.ts) judges reach as a
// height problem against the ADA 15–48" band; a flat table is a different beast:
//   - Reach is a DEPTH problem — how far you can touch ACROSS the surface,
//     limited by arm + torso lean, not a height band.
//   - The governing rule is ADA 308.3 forward reach OVER an obstruction (the
//     table edge): the deeper the reach, the less is allowed; >25" isn't.
//   - A seated/wheelchair user must pull up UNDER the table (knee/toe clearance,
//     ADA 306/902) — a height-of-surface question the wall model never asks.
//   - Viewing is look-down, not stand-back-to-take-it-in.
// So this lives in its own module with its own tests; engine.ts is untouched.

import {
  ADA_OBSTRUCTED_DEEP_DEPTH,
  ADA_OBSTRUCTED_SHALLOW_DEPTH,
  KNEE_CLEARANCE_HEIGHT,
  PERSONAS,
  REACH_ARM_FRACTION,
  REACH_THRESHOLDS,
  SEATED_LEAN_ALLOWANCE,
  STANDING_LEAN_ALLOWANCE,
  TABLE_SURFACE_MAX,
  TABLE_SURFACE_MIN,
  type Persona,
  type PersonaId,
  type Strictness,
} from './constants';
import {
  pixelMetrics,
  type PixelMetrics,
  type ScreenSize,
  type VerdictLevel,
  type VerdictReason,
} from './engine';
import { tableGeometry } from './tableGeometry';

const DEG = 180 / Math.PI;
const RANK: Record<VerdictLevel, number> = { good: 0, caution: 1, bad: 2 };

// --- Forward functional reach across the surface ----------------------------

export interface TableReach {
  /** Max horizontal depth (in) the user can touch from the table edge. */
  depthMax: number;
  /** Fraction (0–1) of the SCREEN depth within reach (accounts for the border). */
  reachableDepthFraction: number;
  /** True if the whole screen (past the border) is within reach. */
  fullyReachable: boolean;
  /** Arm length used (in) — reach radius before the lean allowance. */
  armLen: number;
}

/**
 * How far a body can touch across a flat surface, mirroring the vertical reach
 * envelope (r = √(reach² − offset²)) but with the VERTICAL drop from shoulder to
 * surface as the offset. The reach radius is arm length plus a torso-lean
 * allowance over the table edge.
 *
 * `bezel` is the border between the table's outer edge (where the user stands)
 * and the screen, so the screen occupies depth [bezel, bezel + depth] — a wide
 * frame pushes the reachable screen content further away.
 */
export function tableReach(
  persona: Persona,
  tableHeight: number,
  depth: number,
  bezel = 0,
): TableReach {
  const armLen = REACH_ARM_FRACTION * persona.statureHeight;
  const lean = persona.seated ? SEATED_LEAN_ALLOWANCE : STANDING_LEAN_ALLOWANCE;
  const reach = armLen + lean;
  const drop = persona.shoulderHeight - tableHeight; // vertical offset to surface
  const depthMax = Math.sqrt(Math.max(0, reach * reach - drop * drop));
  // Reach into the screen, past the border, clamped to the screen depth.
  const intoScreen = Math.max(0, Math.min(depthMax - bezel, depth));
  return {
    depthMax,
    reachableDepthFraction: depth > 0 ? intoScreen / depth : 1,
    fullyReachable: depthMax >= bezel + depth,
    armLen,
  };
}

// --- ADA 308.3.2 forward reach over an obstruction --------------------------

export interface AdaObstruction {
  level: VerdictLevel;
  /** Allowable high reach (in) for this reach depth, per 308.3.2. */
  allowableHigh: number;
  /** Reach-across depth assessed (in). */
  depth: number;
}

/**
 * Judge the reach-across depth against ADA 308.3.2: at ≤20" the full 48" high
 * reach is allowed; 20–25" drops it to 44"; beyond 25" a forward reach over an
 * obstruction is not permitted at all.
 */
export function adaReachOverObstruction(depth: number): AdaObstruction {
  if (depth <= ADA_OBSTRUCTED_SHALLOW_DEPTH) {
    return { level: 'good', allowableHigh: 48, depth };
  }
  if (depth <= ADA_OBSTRUCTED_DEEP_DEPTH) {
    return { level: 'caution', allowableHigh: 44, depth };
  }
  return { level: 'bad', allowableHigh: 0, depth };
}

// --- ADA 306/902 seated knee + toe clearance --------------------------------

export interface SeatedClearance {
  level: VerdictLevel;
  /** True if there's room to roll knees/toes under the front edge. */
  kneeClearOk: boolean;
  /** True if the surface height is in the ADA 28–34" work-surface range. */
  surfaceInAdaRange: boolean;
}

/**
 * Can a wheelchair user pull up under the table? Needs the surface in the ADA
 * 28–34" work-surface range with knee clearance below. Too low (no knee room) is
 * a hard fail; too high means standing-only — usable, but not seated-accessible.
 */
export function tableSeatedClearance(tableHeight: number): SeatedClearance {
  const kneeClearOk = tableHeight >= KNEE_CLEARANCE_HEIGHT;
  if (tableHeight < TABLE_SURFACE_MIN) {
    return { level: 'bad', kneeClearOk, surfaceInAdaRange: false };
  }
  if (tableHeight > TABLE_SURFACE_MAX) {
    return { level: 'caution', kneeClearOk, surfaceInAdaRange: false };
  }
  return { level: 'good', kneeClearOk, surfaceInAdaRange: true };
}

// --- Top-level table verdict ------------------------------------------------

export interface TableConfig {
  size: ScreenSize;
  /** Surface height off the finished floor (in). */
  tableHeight: number;
  personaId: PersonaId;
  /** Border/frame width between the table's outer edge and the screen (in). */
  bezel?: number;
  horizontalPixels?: number;
  pitchMm?: number;
  strictness?: Strictness;
}

/** The portion of the screen a standing/seated user can comfortably reach. */
export interface UsableArea {
  /** Reachable depth into the screen along the centre line (in). */
  depthIn: number;
  /** Reachable width at the near screen edge (in). */
  widthIn: number;
  /** Fraction (0–1) of the screen AREA within reach. */
  areaFraction: number;
  /** Pixels per inch (square-pixel assumption); null if no pixel count given. */
  ppi: number | null;
  /** Approx usable bounding box and pixel count within reach. */
  pxW: number | null;
  pxD: number | null;
  pxArea: number | null;
}

export interface TableVerdict {
  level: VerdictLevel;
  reasons: VerdictReason[];
  /** Reach-across depth = the screen dimension lying away from the user (in). */
  depth: number;
  /** Border between the user's edge and the screen (in). */
  bezel: number;
  reach: TableReach;
  ada: AdaObstruction;
  seated: SeatedClearance;
  /** The reachable region of the screen (for the heatmap + designer readout). */
  usable: UsableArea;
  /** Eye→surface-center distance for the look-down view (in). */
  effectiveDistance: number;
  /** Depression angle below horizontal to the surface center (deg). */
  lookDownAngle: number;
  pixels: PixelMetrics;
  persona: Persona;
}

/**
 * The reachable region of the screen: points within `depthMax` horizontal reach
 * of the user at the table edge, the screen offset back by the border `bezel`.
 * Area is integrated (the region is a circular segment, not a rectangle).
 */
export function usableReachArea(
  width: number,
  depth: number,
  bezel: number,
  depthMax: number,
  horizontalPixels?: number,
): UsableArea {
  const depthIn = Math.max(0, Math.min(depthMax - bezel, depth));
  const halfAtNear = Math.sqrt(Math.max(0, depthMax * depthMax - bezel * bezel));
  const widthIn = Math.min(width, 2 * halfAtNear);

  const N = 200;
  const dd = depth / N;
  let area = 0;
  for (let i = 0; i < N; i++) {
    const dn = bezel + (i + 0.5) * dd; // depth from the user's edge
    const half = Math.sqrt(Math.max(0, depthMax * depthMax - dn * dn));
    area += 2 * Math.min(half, width / 2) * dd;
  }
  const screenArea = width * depth;
  const areaFraction = screenArea > 0 ? Math.min(1, area / screenArea) : 0;
  const ppi = horizontalPixels && width > 0 ? horizontalPixels / width : null;
  return {
    depthIn,
    widthIn,
    areaFraction,
    ppi,
    pxW: ppi ? Math.round(widthIn * ppi) : null,
    pxD: ppi ? Math.round(depthIn * ppi) : null,
    pxArea: ppi ? Math.round(area * ppi * ppi) : null,
  };
}

/** Grade a reachable fraction against the strictness thresholds (shared rule). */
function gradeReach(fraction: number, strictness: Strictness): VerdictLevel {
  const t = REACH_THRESHOLDS[strictness];
  if (fraction >= t.good) return 'good';
  if (fraction >= t.caution) return 'caution';
  return 'bad';
}

export function tableVerdict(cfg: TableConfig): TableVerdict {
  const persona = PERSONAS[cfg.personaId];
  const strictness = cfg.strictness ?? 'realistic';
  // The screen lies face-up; its "height" dimension lies away from the user, so
  // it is the depth reached across. Its "width" runs along the near edge.
  const depth = cfg.size.height;
  const bezel = cfg.bezel ?? 0;
  // Distance from the user's standing edge (table's outer edge) to the far edge
  // of the screen — what reach and ADA are actually measured against.
  const reachDepth = bezel + depth;
  const reasons: VerdictReason[] = [];

  const geom = tableGeometry({ tableHeight: cfg.tableHeight, depth });

  // 1. Forward functional reach across the surface ---------------------------
  const reach = tableReach(persona, cfg.tableHeight, depth, bezel);
  const borderNote = bezel >= 0.5 ? ` (incl. ${bezel.toFixed(0)}" border)` : '';
  if (reach.fullyReachable) {
    reasons.push({
      level: 'good',
      text: `${persona.label} can reach the whole ${reachDepth.toFixed(0)}" across${borderNote}.`,
    });
  } else {
    const pctOut = Math.round((1 - reach.reachableDepthFraction) * 100);
    reasons.push({
      level: gradeReach(reach.reachableDepthFraction, strictness),
      text: `${persona.label} can only reach ~${reach.depthMax.toFixed(
        0,
      )}" across${borderNote} — the far ${pctOut}% of the screen is out of reach from one side.`,
    });
  }

  // 2. ADA 308.3.2 forward reach over the edge -------------------------------
  const ada = adaReachOverObstruction(reachDepth);
  if (ada.level === 'good') {
    reasons.push({
      level: 'good',
      text: `Reach-across depth (${reachDepth.toFixed(0)}")${borderNote} is within ADA forward reach over an obstruction.`,
    });
  } else if (ada.level === 'caution') {
    reasons.push({
      level: 'caution',
      text: `At ${reachDepth.toFixed(
        0,
      )}" deep${borderNote}, ADA 308.3.2 caps the high reach at ${ada.allowableHigh}" — keep controls toward the near edge.`,
    });
  } else {
    reasons.push({
      level: 'bad',
      text: `${reachDepth.toFixed(
        0,
      )}"${borderNote} is past the 25" ADA limit for reach over an obstruction — far-edge content is unreachable for seated users.`,
    });
  }

  // 3. Seated knee/toe clearance under the table -----------------------------
  const seated = tableSeatedClearance(cfg.tableHeight);
  if (seated.level === 'good') {
    reasons.push({
      level: 'good',
      text: `Surface at ${cfg.tableHeight.toFixed(0)}" suits a wheelchair pulling under (ADA 28–34" work surface).`,
    });
  } else if (seated.level === 'caution') {
    reasons.push({
      level: 'caution',
      text: `At ${cfg.tableHeight.toFixed(
        0,
      )}" the surface is above the ADA 34" work-surface height — standing-only; no seated pull-up.`,
    });
  } else {
    reasons.push({
      level: 'bad',
      text: `At ${cfg.tableHeight.toFixed(
        0,
      )}" there's no knee clearance to pull under — below the ADA 28" work-surface minimum.`,
    });
  }

  // 4. Look-down viewing + sharpness -----------------------------------------
  const eyeToCenter = Math.hypot(
    geom.center[2], // depth/2 from the near edge (eye sits over the edge)
    persona.eyeHeight - cfg.tableHeight,
  );
  const lookDownAngle =
    Math.atan2(persona.eyeHeight - cfg.tableHeight, geom.center[2]) * DEG;

  const pixels = pixelMetrics(cfg.size.width, eyeToCenter, {
    horizontalPixels: cfg.horizontalPixels,
    pitchMm: cfg.pitchMm,
  });
  if (pixels.pitchMm > 0) {
    const ppd = pixels.ppd === Infinity ? 9999 : Math.round(pixels.ppd);
    const t = strictness === 'strict' ? { sharp: 60, visible: 30 } : { sharp: 34, visible: 18 };
    if (ppd < t.visible) {
      reasons.push({
        level: 'bad',
        text: `Looking down from ~${eyeToCenter.toFixed(
          0,
        )}", individual pixels show (${ppd} px/°) — content looks coarse.`,
      });
    } else if (ppd < t.sharp) {
      reasons.push({
        level: 'caution',
        text: `Sharp enough looking down, slight softness up close (${ppd} px/°).`,
      });
    } else {
      reasons.push({
        level: 'good',
        text: `Crisp from the look-down distance (${ppd} px/°).`,
      });
    }
  }

  const usable = usableReachArea(cfg.size.width, depth, bezel, reach.depthMax, cfg.horizontalPixels);

  const level = reasons.reduce<VerdictLevel>(
    (worst, r) => (RANK[r.level] > RANK[worst] ? r.level : worst),
    'good',
  );

  return {
    level,
    reasons,
    depth,
    bezel,
    reach,
    ada,
    seated,
    usable,
    effectiveDistance: eyeToCenter,
    lookDownAngle,
    pixels,
    persona,
  };
}
