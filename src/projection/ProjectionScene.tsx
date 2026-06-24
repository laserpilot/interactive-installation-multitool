import { Canvas } from '@react-three/fiber';
import { Grid, Line, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { f } from '../scene/scale';
import { makeWallGrid } from '../scene/wallGrid';
import { ProjectionFigure } from './ProjectionFigure';
import { ProjectionFrustum } from './ProjectionFrustum';
import { ProjectionSurface } from './ProjectionSurface';
import {
  arrayLayout,
  BAND_LABEL,
  BAND_TONE,
  fcToColor,
  frustumGeometry,
  ftFromIn,
  projectionArrayMetrics,
  projectionMetrics,
  rampGradientCss,
  translateGeometryX,
  inFromFt,
  FC_MIN_ACCEPTABLE,
  FC_DESIRABLE,
} from './projectionMath';

const WALL_HEIGHT = 16; // ft

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
        args={[80, 80]}
        cellSize={1}
        cellColor="#9aa3ae"
        sectionSize={5}
        sectionColor="#6f7a87"
        infiniteGrid
        fadeDistance={70}
        position={[0, 0.002, 10]}
      />
    </>
  );
}

function Wall({ width }: { width: number }) {
  const w = Math.max(f(width) + 8, 18);
  const grid = useMemo(() => makeWallGrid(), []);
  useEffect(() => () => grid.dispose(), [grid]);
  grid.repeat.set(Math.round(w), WALL_HEIGHT);

  return (
    <group>
      <mesh position={[0, WALL_HEIGHT / 2, -0.02]}>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        <meshStandardMaterial color="#8d96a2" />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, -0.008]}>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        <meshBasicMaterial map={grid} transparent />
      </mesh>
    </group>
  );
}

const LINE = '#10202e';

