// Pure ergonomics engine. No React, no Three.js — just math.
// Lengths in INCHES unless a name says otherwise. This module is the trust
// core of the tool and is fully unit-tested in engine.test.ts.

import {
  ADA_REACH_HIGH,
  ADA_REACH_LOW,
  ANGLE_CAUTION,
  ANGLE_IDEAL,
  ANGLE_OK,
  IN_PER_M,
  MM_PER_IN,
  PPD_ACCEPTABLE,
  PPD_RETINA,
  PERSONAS,
  RETINA_PITCH_MULTIPLE,
  type Persona,
  type PersonaId,
} from './constants';

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
  const k = diagonal / Math.hypot(aspectW, aspectH);
  return { width: aspectW * k, height: aspectH * k, diagonal };
}

// --- Visual angle -----------------------------------------------------------

export type AngleClass = 'ideal' | 'ok' | 'caution' | 'bad';

/** Angle (deg) subtended by a span of `size` viewed from `distance`. */
export function subtendedAngle(size: number, distance: number): number {
  if (distance <= 0) return 180;
  return 2 * Math.atan(size / (2 * distance)) * DEG;
}

export function classifyAngle(deg: number): AngleClass {
  if (deg <= ANGLE_IDEAL) return 'ideal';
  if (deg <= ANGLE_OK) return 'ok';
  if (deg <= ANGLE_CAUTION) return 'caution';
  return 'bad';
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
 * Recommended bottom-edge height so interactive content sits in the ADA band.
 * If the screen is shorter than the band, center it in the band; otherwise
 * drop the bottom to the band floor so the reachable controls live low.
 */
export function recommendMountBottom(
  screenHeight: number,
  bandLow = ADA_REACH_LOW,
  bandHigh = ADA_REACH_HIGH,
): number {
  const bandSize = bandHigh - bandLow;
  if (screenHeight <= bandSize) {
    const center = (bandLow + bandHigh) / 2;
    return center - screenHeight / 2;
  }
  return bandLow;
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
  mode: 'touch' | 'view';
  /** Used in 'view' mode; in 'touch' mode distance is derived from persona. */
  viewingDistance: number; // in
  personaId: PersonaId;
  horizontalPixels?: number;
  pitchMm?: number;
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
  pixels: PixelMetrics;
  persona: Persona;
}

const RANK: Record<VerdictLevel, number> = { good: 0, caution: 1, bad: 2 };

/** Effective eye-to-glass distance for the chosen mode. */
export function effectiveDistance(cfg: ScreenConfig, persona: Persona): number {
  return cfg.mode === 'touch' ? persona.touchDistance : cfg.viewingDistance;
}

export function verdict(cfg: ScreenConfig): Verdict {
  const persona = PERSONAS[cfg.personaId];
  const distance = effectiveDistance(cfg, persona);
  const reasons: VerdictReason[] = [];

  // 1. Visual angle ----------------------------------------------------------
  const hAngle = subtendedAngle(cfg.size.width, distance);
  const vAngle = subtendedAngle(cfg.size.height, distance);
  const angleClass = classifyAngle(hAngle);
  if (angleClass === 'ideal') {
    reasons.push({
      level: 'good',
      text: `Screen subtends ${hAngle.toFixed(0)}° — comfortably taken in at a glance.`,
    });
  } else if (angleClass === 'ok') {
    reasons.push({
      level: 'good',
      text: `Screen subtends ${hAngle.toFixed(0)}° — fine for reading, near the upper edge of comfort.`,
    });
  } else if (angleClass === 'caution') {
    reasons.push({
      level: 'caution',
      text: `Screen subtends ${hAngle.toFixed(0)}° — you must scan your head to see the edges.`,
    });
  } else {
    reasons.push({
      level: 'bad',
      text: `Screen subtends ${hAngle.toFixed(0)}° at this distance — too large to see without constant head movement.`,
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
  const recommendedMountBottom = recommendMountBottom(cfg.size.height);

  if (cfg.mode === 'touch') {
    const pctReachable = Math.round(adaReach.reachableFraction * 100);
    if (adaReach.reachableFraction >= 0.999) {
      reasons.push({
        level: 'good',
        text: `Entire screen falls within the 15–48" ADA reach band.`,
      });
    } else {
      const pctOut = 100 - pctReachable;
      reasons.push({
        level: adaReach.reachableFraction >= 0.5 ? 'caution' : 'bad',
        text: `${pctOut}% of the screen is outside the 15–48" ADA reach band — those touch targets can't be reached by all users.`,
      });
    }
    if (personaReach.reachableFraction < 0.999) {
      const pctOut = Math.round((1 - personaReach.reachableFraction) * 100);
      reasons.push({
        level: personaReach.reachableFraction >= 0.5 ? 'caution' : 'bad',
        text: `${persona.label} physically can't reach ${pctOut}% of the screen.`,
      });
    }
  }

  // 3. Pixels / resolution ---------------------------------------------------
  const pixels = pixelMetrics(cfg.size.width, distance, {
    horizontalPixels: cfg.horizontalPixels,
    pitchMm: cfg.pitchMm,
  });
  if (pixels.pitchMm > 0) {
    if (!pixels.acceptable) {
      reasons.push({
        level: 'bad',
        text: `At ${(distance / 12).toFixed(1)} ft you resolve only ${pixels.ppd.toFixed(
          0,
        )} px/° — well below the 60 px/° "retina" mark; pixels/structure are clearly visible.`,
      });
    } else if (!pixels.retina) {
      reasons.push({
        level: 'caution',
        text: `${pixels.ppd.toFixed(0)} px/° at this distance — acceptable but not pixel-sharp (60 px/° is retina).`,
      });
    } else {
      reasons.push({
        level: 'good',
        text: `${pixels.ppd.toFixed(0)} px/° — pixels are invisible at this distance.`,
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
    pixels,
    persona,
  };
}
