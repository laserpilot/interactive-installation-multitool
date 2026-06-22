// Single source of truth for the screen's position and orientation in space.
// All values are in INCHES, world axes: +x right, +y up (AFF), +z toward the
// viewer (wall at z=0). A tilt models a look-down kiosk/podium: the screen tilts
// BACK (top recedes toward the wall) and the whole panel is pushed FORWARD off
// the wall by `frontOffset` so the back-tilted top lands at the wall (z=0) and
// the bottom edge sits out in front — nothing clips into the wall. The viewer is
// pushed forward by the same offset (see avatarLayout / engine). Every consumer
// (engine, 3D scene, 2D elevation) uses this so the geometry is defined once.
//
// At tiltDeg = 0 frontOffset is 0 and everything reduces to the original
// vertical-wall values, keeping existing behaviour (and tests) unchanged.

export type Point3 = [number, number, number];

export interface ScreenGeometry {
  tiltRad: number;
  /** Bottom-edge midpoint (the tilt pivot). */
  pivot: Point3;
  /** Unit vector up the face of the (tilted) screen. */
  upDir: Point3;
  /** Screen center in world space. */
  center: Point3;
  /** Top-edge midpoint in world space. */
  top: Point3;
  /** Outward face normal (toward the viewer). */
  normal: Point3;
  /** The point on the screen plane at a given AFF height (inches). */
  pointAtHeight: (yIn: number) => Point3;
  /** Perpendicular distance from an eye point to the screen plane. */
  perpDistanceFromEye: (eye: Point3) => number;
  /** How far the panel is pushed forward off the wall (z of the bottom edge). */
  frontOffset: number;
}

export function screenGeometry(params: {
  mountBottom: number;
  height: number;
  tiltDeg?: number;
}): ScreenGeometry {
  const { mountBottom, height } = params;
  const tiltRad = ((params.tiltDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(tiltRad);
  const sin = Math.sin(tiltRad);

  // Forward offset so the back-tilted top edge lands at the wall (z=0).
  const frontOffset = height * sin;
  const pivot: Point3 = [0, mountBottom, frontOffset]; // bottom edge, out front
  const upDir: Point3 = [0, cos, -sin]; // up the face, receding toward the wall
  const center: Point3 = [0, mountBottom + (height / 2) * cos, frontOffset - (height / 2) * sin];
  const top: Point3 = [0, mountBottom + height * cos, 0];
  const normal: Point3 = [0, sin, cos]; // outward face: toward viewer and up

  return {
    tiltRad,
    frontOffset,
    pivot,
    upDir,
    center,
    top,
    normal,
    // On the plane: y = mountBottom + s·cos ⇒ z = frontOffset − (yIn−mountBottom)·tan.
    pointAtHeight: (yIn) => [0, yIn, frontOffset - (yIn - mountBottom) * (sin / (cos || 1e-9))],
    // |(eye − pivot) · n|, n unit.
    perpDistanceFromEye: (eye) =>
      Math.abs((eye[1] - mountBottom) * sin + (eye[2] - frontOffset) * cos),
  };
}
