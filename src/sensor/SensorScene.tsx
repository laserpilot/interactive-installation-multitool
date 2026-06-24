import { Canvas } from '@react-three/fiber';
import { Billboard, Grid, Line, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { useMemo } from 'react';
import { PERSONAS } from '../ergonomics/constants';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { SensorAvatar } from './SensorAvatar';
import { SensorFrustum } from './SensorFrustum';
import { TrackableZone } from './TrackableZone';
import {
  BAND_TONE,
  bodyCoverage,
  confColor,
  coneRays,
  ftFromIn,
  inFromFt,
  rampGradientCss,
  trackableField,
  type SensorParams,
} from './sensorMath';

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#aab2bd', 1.5]} />
      <directionalLight position={[6, 14, 9]} intensity={1.2} />
      <directionalLight position={[-8, 8, 6]} intensity={0.5} />
    </>
  );
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#b9c0c9" />
      </mesh>
      <Grid
        args={[120, 120]}
        cellSize={1}
        cellColor="#9aa3ae"
        sectionSize={5}
        sectionColor="#6f7a87"
        infiniteGrid
        fadeDistance={80}
        position={[0, 0.002, 0]}
      />
    </>
  );
}

function WallPlane({ z, height }: { z: number; height: number }) {
  return (
    <mesh position={[0, height / 2, z]}>
      <planeGeometry args={[60, height]} />
      <meshStandardMaterial color="#8d96a2" transparent opacity={0.35} side={2} />
    </mesh>
  );
}

/** A small mounting plate on the ceiling so an overhead sensor reads as hung,
 *  not stuck to a mid-wall. Kept small + flat so it doesn't occlude the scene. */
function CeilingPlate({ y }: { y: number }) {
  return (
    <mesh position={[0, y + 0.06, 0]}>
      <boxGeometry args={[3, 0.12, 3]} />
      <meshStandardMaterial color="#8d96a2" transparent opacity={0.5} />
    </mesh>
  );
}

