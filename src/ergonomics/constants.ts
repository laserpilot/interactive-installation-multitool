// Anthropometric + accessibility constants.
// All lengths are in INCHES (US-first). Convert at the UI boundary for metric.
// These are sensible defaults, not gospel — they are centralized here so they
// are easy to audit and adjust.

export const IN_PER_M = 39.3701;
export const MM_PER_IN = 25.4;

// --- ADA / ICC A117.1 §308 operable-parts reach band -----------------------
// Interactive controls must sit within this window off the finished floor.
export const ADA_REACH_LOW = 15; // in
export const ADA_REACH_HIGH = 48; // in

// Judgment strictness. 'realistic' (default) matches what works in real
// installs; 'strict' holds to spec-ideal comfort. The user toggles this.
export type Strictness = 'realistic' | 'strict';

// --- Visual angle thresholds (how much of your view the screen fills, deg) ---
// Two regimes, genuinely different tasks:
//  - VIEW: you take in the whole image from a distance (signage, video). Comfort
//    wants the screen inside a fairly narrow cone.
//  - TOUCH: you stand at arm's length and work one region at a time, scanning
//    locally — wide angles are normal here; only a huge screen up close is bad.
// 'realistic' reflects field practice (e.g. a 55" touchscreen at arm's length —
// the mall-kiosk standard — is fine); 'strict' is conservative.
export const ANGLE_THRESHOLDS = {
  realistic: {
    view: { ideal: 35, ok: 45, caution: 62 },
    touch: { ideal: 70, ok: 100, caution: 120 },
  },
  strict: {
    view: { ideal: 30, ok: 40, caution: 55 },
    touch: { ideal: 55, ok: 85, caution: 105 },
  },
} as const;

// Pixels-per-degree the eye resolves. 60 ≈ "retina". A screen reads as crisp
// well below that, especially up close — so 'realistic' only flags real softness.
export const PPD_THRESHOLDS = {
  realistic: { sharp: 34, visible: 18 },
  strict: { sharp: 60, visible: 30 },
} as const;

// Reachable fraction of the screen height. 'realistic' assumes interactive
// content lives in the reachable zone, so partial overhang is a caution not a
// failure; 'strict' wants the whole panel reachable.
export const REACH_THRESHOLDS = {
  realistic: { good: 0.85, caution: 0.55 },
  strict: { good: 0.95, caution: 0.7 },
} as const;

// Target angle (deg) used to recommend how far to stand back to take the whole
// screen in at once.
export const COMFORT_VIEW_ANGLE = 40;

// --- Visual acuity ----------------------------------------------------------
// The eye resolves ~1 arcminute => 60 pixels per degree is "retina".
export const PPD_RETINA = 60;
export const PPD_ACCEPTABLE = 30;
// Distance (in pixel-pitch multiples) at which a pixel subtends 1 arcminute.
// D_retina = pitch / tan(1/60 deg) ≈ pitch * 3437.75  (same length units).
export const RETINA_PITCH_MULTIPLE = 1 / Math.tan((1 / 60) * (Math.PI / 180));

export type PersonaId = 'adult' | 'child' | 'wheelchair';

export interface Persona {
  id: PersonaId;
  label: string;
  /** Standing/seated eye height off the floor, inches. */
  eyeHeight: number;
  /** Highest point this body can comfortably touch, inches AFF. */
  reachHigh: number;
  /** Lowest comfortable touch, inches AFF. */
  reachLow: number;
  /** Eye-to-glass distance when comfortably reaching to touch, inches. */
  touchDistance: number;
  /** Overall standing/seated height, inches (for the avatar). */
  statureHeight: number;
  /** Shoulder height, inches AFF (pivot for the reach arm). */
  shoulderHeight: number;
  seated: boolean;
}

// 50th-percentile-ish values. Adult ~5'9", child ~7yr, wheelchair seated user.
export const PERSONAS: Record<PersonaId, Persona> = {
  adult: {
    id: 'adult',
    label: 'Adult (50th %ile)',
    eyeHeight: 64,
    reachHigh: 78,
    reachLow: 12,
    touchDistance: 25,
    statureHeight: 69,
    shoulderHeight: 56,
    seated: false,
  },
  child: {
    id: 'child',
    label: 'Child (~7 yr)',
    eyeHeight: 43,
    reachHigh: 52,
    reachLow: 8,
    touchDistance: 18,
    statureHeight: 47,
    shoulderHeight: 37,
    seated: false,
  },
  wheelchair: {
    id: 'wheelchair',
    label: 'Seated user',
    eyeHeight: 47,
    reachHigh: 48, // ADA unobstructed forward/side reach cap
    reachLow: 15,
    touchDistance: 20,
    statureHeight: 51, // seated head height
    shoulderHeight: 41,
    seated: true,
  },
};
