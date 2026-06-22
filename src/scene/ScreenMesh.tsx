import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { f } from './scale';
import { makeTestPattern } from './testPattern';

export function ScreenMesh() {
  const { diagonal, aspectW, aspectH, mountBottom, tiltDeg, mountType, contentUrl } =
    useConfigStore();
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const [uploaded, setUploaded] = useState<THREE.Texture | null>(null);

  // Bright procedural test pattern (default), regenerated when aspect changes.
  const testPattern = useMemo(
    () => makeTestPattern(aspectW, aspectH, diagonal),
    [aspectW, aspectH, diagonal],
  );
  useEffect(() => () => testPattern.dispose(), [testPattern]);

  useEffect(() => {
    if (!contentUrl) {
      setUploaded(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let active = true;
    loader.load(contentUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (active) setUploaded(t);
    });
    return () => {
      active = false;
    };
  }, [contentUrl]);

  const map = uploaded ?? testPattern;
  const w = f(size.width);
  const h = f(size.height);
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const pivotY = f(mountBottom); // tilt about the bottom edge

  return (
    <group>
      {/* Pivot at the bottom edge, tilt the top toward the viewer, raise by h/2. */}
      <group position={[0, pivotY, 0.05]} rotation={[-tiltRad, 0, 0]}>
        <group position={[0, h / 2, 0]}>
          {/* bezel — set back so its front face stays BEHIND the active plane */}
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[w + 0.12, h + 0.12, 0.1]} />
            <meshStandardMaterial color="#0a0c10" />
          </mesh>
          {/* active area — in front of the bezel, unlit like a powered display */}
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={map} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* Stand / podium: a simple base from the floor up to the bottom edge. */}
      {mountType === 'stand' && pivotY > 0.05 && (
        <mesh position={[0, pivotY / 2, -0.1]} castShadow>
          <boxGeometry args={[Math.min(w, f(28)), pivotY, f(16)]} />
          <meshStandardMaterial color="#5a6470" />
        </mesh>
      )}
    </group>
  );
}
