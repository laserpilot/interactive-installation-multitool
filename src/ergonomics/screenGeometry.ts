// Single source of truth for the screen's position and orientation in space.
// All values are in INCHES, world axes: +x right, +y up (AFF), +z toward the
// viewer (wall at z=0). The screen tilts about its bottom edge so its top leans
// TOWARD the viewer (+z) and rises — a podium/lectern touchscreen angled up
// toward the user. This keeps it in front of the wall and reads cleanly in both
// 3D and the 2D side elevation. Every consumer (engine, 3D scene, 2D elevation)
// uses this so the geometry is defined once.
//
// At tiltDeg = 0 everything reduces to the original vertical-wall values, which
// is what keeps the existing behaviour (and tests) byte-for-byte unchanged.

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

  const pivot: Point3 = [0, mountBottom, 0];
  const upDir: Point3 = [0, cos, sin]; // up the face, leaning toward the viewer
  const center: Point3 = [0, mountBottom + (height / 2) * cos, (height / 2) * sin];
  const top: Point3 = [0, mountBottom + height * cos, height * sin];
  const normal: Point3 = [0, -sin || 0, cos]; // outward face toward the viewer (avoid -0)

  return {
    tiltRad,
    pivot,
    upDir,
    center,
    top,
    normal,
    // World Y = mountBottom + s·cos along upDir ⇒ z = (yIn − mountBottom)·tan.
    pointAtHeight: (yIn) => [0, yIn, (yIn - mountBottom) * (sin / (cos || 1e-9))],
    // |(eye − pivot) · n|, n unit.
    perpDistanceFromEye: (eye) =>
      Math.abs(eye[2] * cos - (eye[1] - mountBottom) * sin),
  };
}
