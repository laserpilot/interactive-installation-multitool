// A coarse skeleton of body keypoints for a persona, standing (or seated) at a
// floor position (x, z). Used both to score tracking coverage per body part and
// to draw the colour-coded avatar. Heights come straight from PERSONAS and the
// same fractions Avatar.tsx uses (hip ≈ 0.52 × stature), so the sensor avatar
// lines up with the placement-tab one. World units: FEET.

import type { Persona } from '../ergonomics/constants';
import { f } from '../scene/scale';
import type { Vec3 } from './sensorMath';

export interface Keypoint {
  name: string;
  /** World position, feet. */
  point: Vec3;
  /** Capsule radius for the avatar, feet. */
  radius: number;
  /** Must this part be tracked to call the body "covered"? */
  core: boolean;
}

/**
 * Keypoints down the body at floor cell (x, z). Core = hips/chest/shoulders/head
 * (the parts a tracker must see); feet/knees are optional (often occluded and not
 * required for body tracking).
 */
export function bodyKeypoints(persona: Persona, x: number, z: number): Keypoint[] {
  const at = (yIn: number): Vec3 => [x, f(yIn), z];

  if (persona.seated) {
    const hip = 19;
    const chest = (hip + persona.shoulderHeight) / 2;
    return [
      { name: 'feet', point: at(5), radius: f(2.4), core: false },
      { name: 'knees', point: at(17), radius: f(2.4), core: false },
      { name: 'hips', point: at(hip), radius: f(4), core: true },
      { name: 'chest', point: at(chest), radius: f(4.5), core: true },
      { name: 'shoulders', point: at(persona.shoulderHeight), radius: f(4.5), core: true },
      { name: 'head', point: at(persona.eyeHeight + 3.2), radius: f(4.2), core: true },
    ];
  }

  const stature = persona.statureHeight;
  const hip = 0.52 * stature;
  const chest = (hip + persona.shoulderHeight) / 2;
  return [
    { name: 'feet', point: at(2), radius: f(2.6), core: false },
    { name: 'knees', point: at(0.28 * stature), radius: f(2.6), core: false },
    { name: 'hips', point: at(hip), radius: f(4.5), core: true },
    { name: 'chest', point: at(chest), radius: f(5), core: true },
    { name: 'shoulders', point: at(persona.shoulderHeight), radius: f(5), core: true },
    { name: 'head', point: at(persona.eyeHeight + 3.2), radius: f(4.2), core: true },
  ];
}
