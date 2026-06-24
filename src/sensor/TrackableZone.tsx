import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { makeZoneTexture } from './sensorTexture';
import type { TrackableField } from './sensorMath';

const LIFT = 0.02; // sit just above the floor grid

/**
 * Floor heatmap of where a standing person would be tracked: a quad spanning the
 * scored grid, textured by whole-body trackability. Transparent where nobody would
 * be tracked, so it reads as a "stand here" footprint on the floor.
 */
export function TrackableZone({ field }: { field: TrackableField }) {
  const geo = useMemo(() => {
    const { minX, minZ, sizeFt } = field;
    const farZ = minZ + sizeFt;
    const x1 = minX + sizeFt;
    // TL far-left, TR far-right, BR near-right, BL near-left — v=0 is the far row.
    const positions = new Float32Array([
      minX, LIFT, farZ,
      x1, LIFT, farZ,
      x1, LIFT, minZ,
      minX, LIFT, minZ,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex([0, 2, 3, 0, 1, 2]);
    g.computeVertexNormals();
    return g;
  }, [field]);
  useEffect(() => () => geo.dispose(), [geo]);

  const tex = useMemo(() => makeZoneTexture(field), [field]);
  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent toneMapped={false} />
    </mesh>
  );
}
