import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { makeCoverageTexture } from './splTexture';
import type { CoverageField, UseCaseDef } from './speakerMath';
import type { CoverageView } from '../store/useConfigStore';

/**
 * The ear-height listening plane, textured by the combined SPL (or uniformity)
 * field — a horizontal quad floating at ear height so you read coverage where the
 * ears actually are, not on the floor. Transparent below the audible floor so the
 * room shows through outside the speakers' reach.
 */
export function CoveragePlane({
  field,
  view,
  useCase,
}: {
  field: CoverageField;
  view: CoverageView;
  useCase: UseCaseDef;
}) {
  const geo = useMemo(() => {
    const { minX, minZ, sizeFt, earFt } = field;
    const farZ = minZ + sizeFt;
    const x1 = minX + sizeFt;
    // TL far-left, TR far-right, BR near-right, BL near-left — v=0 is the far row.
    const positions = new Float32Array([
      minX, earFt, farZ,
      x1, earFt, farZ,
      x1, earFt, minZ,
      minX, earFt, minZ,
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

  const tex = useMemo(
    () => makeCoverageTexture(field, view, useCase),
    [field, view, useCase],
  );
  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent toneMapped={false} />
    </mesh>
  );
}
