import { useMemo } from 'react';
import * as THREE from 'three';

/** A capsule/cylinder connecting two world points — the avatar's limbs/segments. */
export function Bone({
  a,
  b,
  radius,
  color = '#cdd6e0',
}: {
  a: [number, number, number];
  b: [number, number, number];
  radius: number;
  color?: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(vb, va);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { position: mid, quaternion: q, length: len };
  }, [a, b]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[radius, Math.max(0.001, length - radius * 2), 6, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