export function ProjectionScene() {
  const s = useConfigStore();
  const units = s.units;

  const metrics = useMemo(
    () =>
      projectionMetrics({
        throwRatio: s.projThrowRatio,
        distanceIn: s.projDistance,
        aspectW: s.projAspectW,
        aspectH: s.projAspectH,
        lumens: s.projLumens,
        projectorCount: s.projectorCount,
        stackEff: s.projStackEff,
        resW: s.projResW,
        resH: s.projResH,
        ambientFc: s.projAmbientFc,
        screenGain: s.projScreenGain,
      }),
    [
      s.projThrowRatio,
      s.projDistance,
      s.projAspectW,
      s.projAspectH,
      s.projLumens,
      s.projectorCount,
      s.projStackEff,
      s.projResW,
      s.projResH,
      s.projAmbientFc,
      s.projScreenGain,
    ],
  );

  const geom = useMemo(
    () =>
      frustumGeometry({
        distanceIn: s.projDistance,
        throwRatio: s.projThrowRatio,
        aspectW: s.projAspectW,
        aspectH: s.projAspectH,
        lensAffIn: s.projLensAff,
        lensShiftPct: s.projLensShiftPct,
        lensOrigin: s.projLensOrigin,
        tiltDeg: s.projTiltDeg,
      }),
    [
      s.projDistance,
      s.projThrowRatio,
      s.projAspectW,
      s.projAspectH,
      s.projLensAff,
      s.projLensShiftPct,
      s.projLensOrigin,
      s.projTiltDeg,
    ],
  );

  // Horizontal edge-blended array: lay the single image out N times with a
  // uniform neighbour overlap, then slide a copy of the frustum to each centre.
  const layout = useMemo(
    () => arrayLayout(s.projArrayCount, s.projArrayOverlapPct, metrics.widthFt),
    [s.projArrayCount, s.projArrayOverlapPct, metrics.widthFt],
  );
  const arrayM = useMemo(
    () => projectionArrayMetrics(metrics, layout, s.projResW),
    [metrics, layout, s.projResW],
  );
  const geoms = useMemo(
    () => layout.centersX.map((dx) => translateGeometryX(geom, dx)),
    [geom, layout],
  );
  // Content slice each projector covers, as a fraction of the spanning image.
  const uRanges = useMemo(
    () =>
      layout.centersX.map((cx): [number, number] => {
        const tw = layout.totalWidthFt;
        const left = (cx - metrics.widthFt / 2 + tw / 2) / tw;
        const right = (cx + metrics.widthFt / 2 + tw / 2) / tw;
        return [left, right];
      }),
    [layout, metrics.widthFt],
  );
  const isArray = layout.count > 1;

  const tone = BAND_TONE[metrics.band];
  const distFt = ftFromIn(s.projDistance);
  const imgCenterY = geom.imageCenterFt;
  const halfW = arrayM.totalWidthFt / 2;
  const imageHeightFt = metrics.heightFt;
  const bandColor = fcToColor(metrics.footCandles);

  // Camera framing scaled to the setup (full array width).
  const camX = -(Math.max(8, arrayM.totalWidthFt) + 4);
  const camY = Math.max(7, imgCenterY + 4);
  const camZ = distFt + 8;

  const bottomY = geom.bottomLeft[1];

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
          <OrbitControls
            target={[0, Math.max(3, imgCenterY), distFt * 0.4]}
            maxPolarAngle={Math.PI / 2}
          />
          <Lights />
          <Floor />
          <Wall width={inFromFt(arrayM.totalWidthFt)} />
          {geoms.map((g, i) => (
            <group key={i}>
              <ProjectionSurface
                geom={g}
                footCandles={metrics.footCandles}
                uRange={uRanges[i]}
              />
              <ProjectionFrustum geom={g} color={bandColor} />
            </group>
          ))}
          {/* Blend seams: the overlap of two projectors runs ~2× bright before
              the blend curve tapers it — flag each seam as a hot strip. */}
          {isArray &&
            s.projSurfaceView === 'heatmap' &&
            layout.seamsX.map((sx, i) => (
              <mesh key={i} position={[sx, imgCenterY, 0.03]}>
                <planeGeometry args={[layout.overlapWidthFt, imageHeightFt]} />
                <meshBasicMaterial
                  color="#ffe08a"
                  transparent
                  opacity={0.3}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ))}
          {s.projShowFigure && <ProjectionFigure pos={[halfW + 1.5, 2]} />}

          {/* image width dimension just under the bottom edge */}
          <Line
            points={[
              [-halfW, bottomY - 0.5, 0.02],
              [halfW, bottomY - 0.5, 0.02],
            ]}
            color={LINE}
            lineWidth={2}
          />
          <Text
            position={[0, bottomY - 1.1, 0.06]}
            fontSize={0.5}
            color={LINE}
            outlineWidth={0.02}
            outlineColor="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {fmtDist(inFromFt(arrayM.totalWidthFt), units)} wide
            {isArray ? ` · ${arrayM.count}×` : ''} · {Math.round(metrics.footCandles)} fc ·{' '}
            {Math.round(metrics.footLamberts)} fL
          </Text>

          {/* throw distance along the floor */}
          <Line
            points={[
              [halfW + 1.5, 0.02, 0],
              [halfW + 1.5, 0.02, distFt],
            ]}
            color={LINE}
            lineWidth={2}
          />
          <Text
            position={[halfW + 2.1, 0.03, distFt / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.5}
            color={LINE}
            outlineWidth={0.02}
            outlineColor="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {fmtDist(s.projDistance, units)} throw
          </Text>
        </Canvas>
      </div>

      <div className="proj-readout">
        <div className="proj-top">
          <div className={`dvled-verdict ${tone}`}>
            <span className="dvled-dot" />
            {BAND_LABEL[metrics.band]}
            <span className="dvled-sub">
              {Math.round(metrics.footCandles)} fc on a {metrics.widthFt.toFixed(1)} ×{' '}
              {metrics.heightFt.toFixed(1)} ft image
            </span>
          </div>
          <div className="proj-legend">
            <div className="proj-legend-bar" style={{ background: rampGradientCss() }} />
            <div className="proj-legend-ticks">
              <span>0</span>
              <span>{FC_MIN_ACCEPTABLE}</span>
              <span>100</span>
              <span>{FC_DESIRABLE}</span>
              <span>800</span>
            </div>
            <div className="proj-legend-caption">
              Surface brightness — foot-candles (dim → bright)
            </div>
          </div>
        </div>

        <dl className="dvled-metrics">
          <div>
            <dt>Image size</dt>
            <dd>
              {(isArray ? arrayM.totalWidthFt : metrics.widthFt).toFixed(1)} ×{' '}
              {metrics.heightFt.toFixed(1)} ft
            </dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{Math.round(isArray ? arrayM.totalAreaSqFt : metrics.areaSqFt)} ft²</dd>
          </div>
          {isArray && (
            <div>
              <dt>Array</dt>
              <dd>
                {arrayM.count} wide · {Math.round(s.projArrayOverlapPct)}% overlap
              </dd>
            </div>
          )}
          {isArray && (
            <div>
              <dt>Combined res</dt>
              <dd>
                {arrayM.combinedResW.toLocaleString()} × {s.projResH.toLocaleString()} px
              </dd>
            </div>
          )}
          <div>
            <dt>Brightness</dt>
            <dd>
              {Math.round(metrics.footCandles)} fc
              {isArray ? ` · seams ${Math.round(arrayM.blendFc)}` : ''}
            </dd>
          </div>
          <div>
            <dt>Luminance</dt>
            <dd>
              {Math.round(metrics.footLamberts)} fL · {Math.round(metrics.nits)} nits
            </dd>
          </div>
          <div>
            <dt>Ambient contrast</dt>
            <dd>
              {metrics.contrastRatio === Infinity
                ? '∞'
                : `${metrics.contrastRatio.toFixed(1)}:1`}
            </dd>
          </div>
          <div>
            <dt>Resolution / ft</dt>
            <dd>
              {Math.round(isArray ? arrayM.hPpf : metrics.hPpf)} × {Math.round(metrics.vPpf)} px
            </dd>
          </div>
          <div>
            <dt>Total output</dt>
            <dd>
              {(isArray ? arrayM.systemLumens : metrics.effectiveLumens).toLocaleString()} lm
            </dd>
          </div>
        </dl>
        <p className="dvled-note">
          Throw ratio {s.projThrowRatio} ·{' '}
          {s.projectorCount > 1
            ? `${s.projectorCount} stacked @ ${Math.round(s.projStackEff * 100)}% (${(metrics.effectiveLumens / s.projLumens).toFixed(1)}× lumens) · `
            : ''}
          {isArray
            ? `${arrayM.count} blended across ${arrayM.totalWidthFt.toFixed(1)} ft at ${Math.round(s.projArrayOverlapPct)}% overlap — seams run ~2× bright before the blend curve evens them out. `
            : ''}
          brightness is the area-average; lens shift keeps a clean rectangle while tilt
          keystones it and brightens the near edge. 20 fc is the floor, 400+ is comfortably bright.
        </p>
      </div>
    </div>
  );
}
