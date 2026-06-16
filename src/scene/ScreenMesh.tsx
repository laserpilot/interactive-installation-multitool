import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { f } from './scale';

export function ScreenMesh() {
  const { diagonal, aspectW, aspectH, mountBottom, contentUrl } = useConfigStore();
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!contentUrl) {
      setTexture(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let active = true;
    loader.load(contentUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (active) setTexture(t);
    });
    return () => {
      active = false;
    };
  }, [contentUrl]);

  const w = f(size.width);
  const h = f(size.height);
  const cy = f(mountBottom + size.height / 2);

  return (
    <group position={[0, cy, 0.03]}>
      {/* bezel */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.12]} />
        <meshStandardMaterial color="#0a0c10" />
      </mesh>
      {/* active area */}
      <mesh>
        <planeGeometry args={[w, h]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial
            color="#10202e"
            emissive="#16344a"
            emissiveIntensity={0.6}
          />
        )}
      </mesh>
    </group>
  );
}