const LINE = '#10202e';
type V3 = [number, number, number];
const midpt = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** A dimension line with a camera-facing label at its midpoint. */
function DimLine({ a, b, label }: { a: V3; b: V3; label: string }) {
  const m = midpt(a, b);
  return (
    <group>
      <Line points={[a, b]} color={LINE} lineWidth={1.5} transparent opacity={0.8} />
      <Billboard position={[m[0], m[1] + 0.25, m[2]]}>
        <Text fontSize={0.34} color={LINE} outlineWidth={0.015} outlineColor="#ffffff" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

export function SensorScene() {
  const s = useConfigStore();
  const units = s.units;
  const persona = PERSONAS[s.sensorPersona];

  const params: SensorParams = useMemo(
    () => ({
      mount: s.sensorMount,
      mountAffIn: s.sensorMountAff,
      pitchDeg: s.sensorPitchDeg,
      yawDeg: s.sensorYawDeg,
      hFovDeg: s.sensorHFov,
      vFovDeg: s.sensorVFov,
      minRangeIn: s.sensorMinRange,
      confNearIn: s.sensorConfNear,
      confFarIn: s.sensorConfFar,
      maxRangeIn: s.sensorMaxRange,
    }),
    [
      s.sensorMount,
      s.sensorMountAff,
      s.sensorPitchDeg,
      s.sensorYawDeg,
      s.sensorHFov,
      s.sensorVFov,
      s.sensorMinRange,
      s.sensorConfNear,
      s.sensorConfFar,
      s.sensorMaxRange,
    ],
  );

  const px = ftFromIn(s.sensorPersonX);
  const pz = ftFromIn(s.sensorPersonZ);

  const rays = useMemo(() => coneRays(params), [params]);
  const field = useMemo(
    () => trackableField(params, persona, 56),
    [params, persona],
  );
  const cover = useMemo(
    () => bodyCoverage(params, persona, px, pz),
    [params, persona, px, pz],
  );

  const tone = BAND_TONE[cover.band];
  const chest = cover.parts.find((p) => p.name === 'chest');
  const sensorY = ftFromIn(params.mountAffIn);

  // Frame the sensor + person + zone.
  const sizeFt = Math.max(ftFromIn(params.maxRangeIn), Math.hypot(px, pz) + 4, sensorY, 8);
  const camX = -(sizeFt * 0.95 + 4);
  const camY = Math.max(sensorY + 4, sizeFt * 0.85);
  const camZ = Math.max(pz, 0) + sizeFt * 1.05 + 6;
  const target: [number, number, number] = [px * 0.5, Math.max(2, sensorY * 0.4), pz * 0.5 + 1];

  const fmtArea = (sqft: number) =>
    units === 'metric' ? `${(sqft * 0.092903).toFixed(1)} m²` : `${Math.round(sqft)} ft²`;

  return (
    <div className="proj-stage">
      <div className="proj-frame">
        <Canvas
          dpr={[1, 2]}
          style={{
            background: 'linear-gradient(180deg,#dfe4ea 0%,#bcc4ce 55%,#9ca5b0 100%)',
          }}
        >
          <PerspectiveCamera makeDefault fov={45} position={[camX, camY, camZ]} />
          <OrbitControls target={target} maxPolarAngle={Math.PI / 2} />
          <Lights />
          <Floor />
          {params.mount === 'wall' && <WallPlane z={-0.02} height={Math.max(sensorY + 2, 10)} />}
          {params.mount === 'ceiling' && <CeilingPlate y={sensorY} />}
          {s.sensorTarget === 'wall' && (
            <WallPlane z={ftFromIn(s.sensorWallDist)} height={10} />
          )}

          {s.sensorShowZone && <TrackableZone field={field} />}
          <SensorFrustum rays={rays} units={units} showLabels={s.sensorShowMeasurements} />
          <SensorAvatar params={params} persona={persona} x={px} z={pz} />

          {/* spatial reference: sensor height, slant distance to the body, floor offset */}
          {s.sensorShowMeasurements && (
            <>
              <DimLine a={[0, 0, 0]} b={[0, sensorY, 0]} label={`${fmtDist(params.mountAffIn, units)} high`} />
              {chest && (
                <DimLine
                  a={[0, sensorY, 0]}
                  b={chest.point}
                  label={`${fmtDist(inFromFt(chest.distFt), units)} to body`}
                />
              )}
              {Math.hypot(px, pz) > 1 && (
                <DimLine a={[0, 0, 0]} b={[px, 0, pz]} label={`${fmtDist(inFromFt(Math.hypot(px, pz)), units)} on floor`} />
              )}
            </>
          )}
        </Canvas>
      </div>

      <div className="proj-readout">
        <div className="proj-top">
          <div className={`dvled-verdict ${tone}`}>
            <span className="dvled-dot" />
            {cover.label}
            <span className="dvled-sub">{cover.detail}</span>
          </div>
          <div className="proj-legend">
            <div className="proj-legend-bar" style={{ background: rampGradientCss() }} />
            <div className="proj-legend-ticks">
              <span>blind</span>
              <span>noisy</span>
              <span>reliable</span>
            </div>
            <div className="proj-legend-caption">
              Tracking confidence — {SENSING_LABEL[s.sensorMode]} mode. Gray = outside the field of view.
            </div>
          </div>
        </div>

        {/* per-body-part coverage */}
        <div className="sensor-parts">
          {cover.parts.map((p) => (
            <span key={p.name} className="sensor-part">
              <span
                className="sensor-part-dot"
                style={{ background: confColor(p.conf, p.inFOV) }}
              />
              {p.name}
            </span>
          ))}
        </div>

        <dl className="dvled-metrics">
          <div>
            <dt>Reliable range</dt>
            <dd>
              {fmtDist(params.confNearIn, units)} – {fmtDist(params.confFarIn, units)}
            </dd>
          </div>
          <div>
            <dt>Hard limits</dt>
            <dd>
              {fmtDist(params.minRangeIn, units)} – {fmtDist(params.maxRangeIn, units)}
            </dd>
          </div>
          <div>
            <dt>Field of view</dt>
            <dd>
              {Math.round(params.hFovDeg)}° × {Math.round(params.vFovDeg)}°
            </dd>
          </div>
          <div>
            <dt>Trackable floor zone</dt>
            <dd>{fmtArea(field.coveredAreaSqFt)}</dd>
          </div>
          <div>
            <dt>Body confidence</dt>
            <dd>
              {cover.fracCoreInFov < 1
                ? 'partly out of frame'
                : `${Math.round(cover.minCoreConf * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>Person at</dt>
            <dd>
              {fmtDist(inFromFt(Math.hypot(px, pz)), units)} ·{' '}
              {persona.label.split(' ')[0]}
            </dd>
          </div>
        </dl>
        <p className="dvled-note">
          Move the person (forward / side) to spot-check coverage; the floor map shows
          everywhere a standing {persona.label.split(' ')[0].toLowerCase()} would be
          tracked. The reliable band is tighter than the sensor's spec range because{' '}
          {SENSING_LABEL[s.sensorMode].toLowerCase()} tracking degrades before max depth.
        </p>
      </div>
    </div>
  );
}

const SENSING_LABEL: Record<string, string> = {
  skeletal: 'Skeletal',
  hand: 'Hand / gesture',
  pointcloud: 'Point cloud',
  presence: 'Presence',
};
