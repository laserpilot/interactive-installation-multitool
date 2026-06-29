// Pure ergonomics engine. No React, no Three.js — just math.
// Lengths in INCHES unless a name says otherwise. This module is the trust
// core of the tool and is fully unit-tested in engine.test.ts.

import {
  ADA_REACH_HIGH,
  ADA_REACH_LOW,
  ANGLE_THRESHOLDS,
  COMFORT_VIEW_ANGLE,
  IN_PER_M,
  MM_PER_IN,
  PPD_ACCEPTABLE,
  PPD_RETINA,
  PPD_THRESHOLDS,
  PERSONAS,
  REACH_THRESHOLDS,
  RETINA_PITCH_MULTIPLE,
  type Persona,
  type PersonaId,
  type Strictness,
} from './constants';
import { screenGeometry } from './screenGeometry';

export type Mode = 'touch' | 'view';

const DEG = 180 / Math.PI;

// --- Screen geometry --------------------------------------------------------

export interface ScreenSize {
  width: number; // in
  height: number; // in
  diagonal: number; // in
}

/** Width/height (and back the diagonal) from a diagonal + aspect ratio. */
export function sizeFromDiagonal(
  diagonal: number,
  aspectW: number,
  aspectH: number,
): ScreenSize {
  // Guard a zeroed/cleared aspect (hypot 0 → divide by zero → NaN/∞ size, which
  // downstream turns into runaway render loops).
  const denom = Math.hypot(aspectW, aspectH);
  const k = denom > 0 && Number.isFinite(denom) ? diagonal / denom : 0;
  return { width: aspectW * k, height: aspectH * k, diagonal };
}

// --- Visual angle -----------------------------------------------------------

export type AngleClass = 'ideal' | 'ok' | 'caution' | 'bad';

/** Angle (deg) subtended by a span of `size` viewed from `distance`. */
export function subtendedAngle(size: number, distance: number): number {
  if (distance <= 0) return 180;
  return 2 * Math.atan(size / (2 * distance)) * DEG;
}

/**
 * Classify how much of the view the screen fills, against the thresholds for the
 * use mode and strictness. Touch tolerates much wider angles than viewing.
 */
export function classifyAngle(
  deg: number,
  mode: Mode = 'view',
  strictness: Strictness = 'realistic',
): AngleClass {
  const t = ANGLE_THRESHOLDS[strictness][mode];
  if (deg <= t.ideal) return 'ideal';
  if (deg <= t.ok) return 'ok';
  if (deg <= t.caution) return 'caution';
  return 'bad';
}

/** Distance (in) at which a screen of `width` subtends COMFORT_VIEW_ANGLE. */
export function comfortableStandoff(width: number): number {
  return width / (2 * Math.tan((COMFORT_VIEW_ANGLE / 2) * (Math.PI / 180)));
}

// --- Reach / mounting -------------------------------------------------------

export interface ReachResult {
  /** Fraction (0–1) of screen height within [bandLow, bandHigh]. */
  reachableFraction: number;
  fullyReachable: boolean;
  topReachable: boolean;
  bottomReachable: boolean;
  screenBottom: number;
  screenTop: number;
}

/**
 * How much of the screen's vertical extent lies within a reach band.
 * `mountBottom` is the screen's bottom edge height AFF.
 */
export function reachBand(
  mountBottom: number,
  screenHeight: number,
  bandLow: number,
  bandHigh: number,
): ReachResult {
  const screenTop = mountBottom + screenHeight;
  const overlap = Math.max(
    0,
    Math.min(screenTop, bandHigh) - Math.max(mountBottom, bandLow),
  );
  return {
    reachableFraction: screenHeight > 0 ? overlap / screenHeight : 0,
    fullyReachable: mountBottom >= bandLow && screenTop <= bandHigh,
    topReachable: screenTop >= bandLow && screenTop <= bandHigh,
    bottomReachable: mountBottom >= bandLow && mountBottom <= bandHigh,
    screenBottom: mountBottom,
    screenTop,
  };
}

