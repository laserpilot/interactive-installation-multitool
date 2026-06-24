import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  dbaFromFlat,
  mFromFt,
  splToRgb,
  type ConeRays,
  type UseCaseDef,
  type Vec3,
} from './speakerMath';

const SHELLS = 16;

const addV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const rgbStr = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/**
 * The directivity cone as a smooth SPL gradient: a stack of translucent cross-
 * section shells from the driver out to the design throw, each coloured by the
 * on-axis level at its depth (cold→green→hot via the scenario ramp) and more
 * opaque where it's loud — so the cone reads as a bright near field fading to
 * nothing where the level drops below the usable floor. Faint edge lines mark the
 * −6 dB coverage angle; a box marks the driver, dimmed when it's not selected.
 */
export function SpeakerCone({
  rays,
  useCase,
  selected,
}: {
  rays: ConeRays;
  useCase: UseCaseDef;
  selected: boolean;
}) {
  const { pos, dirs, basis, throwFt } = rays;

  const shells = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; color: string; opacity: number }[] = [];
    const start = 0.5;
    for (let i = 0; i < SHELLS; i++) {
      const t = (i + 0.5) / SHELLS;
      const d = start + (throwFt - start) * t;
      const flat = basis.refDb1m - 20 * Math.log10(Math.max(0.5, mFromFt(d)));
      const dba = dbaFromFlat(flat);
      // Opacity tracks how far into the comfortable band the on-axis level sits.
      const norm = Math.min(1, Math.max(0, (dba - useCase.minDba) / (useCase.maxDba - useCase.minDba)));
      const corners = dirs.map((dir) => addV(pos, mul(dir, d))) as Vec3[];
      const positions = new Float32Array(corners.flatMap((c) => c));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      out.push({
        geo,
        color: rgbStr(splToRgb(dba, useCase)),
        opacity: (0.025 + 0.11 * norm) * (selected ? 1 : 0.6),
      });
    }
    return out;
  }, [pos, dirs, basis, throwFt, useCase, selected]);
  useEffect(() => () => shells.forEach((s) => s.geo.dispose()), [shells]);

  const farCorners = dirs.map((dir) => addV(pos, mul(dir, throwFt))) as Vec3[];

  return (
    <group>
      {shells.map((s, i) => (
        <mesh key={i} geometry={s.geo}>
          <meshBasicMaterial
            color={s.color}
            transparent
            opacity={s.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* coverage-angle edge lines */}
      {farCorners.map((c, i) => (
        <Line
          key={i}
          points={[pos, c]}
          color={selected ? '#1c2b3a' : '#2b3440'}
          lineWidth={selected ? 1.4 : 0.8}
          transparent
          opacity={selected ? 0.55 : 0.3}
        />
      ))}

      {/* driver body — brighter when this is the selected unit */}
      <mesh position={pos}>
        <boxGeometry args={[0.6, 0.4, 0.4]} />
        <meshStandardMaterial
          color={selected ? '#0b65d8' : '#11161d'}
          emissive={selected ? '#0b65d8' : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>
    </group>
  );
}
