import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';
import { ADA_REACH_HIGH, ADA_REACH_LOW } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { screenGeometry } from '../ergonomics/screenGeometry';
import { makeTypeSpecimen } from '../typography/typeSpecimen';
import { f } from './scale';
import { makeTestPattern } from './testPattern';

const IN_ADA = '#19a05a'; // within the 15–48" operable band
const OUT_ADA = '#e06c6c'; // above or below it

interface AdaSeg {
  y: number;
  h: number;
  color: string;
}

/** Screen face split into ADA in/out bands, in panel-local world units. */
function adaReachSegments(
  enabled: boolean,
  mountBottom: number,
  heightIn: number,
  tiltRad: number,
): AdaSeg[] {
  if (!enabled) return [];
  const cos = Math.max(0.2, Math.cos(tiltRad));
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const dFor = (aff: number) => clamp((aff - mountBottom) / cos, 0, heightIn);
  const dLo = dFor(ADA_REACH_LOW);
  const dHi = dFor(ADA_REACH_HIGH);
  const seg = (d0: number, d1: number, color: string): AdaSeg | null =>
    d1 - d0 > 0.25 ? { y: f((d0 + d1) / 2 - heightIn / 2), h: f(d1 - d0), color } : null;
  return [
    seg(0, dLo, OUT_ADA), // below reach
    seg(dLo, dHi, IN_ADA), // within reach
    seg(dHi, heightIn, OUT_ADA), // above reach
  ].filter((x): x is AdaSeg => x !== null);
}

export function ScreenMesh() {
  const {
    diagonal, aspectW, aspectH, mountBottom, tiltDeg, mountType, contentUrl, showAdaOnScreen,
    typeShowSpecimen, typeSamples, typeSampleText, typeArtboardPx,
  } = useConfigStore();
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const [uploaded, setUploaded] = useState<THREE.Texture | null>(null);

  // Bright procedural test pattern (default), regenerated when aspect changes.
  const testPattern = useMemo(
    () => makeTestPattern(aspectW, aspectH, diagonal),
    [aspectW, aspectH, diagonal],
  );
  useEffect(() => () => testPattern.dispose(), [testPattern]);

  // Type specimen — the sample lines drawn at true artboard proportions. Only
  // built when the specimen is shown, and regenerated when its inputs change.
  const specimen = useMemo(
    () =>
      typeShowSpecimen
        ? makeTypeSpecimen({
            samples: typeSamples,
            text: typeSampleText,
            artboardPx: typeArtboardPx,
            aspectW,
            aspectH,
          })
        : null,
    [typeShowSpecimen, typeSamples, typeSampleText, typeArtboardPx, aspectW, aspectH],
  );
  useEffect(() => () => specimen?.dispose(), [specimen]);

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

  // Specimen wins when shown, else an uploaded image, else the test pattern.
  const map = specimen ?? uploaded ?? testPattern;
  const w = f(size.width);
  const h = f(size.height);
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const geom = screenGeometry({ mountBottom, height: size.height, tiltDeg });
  const pivotY = f(mountBottom);
  const pivotZ = f(geom.frontOffset) + 0.05; // bottom edge pushed forward off the wall

  // Split the screen face into ADA in/out bands. Work in panel-local "distance up
  // the panel" (inches, 0 = bottom edge … size.height = top edge); a tilt stretches
  // how much panel each AFF inch covers, so divide by cos(tilt). Local Y in the
  // tilted group is panel-distance recentred on the panel midpoint. (Cheap to
  // recompute each render, so no memo.)
  const adaSegments = adaReachSegments(showAdaOnScreen, mountBottom, size.height, tiltRad);

  return (
    <group>
      {/* Bottom-edge pivot out in front of the wall; tilt back so the top
          recedes to the wall; raise the panel by h/2 along its face. */}
      <group position={[0, pivotY, pivotZ]} rotation={[-tiltRad, 0, 0]}>
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
          {/* ADA reach shading: green where the screen is operable (15–48" AFF),
              red where it falls outside the band */}
          {adaSegments.map((s, i) => (
            <mesh key={i} position={[0, s.y, 0.03]}>
              <planeGeometry args={[w, s.h]} />
              <meshBasicMaterial
                color={s.color}
                transparent
                opacity={0.4}
                depthWrite={false}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* Stand / podium: a base from the floor up to the (forward) bottom edge. */}
      {mountType === 'stand' && pivotY > 0.05 && (
        <mesh position={[0, pivotY / 2, pivotZ]} castShadow>
          <boxGeometry args={[Math.min(w, f(28)), pivotY, f(16)]} />
          <meshStandardMaterial color="#5a6470" />
        </mesh>
      )}
    </group>
  );
}