/**
 * Recommended bottom-edge height.
 *  - touch: fit interactive content in the ADA 15–48" band (center a short
 *    screen in the band; drop a tall screen's bottom to the band floor so the
 *    reachable controls live low).
 *  - view: center the screen on the viewer's eye line.
 */
export function recommendMountBottom(
  screenHeight: number,
  mode: Mode = 'touch',
  eyeHeight = 64,
): number {
  if (mode === 'view') {
    return Math.max(6, eyeHeight - screenHeight / 2);
  }
  const bandSize = ADA_REACH_HIGH - ADA_REACH_LOW;
  if (screenHeight <= bandSize) {
    return (ADA_REACH_LOW + ADA_REACH_HIGH) / 2 - screenHeight / 2;
  }
  return ADA_REACH_LOW;
}

// --- Pixels / resolution ----------------------------------------------------

export interface PixelMetrics {
  pitchMm: number;
  horizontalPixels: number;
  /** Pixels per degree at the given distance. */
  ppd: number;
  retina: boolean;
  acceptable: boolean;
  /** Distance (m) where pixels become invisible (1 arcmin). */
  retinaDistanceM: number;
  /** Rule-of-thumb min "clean" viewing distance (m): pitch_mm × 1. */
  minCleanDistanceM: number;
}

/**
 * Resolve pixel pitch / density. Provide EITHER horizontalPixels OR pitchMm
 * (whichever the user knows); the other is derived from the physical width.
 */
export function pixelMetrics(
  physicalWidthIn: number,
  distanceIn: number,
  input: { horizontalPixels?: number; pitchMm?: number },
): PixelMetrics {
  const widthMm = physicalWidthIn * MM_PER_IN;
  let { horizontalPixels, pitchMm } = input;

  if (pitchMm == null && horizontalPixels != null) {
    pitchMm = horizontalPixels > 0 ? widthMm / horizontalPixels : 0;
  } else if (horizontalPixels == null && pitchMm != null) {
    horizontalPixels = pitchMm > 0 ? widthMm / pitchMm : 0;
  }
  pitchMm = pitchMm ?? 0;
  horizontalPixels = horizontalPixels ?? 0;

  const degPerPixel = subtendedAngle(pitchMm / MM_PER_IN, distanceIn);
  const ppd = degPerPixel > 0 ? 1 / degPerPixel : Infinity;
  const retinaDistanceMm = pitchMm * RETINA_PITCH_MULTIPLE;

  return {
    pitchMm,
    horizontalPixels,
    ppd,
    retina: ppd >= PPD_RETINA,
    acceptable: ppd >= PPD_ACCEPTABLE,
    retinaDistanceM: retinaDistanceMm / 1000,
    minCleanDistanceM: pitchMm, // ×1 rule of thumb, already in "mm == m"
  };
}

// --- Top-level verdict ------------------------------------------------------

export type VerdictLevel = 'good' | 'caution' | 'bad';

export interface ScreenConfig {
  size: ScreenSize;
  mountBottom: number; // in AFF
  /** Back-tilt of the screen in degrees; 0 = vertical (default). */
  tiltDeg?: number;
  mode: Mode;
  /** Used in 'view' mode; in 'touch' mode distance is derived from persona. */
  viewingDistance: number; // in
  personaId: PersonaId;
  horizontalPixels?: number;
  pitchMm?: number;
  /** Judgment calibration; defaults to 'realistic'. */
  strictness?: Strictness;
}

export interface VerdictReason {
  level: VerdictLevel;
  text: string;
}

export interface Verdict {
  level: VerdictLevel;
  reasons: VerdictReason[];
  effectiveDistance: number; // in
  horizontalAngle: number; // deg
  verticalAngle: number; // deg
  angleClass: AngleClass;
  adaReach: ReachResult;
  personaReach: ReachResult;
  recommendedMountBottom: number; // in
  /** Distance (in) to stand back for a comfortable whole-screen view. */
  comfortableStandoff: number;
  pixels: PixelMetrics;
  persona: Persona;
}

