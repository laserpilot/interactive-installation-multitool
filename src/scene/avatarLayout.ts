import type { Persona } from '../ergonomics/constants';
import { screenGeometry } from '../ergonomics/screenGeometry';
import { f } from './scale';

export interface AvatarLayout {
  /** Avatar standing position along +z (feet). */
  z: number;
  /** Eye world position [x,y,z]. */
  eye: [number, number, number];
  /** Reaching shoulder world position. */
  shoulder: [number, number, number];
  /** Where the reaching hand lands (on or short of the wall). */
  hand: [number, number, number];
  /** True if the hand actually reached the wall (touch). */
  touches: boolean;
  /** Arm length in world units (feet) — max reach radius from the shoulder. */
  armLen: number;
}

/**
 * Resolve avatar key points in world space (feet). Wall is at z=0; the avatar
 * faces -z. `distanceIn` is eye-to-glass distance in inches.
 */
export function avatarLayout(
  persona: Persona,
  distanceIn: number,
  screenBottomIn: number,
  screenTopIn: number,
  tiltDeg = 0,
): AvatarLayout {
  // The screen is pushed forward off the wall by frontOffset when tilted; the
  // viewer stands `distanceIn` in front of it, so push the avatar forward too.
  const geom = screenGeometry({
    mountBottom: screenBottomIn,
    height: screenTopIn - screenBottomIn,
    tiltDeg,
  });
  const z = f(distanceIn + geom.frontOffset);
  const eye: [number, number, number] = [0, f(persona.eyeHeight), z];
  const shoulder: [number, number, number] = [f(7), f(persona.shoulderHeight), z];

  // Pick a touch target height: center of the screen∩reach overlap, else max reach.
  const lo = Math.max(screenBottomIn, persona.reachLow);
  const hi = Math.min(screenTopIn, persona.reachHigh);
  const targetY = lo <= hi ? (lo + hi) / 2 : persona.reachHigh;
  // Place it on the (possibly tilted) screen plane.
  const tp = geom.pointAtHeight(targetY);
  const target: [number, number, number] = [f(tp[0]), f(tp[1]), f(tp[2])];

  // Arm reaches toward the target, capped at arm length.
  const armLen = f(0.42 * persona.statureHeight);
  const dx = target[0] - shoulder[0];
  const dy = target[1] - shoulder[1];
  const dz = target[2] - shoulder[2];
  const len = Math.hypot(dx, dy, dz);
  const t = len > 0 ? Math.min(1, armLen / len) : 0;
  const hand: [number, number, number] = [
    shoulder[0] + dx * t,
    shoulder[1] + dy * t,
    shoulder[2] + dz * t,
  ];
  return { z, eye, shoulder, hand, touches: len <= armLen + 1e-6, armLen };
}
