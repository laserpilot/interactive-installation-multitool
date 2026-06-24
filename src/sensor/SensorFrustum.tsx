import { Line, Text } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { fmtDist } from '../ui/units';
import type { Units } from '../store/useConfigStore';
import {
  confidenceAtFt,
  confRgb,
  inFromFt,
  type ConeRays,
  type Vec3,
} from './sensorMath';

const SHELLS = 18;

const addV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const rgbStr = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/**
 * The sensing cone as a smooth confidence gradient: a stack of translucent cross-
 * section shells from the near cutoff to max range, each coloured by the tracking
 * confidence at its depth (red→amber→green) and more opaque where confidence is
 * high — so the sweet spot reads as a dense green band and the noisy tail fades to
 * nothing (no hard cap). Faint edge lines give the cone its shape; labels mark the
 * reliable band.
 */
export function SensorFrustum({
  rays,
  units,
  showLabels = true,
}: {
  rays: ConeRays;
  units: Units;
  showLabels?: boolean;
}) {
  const { sensor, dirs, basis, minFt, confNearFt, confFarFt, maxFt } = rays;

  const shells = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; color: string; opacity: number }[] = [];
    const start = Math.max(minFt, 0.01);
    for (let i = 0; i < SHELLS; i++) {
      const t = (i + 0.5) / SHELLS;
      const d = start + (maxFt - start) * t;
      const conf = confidenceAtFt(d, basis);
      const corners = dirs.map((dir) => addV(sensor, mul(dir, d))) as Vec3[];
      const positions = new Float32Array(corners.flatMap((c) => c));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      out.push({ geo, color: rgbStr(confRgb(conf)), opacity: 0.03 + 0.13 * conf });
    }
    return out;
  }, [sensor, dirs, basis, minFt, maxFt]);
  useEffect(() => () => shells.forEach((s) => s.geo.dispose()), [shells]);

  const farCorners = dirs.map((dir) => addV(sensor, mul(dir, maxFt))) as Vec3[];
  const axis = basis.forward;
  const labelAt = (d: number): Vec3 => addV(sensor, mul(axis, d));

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

      {/* cone edge lines */}
      {farCorners.map((c, i) => (
        <Line key={i} points={[sensor, c]} color="#2b3440" lineWidth={1} transparent opacity={0.45} />
      ))}

      {/* sensor body */}
      <mesh position={sensor}>
        <boxGeometry args={[0.55, 0.35, 0.35]} />
        <meshStandardMaterial color="#11161d" />
      </mesh>

      {/* reliable-band labels along the centre axis */}
      {showLabels && (
        <>
          <Text position={labelAt(confNearFt)} fontSize={0.3} color="#10202e" outlineWidth={0.012} outlineColor="#ffffff" anchorX="center" anchorY="middle">
            {fmtDist(inFromFt(confNearFt), units)}
          </Text>
          <Text position={labelAt(confFarFt)} fontSize={0.3} color="#10202e" outlineWidth={0.012} outlineColor="#ffffff" anchorX="center" anchorY="middle">
            {fmtDist(inFromFt(confFarFt), units)} reliable
          </Text>
        </>
      )}
    </group>
  );
}