const RANK: Record<VerdictLevel, number> = { good: 0, caution: 1, bad: 2 };

/**
 * Effective viewing distance for angle/pixel judgments. We take the configured
 * standing distance and scale it by how the eye→screen-center distance changes
 * with tilt. At tilt 0 the ratio is 1, so the value is exactly the standing
 * distance (existing behaviour unchanged); a tilt that brings the screen center
 * nearer the eye shortens it, and vice-versa. Robust — never degenerates.
 */
export function effectiveDistance(cfg: ScreenConfig, persona: Persona): number {
  const standing = cfg.mode === 'touch' ? persona.touchDistance : cfg.viewingDistance;
  const dim = { mountBottom: cfg.mountBottom, height: cfg.size.height };
  const g0 = screenGeometry({ ...dim, tiltDeg: 0 });
  const gt = screenGeometry({ ...dim, tiltDeg: cfg.tiltDeg });
  // The viewer stands `standing` in front of the screen, which is itself pushed
  // forward off the wall by frontOffset — so the eye z includes both.
  const eye0 = [0, persona.eyeHeight, standing] as const;
  const eyeT = [0, persona.eyeHeight, standing + gt.frontOffset] as const;
  const dist = (e: readonly number[], p: readonly number[]) =>
    Math.hypot(e[0] - p[0], e[1] - p[1], e[2] - p[2]);
  const d0 = dist(eye0, g0.center);
  return d0 > 0 ? standing * (dist(eyeT, gt.center) / d0) : standing;
}

