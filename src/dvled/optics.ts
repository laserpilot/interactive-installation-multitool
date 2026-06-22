// Pure optics for the dvLED viewing-distance preview. No React, no WebGL —
// just the geometry that the shader and the readout both consume.
// Lengths in INCHES unless a name says otherwise. Mirrors the conventions in
// ergonomics/engine.ts so the two tabs agree on px/° and the LED-wall rules.

import {
  IN_PER_M,
  MM_PER_IN,
  PPD_ACCEPTABLE,
  PPD_RETINA,
  RETINA_PITCH_MULTIPLE,
} from '../ergonomics/constants';

const DEG = 180 / Math.PI;

/** How the wall reads to the eye at the chosen distance. */
export type Perceived = 'pixelated' | 'soft' | 'clean' | 'retina';

export interface DvLedMetrics {
  pitchMm: number;
  /** Native LED count across the whole wall. */
  nativeCols: number;
  nativeRows: number;
  /** Angle (deg) a single LED cell subtends at the distance. */
  cellAngleDeg: number;
  /** Pixels (LED cells) per degree at the distance. */
  ppd: number;
  perceived: Perceived;
  /** Rule-of-thumb min "clean" distance (m): pitch_mm × 1. */
  minCleanDistanceM: number;
  /** Distance (m) where a cell subtends 1 arcmin — pixels vanish. */
  retinaDistanceM: number;

  // --- the slice of wall inside the viewer's field of view ---
  /** Physical width/height of wall visible across the FOV (in). */
  viewSpanWidthIn: number;
  viewSpanHeightIn: number;
  /** LED cells across the visible slice (may exceed nativeCols). */
  cellsAcrossView: number;
  /**
   * Wall width ÷ visible span. ≥1 ⇒ zoomed into the wall (a sub-window fills
   * the frame); <1 ⇒ the whole wall sits inside the frame with surround.
   */
  wallFillFraction: number;
  fillsFrame: boolean;
}

/**
 * Resolve everything the preview needs from physical wall size, pitch, the
 * viewer's distance, and the horizontal field of view being simulated.
 */
export function dvledMetrics(
  widthIn: number,
  heightIn: number,
  pitchMm: number,
  distanceIn: number,
  fovDeg: number,
): DvLedMetrics {
  const widthMm = widthIn * MM_PER_IN;
  const heightMm = heightIn * MM_PER_IN;
  const pitchIn = pitchMm / MM_PER_IN;

  const nativeCols = pitchMm > 0 ? widthMm / pitchMm : 0;
  const nativeRows = pitchMm > 0 ? heightMm / pitchMm : 0;

  const cellAngleDeg =
    distanceIn > 0 ? 2 * Math.atan(pitchIn / (2 * distanceIn)) * DEG : 180;
  const ppd = cellAngleDeg > 0 ? 1 / cellAngleDeg : Infinity;

  const viewSpanWidthIn =
    distanceIn > 0 ? 2 * distanceIn * Math.tan(fovDeg / 2 / DEG) : widthIn;
  const aspect = widthIn > 0 ? heightIn / widthIn : 1;
  const viewSpanHeightIn = viewSpanWidthIn * aspect;
  const cellsAcrossView = pitchIn > 0 ? viewSpanWidthIn / pitchIn : 0;
  const wallFillFraction =
    viewSpanWidthIn > 0 ? widthIn / viewSpanWidthIn : Infinity;

  let perceived: Perceived;
  if (ppd >= PPD_RETINA) perceived = 'retina';
  else if (ppd >= PPD_ACCEPTABLE) perceived = 'clean';
  else if (ppd >= PPD_ACCEPTABLE / 2) perceived = 'soft';
  else perceived = 'pixelated';

  return {
    pitchMm,
    nativeCols,
    nativeRows,
    cellAngleDeg,
    ppd,
    perceived,
    minCleanDistanceM: pitchMm, // pitch_mm metres (P2.5 ⇒ ~2.5 m), per the ×1 rule
    retinaDistanceM: (pitchMm * RETINA_PITCH_MULTIPLE) / 1000,
    viewSpanWidthIn,
    viewSpanHeightIn,
    cellsAcrossView,
    wallFillFraction,
    fillsFrame: wallFillFraction >= 1,
  };
}

/** Distance (in) in metres, for readouts. */
export function inToM(inches: number): number {
  return inches / IN_PER_M;
}
