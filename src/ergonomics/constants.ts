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

// --- Visual angle thresholds (horizontal subtended angle of the screen) -----
// Below "ideal" you can take the whole screen in at a glance; above "bad" you
// physically cannot see the edges without scanning your head.
export const ANGLE_IDEAL = 30; // deg
export const ANGLE_OK = 40; // deg
export const ANGLE_CAUTION = 50; // deg

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
    label: 'Wheelchair user (seated)',
    eyeHeight: 47,
    reachHigh: 48, // ADA unobstructed forward/side reach cap
    reachLow: 15,
    touchDistance: 22,
    statureHeight: 51, // seated head height
    shoulderHeight: 41,
    seated: true,
  },
};