export function verdict(cfg: ScreenConfig): Verdict {
  const persona = PERSONAS[cfg.personaId];
  const strictness = cfg.strictness ?? 'realistic';
  const distance = effectiveDistance(cfg, persona);
  const reasons: VerdictReason[] = [];

  // 1. How much of your view the screen fills --------------------------------
  const hAngle = subtendedAngle(cfg.size.width, distance);
  const vAngle = subtendedAngle(cfg.size.height, distance);
  const angleClass = classifyAngle(hAngle, cfg.mode, strictness);
  const fills = `fills ${hAngle.toFixed(0)}° of your view`;
  if (cfg.mode === 'touch') {
    // Touch tolerates wide angles — you interact with one region at a time.
    if (angleClass === 'ideal' || angleClass === 'ok') {
      reasons.push({
        level: 'good',
        text: `At arm's length the screen ${fills} — comfortable for a touch interface.`,
      });
    } else if (angleClass === 'caution') {
      reasons.push({
        level: 'caution',
        text: `At arm's length the screen ${fills} — usable for touch, but large; reaching one corner puts the other well into the corner of your eye.`,
      });
    } else {
      reasons.push({
        level: 'bad',
        text: `At arm's length the screen ${fills} — too big to touch comfortably; you can't see the part you're reaching for.`,
      });
    }
  } else {
    if (angleClass === 'ideal') {
      reasons.push({ level: 'good', text: `The screen ${fills} — comfortably taken in at a glance.` });
    } else if (angleClass === 'ok') {
      reasons.push({ level: 'good', text: `The screen ${fills} — fine for viewing, near the upper edge of comfort.` });
    } else if (angleClass === 'caution') {
      reasons.push({ level: 'caution', text: `The screen ${fills} — you have to turn your head to see the edges.` });
    } else {
      reasons.push({ level: 'bad', text: `The screen ${fills} at this distance — too wide to take in without constant head movement.` });
    }
  }

  // Standoff guidance: how far back to take the whole screen in at once.
  const standoff = comfortableStandoff(cfg.size.width);
  if (cfg.mode === 'touch' && angleClass !== 'ideal' && angleClass !== 'ok') {
    reasons.push({
      level: 'good',
      text: `To take in the whole screen at once, stand back ~${(standoff / 12).toFixed(1)} ft.`,
    });
  }

  // 2. Reach (ADA band is the compliance gate) -------------------------------
  const adaReach = reachBand(
    cfg.mountBottom,
    cfg.size.height,
    ADA_REACH_LOW,
    ADA_REACH_HIGH,
  );
  const personaReach = reachBand(
    cfg.mountBottom,
    cfg.size.height,
    persona.reachLow,
    persona.reachHigh,
  );
  const recommendedMountBottom = recommendMountBottom(
    cfg.size.height,
    cfg.mode,
    persona.eyeHeight,
  );

  if (cfg.mode === 'touch') {
    const reachThresh = REACH_THRESHOLDS[strictness];
    if (adaReach.reachableFraction >= reachThresh.good) {
      reasons.push({
        level: 'good',
        text: `The reachable part of the screen sits within the 15–48" ADA range.`,
      });
    } else {
      const pctOut = Math.round((1 - adaReach.reachableFraction) * 100);
      reasons.push({
        level: gradeReach(adaReach.reachableFraction, strictness),
        text: `${pctOut}% of the screen is above/below the 15–48" ADA reach range — keep touch targets out of that zone.`,
      });
    }
    if (personaReach.reachableFraction < reachThresh.good) {
      const pctOut = Math.round((1 - personaReach.reachableFraction) * 100);
      reasons.push({
        level: gradeReach(personaReach.reachableFraction, strictness),
        text: `${persona.label} can't physically reach ${pctOut}% of the screen.`,
      });
    }
  }

  // 3. Sharpness / resolution ------------------------------------------------
  const pixels = pixelMetrics(cfg.size.width, distance, {
    horizontalPixels: cfg.horizontalPixels,
    pitchMm: cfg.pitchMm,
  });
  if (pixels.pitchMm > 0) {
    const ppdThresh = PPD_THRESHOLDS[strictness];
    const ppd = pixels.ppd === Infinity ? 9999 : Math.round(pixels.ppd);
    if (ppd < ppdThresh.visible) {
      reasons.push({
        level: 'bad',
        text: `Individual pixels are visible at this distance (${ppd} px/°) — content looks coarse.`,
      });
    } else if (ppd < ppdThresh.sharp) {
      reasons.push({
        level: 'caution',
        text: `Sharp enough, though a keen eye up close may catch slight softness (${ppd} px/°).`,
      });
    } else {
      reasons.push({
        level: 'good',
        text: `Looks crisp at this distance — pixels aren't noticeable (${ppd} px/°).`,
      });
    }
    // LED-wall framing when a coarse pitch is involved.
    if (pixels.pitchMm >= 1.2) {
      reasons.push({
        level: distance / IN_PER_M < pixels.minCleanDistanceM ? 'bad' : 'good',
        text: `P${pixels.pitchMm.toFixed(1)} wall: needs ~${pixels.minCleanDistanceM.toFixed(
          1,
        )} m to look clean (${pixels.retinaDistanceM.toFixed(
          1,
        )} m to be pixel-perfect); viewer is at ${(distance / IN_PER_M).toFixed(1)} m.`,
      });
    }
  }

  // Overall = worst reason.
  const level = reasons.reduce<VerdictLevel>(
    (worst, r) => (RANK[r.level] > RANK[worst] ? r.level : worst),
    'good',
  );

  return {
    level,
    reasons,
    effectiveDistance: distance,
    horizontalAngle: hAngle,
    verticalAngle: vAngle,
    angleClass,
    adaReach,
    personaReach,
    recommendedMountBottom,
    comfortableStandoff: standoff,
    pixels,
    persona,
  };
}

/** Grade a reachable fraction against the strictness thresholds. */
function gradeReach(fraction: number, strictness: Strictness): VerdictLevel {
  const t = REACH_THRESHOLDS[strictness];
  if (fraction >= t.good) return 'good';
  if (fraction >= t.caution) return 'caution';
  return 'bad';
}
