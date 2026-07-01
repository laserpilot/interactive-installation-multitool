// Pure typography-legibility engine. No React, no Three.js — just math.
// Lengths in INCHES unless a name says otherwise; angular sizes in ARCMINUTES
// (1/60°), the natural unit for visual acuity. This is the trust core of the
// Type & Legibility tool and is fully unit-tested in legibility.test.ts.
//
// The whole tool resolves one question a designer can't see from their laptop:
// how big does this type *actually look* to someone standing in front of the
// deployed screen? Three coordinate systems are in play —
//   1. authoring  — px on a Figma artboard at reading distance,
//   2. physical   — how big the glyph really is on the deployed panel,
//   3. perceptual — how much of the viewer's visual field it subtends.
// Only #3 governs readability, so everything funnels to arcminutes of cap height.

import { MM_PER_IN } from '../ergonomics/constants';
import { subtendedAngle, type VerdictLevel } from '../ergonomics/engine';

export const ARCMIN_PER_DEG = 60;
const DEG = 180 / Math.PI;

// Cap height as a fraction of nominal font size. Real fonts run ~0.66–0.74;
// 0.7 is a safe middle default (x-height sits nearer ~0.5). The acuity
// thresholds below are stated in cap height, so this ratio matters: skip it and
// every angular size reads ~30% optimistic.
export const DEFAULT_CAP_RATIO = 0.7;

// Legibility thresholds in ARCMIN of cap height, rooted in visual acuity:
// 20/20 resolves ~1 arcmin per stroke, so a ~5-arcmin cap is the absolute floor
// (eye-chart threshold — readable, barely). Comfortable sustained reading of
// body copy wants ~16+. Signage/glanceable text lives happily above ~20.
export const LEGIBILITY_ARCMIN = {
  threshold: 5, // below this: effectively unreadable
  legible: 10, // readable with effort / fine for a brief glance
  comfortable: 16, // comfortable for sustained reading
} as const;

export type LegibilityClass = 'illegible' | 'marginal' | 'legible' | 'comfortable';

// --- Angular conversions ----------------------------------------------------

/** Angular size (arcmin) subtended by a span of `sizeIn` viewed from `distanceIn`. */
export function subtendedArcmin(sizeIn: number, distanceIn: number): number {
  return subtendedAngle(sizeIn, distanceIn) * ARCMIN_PER_DEG;
}

/** Physical span (in) that subtends `arcmin` at `distanceIn` — the inverse of the above. */
export function sizeForArcmin(arcmin: number, distanceIn: number): number {
  const halfDeg = arcmin / ARCMIN_PER_DEG / 2;
  return 2 * distanceIn * Math.tan(halfDeg / DEG);
}

// --- Authoring → physical map ----------------------------------------------

/**
 * Physical height on the deployed screen of an element authored at `fontPx` on
 * an artboard `artboardPx` wide, when that artboard maps across a screen
 * `screenWidthIn` wide. Note the deployed *pixel* count cancels out entirely —
 * physical size is purely the proportional map from artboard to physical width.
 * (Deployed pixels only affect sharpness; see `devicePixels`.)
 */
export function physicalHeightIn(
  fontPx: number,
  artboardPx: number,
  screenWidthIn: number,
): number {
  return artboardPx > 0 ? (fontPx / artboardPx) * screenWidthIn : 0;
}

/** Deployed device pixels an element of `fontPx` gets on a `screenPx`-wide panel. */
export function devicePixels(fontPx: number, artboardPx: number, screenPx: number): number {
  return artboardPx > 0 ? fontPx * (screenPx / artboardPx) : 0;
}

// --- Classification ---------------------------------------------------------

export function classifyLegibility(capArcmin: number): LegibilityClass {
  if (capArcmin < LEGIBILITY_ARCMIN.threshold) return 'illegible';
  if (capArcmin < LEGIBILITY_ARCMIN.legible) return 'marginal';
  if (capArcmin < LEGIBILITY_ARCMIN.comfortable) return 'legible';
  return 'comfortable';
}

const CLASS_LEVEL: Record<LegibilityClass, VerdictLevel> = {
  illegible: 'bad',
  marginal: 'caution',
  legible: 'good',
  comfortable: 'good',
};

