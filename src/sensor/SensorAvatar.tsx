import { Bone } from '../scene/Bone';
import { Wheelchair } from '../scene/Wheelchair';
import { f } from '../scene/scale';
import type { Persona } from '../ergonomics/constants';
import { bodyKeypoints } from './bodyModel';
import { confColor, samplePoint, type SensorParams, type Vec3 } from './sensorMath';

const mid = (a: Vec3, b: Vec3): Vec3 => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
  (a[2] + b[2]) / 2,
];

/**
 * The placed person, drawn from `Bone` capsules and coloured per body segment by
 * the tracking confidence at that segment — green where solidly tracked, amber in
 * the noisy tail, red in the blind zone, gray where it falls outside the FOV.
 * Always rendered (a gray body still shows you where the person is standing).
 */
export function SensorAvatar({
  params,
  persona,
  x,
  z,
}: {
  params: SensorParams;
  persona: Persona;
  x: number;
  z: number;
}) {
  const kps = bodyKeypoints(persona, x, z);
  const pt = (name: string): Vec3 => kps.find((k) => k.name === name)!.point;

  // Colour a segment by sampling its midpoint.
  const colorAt = (a: Vec3, b: Vec3): string => {
    const s = samplePoint(params, mid(a, b));
    return confColor(s.conf, s.inFOV);
  };
  const colorPt = (p: Vec3): string => {
    const s = samplePoint(params, p);
    return confColor(s.conf, s.inFOV);
  };

  const feet = pt('feet');
  const knees = pt('knees');
  const hips = pt('hips');
  const chest = pt('chest');
  const shoulders = pt('shoulders');
  const head = pt('head');

  const offs = (p: Vec3, dx: number): Vec3 => [p[0] + f(dx), p[1], p[2]];
  const headR = f(4.2);

  return (
    <group>
      {/* head */}
      <mesh position={[head[0], head[1] + headR * 0.4, head[2]]}>
        <sphereGeometry args={[headR, 18, 18]} />
        <meshStandardMaterial color={colorPt(head)} />
      </mesh>
      {/* neck + torso */}
      <Bone a={shoulders} b={head} radius={f(1.6)} color={colorAt(shoulders, head)} />
      <Bone a={chest} b={shoulders} radius={f(4.8)} color={colorAt(chest, shoulders)} />
      <Bone a={hips} b={chest} radius={f(4.8)} color={colorAt(hips, chest)} />
      {/* shoulder bar */}
      <Bone
        a={offs(shoulders, -7)}
        b={offs(shoulders, 7)}
        radius={f(2.2)}
        color={colorPt(shoulders)}
      />

      {persona.seated ? (
        <Wheelchair z={z} seatIn={hips[1] * 12} />
      ) : (
        <>
          {/* legs */}
          <Bone a={offs(feet, -3.5)} b={offs(knees, -3.5)} radius={f(2.5)} color={colorAt(feet, knees)} />
          <Bone a={offs(feet, 3.5)} b={offs(knees, 3.5)} radius={f(2.5)} color={colorAt(feet, knees)} />
          <Bone a={offs(knees, -3.5)} b={offs(hips, -3.5)} radius={f(2.6)} color={colorAt(knees, hips)} />
          <Bone a={offs(knees, 3.5)} b={offs(hips, 3.5)} radius={f(2.6)} color={colorAt(knees, hips)} />
        </>
      )}
    </group>
  );
}