// A cap height rendered in fewer than this many device pixels is under-resolved:
// it aliases / turns to mush regardless of viewing distance. Independent of the
// acuity check — this is about the panel not having pixels to draw the glyph.
export const MIN_CLEAN_CAP_DEVICE_PX = 5;

// --- Inverse solve ----------------------------------------------------------

export interface MinFontContext {
  distanceIn: number;
  screenWidthIn: number;
  artboardPx: number;
  capRatio?: number;
}

/**
 * Minimum artboard font px so an element clears a target legibility class at the
 * given distance. Returns nominal font px (cap height ÷ cap ratio), i.e. the
 * number a designer types into their type tool.
 */
export function minFontPx(
  target: 'legible' | 'comfortable',
  ctx: MinFontContext,
): number {
  const { distanceIn, screenWidthIn, artboardPx, capRatio = DEFAULT_CAP_RATIO } = ctx;
  if (screenWidthIn <= 0 || capRatio <= 0) return 0;
  const capIn = sizeForArcmin(LEGIBILITY_ARCMIN[target], distanceIn);
  const emIn = capIn / capRatio;
  return (emIn / screenWidthIn) * artboardPx;
}

// --- Top-level report -------------------------------------------------------

export interface TypeSample {
  label: string; // "Body", "Headline", …
  fontPx: number; // artboard px (nominal font size)
}

export interface LegibilityConfig {
  samples: TypeSample[];
  artboardPx: number; // artboard width, px
  screenWidthIn: number; // deployed physical width
  screenPx: number; // deployed native horizontal pixels (sharpness only)
  distanceIn: number; // eye-to-glass
  capRatio?: number;
}

export interface SampleReport {
  label: string;
  fontPx: number;
  physicalHeightIn: number; // nominal em, physical
  physicalHeightMm: number;
  capHeightIn: number;
  capArcmin: number; // the number that decides legibility
  deviceCapPx: number; // device pixels the cap height gets on the panel
  underResolved: boolean; // too few device px to draw cleanly
  klass: LegibilityClass;
  level: VerdictLevel;
}

export interface LegibilityReport {
  samples: SampleReport[];
  level: VerdictLevel; // worst sample
  /** Min nominal font px for comfortable body copy at this distance/screen. */
  minComfortableFontPx: number;
  /** Min nominal font px to be legible at all at this distance/screen. */
  minLegibleFontPx: number;
}

const RANK: Record<VerdictLevel, number> = { good: 0, caution: 1, bad: 2 };

export function legibilityReport(cfg: LegibilityConfig): LegibilityReport {
  const capRatio = cfg.capRatio ?? DEFAULT_CAP_RATIO;
  const ctx: MinFontContext = {
    distanceIn: cfg.distanceIn,
    screenWidthIn: cfg.screenWidthIn,
    artboardPx: cfg.artboardPx,
    capRatio,
  };

  const samples: SampleReport[] = cfg.samples.map((s) => {
    const emIn = physicalHeightIn(s.fontPx, cfg.artboardPx, cfg.screenWidthIn);
    const capIn = emIn * capRatio;
    const capArcmin = subtendedArcmin(capIn, cfg.distanceIn);
    const deviceEmPx = devicePixels(s.fontPx, cfg.artboardPx, cfg.screenPx);
    const deviceCapPx = deviceEmPx * capRatio;
    const klass = classifyLegibility(capArcmin);
    return {
      label: s.label,
      fontPx: s.fontPx,
      physicalHeightIn: emIn,
      physicalHeightMm: emIn * MM_PER_IN,
      capHeightIn: capIn,
      capArcmin,
      deviceCapPx,
      underResolved: deviceCapPx > 0 && deviceCapPx < MIN_CLEAN_CAP_DEVICE_PX,
      klass,
      level: CLASS_LEVEL[klass],
    };
  });

  const level = samples.reduce<VerdictLevel>(
    (worst, s) => (RANK[s.level] > RANK[worst] ? s.level : worst),
    'good',
  );

  return {
    samples,
    level,
    minComfortableFontPx: minFontPx('comfortable', ctx),
    minLegibleFontPx: minFontPx('legible', ctx),
  };
}
