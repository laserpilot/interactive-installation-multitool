import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { screenGeometry } from '../ergonomics/screenGeometry';
import { useConfigStore } from '../store/useConfigStore';
import { AvatarSwitch } from './GltfAvatar';
import { avatarLayout } from './avatarLayout';
import { Measurements } from './Measurements';
import { ReachBandOverlay } from './ReachBandOverlay';
import { ScreenMesh } from './ScreenMesh';
import { f } from './scale';
import { makeWallGrid } from './wallGrid';

const WALL_HEIGHT = 14; // ft, sits on the floor (0 → 14)

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#aab2bd', 1.5]} />
      <directionalLight position={[6, 14, 9]} intensity={1.5} castShadow />
      <directionalLight position={[-8, 8, 6]} intensity={0.5} />
    </>
  );
}

function Floor() {
  return (
    <>
      {/* solid ground plane so nothing shows "below" the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#b9c0c9" />
      </mesh>
      <Grid
        args={[60, 60]}
        cellSize={1}
        cellColor="#9aa3ae"
        sectionSize={5}
        sectionColor="#6f7a87"
        infiniteGrid
        fadeDistance={48}
        position={[0, 0.002, 8]}
      />
    </>
  );
}

function Wall({ width }: { width: number }) {
  const w = Math.max(f(width) + 6, 16);
  const grid = useMemo(() => makeWallGrid(), []);
  useEffect(() => () => grid.dispose(), [grid]);
  grid.repeat.set(Math.round(w), WALL_HEIGHT);

  return (
    <group>
      {/* solid wall, bottom edge resting on the floor */}
      <mesh position={[0, WALL_HEIGHT / 2, -0.02]} receiveShadow>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        <meshStandardMaterial color="#8d96a2" />
      </mesh>
      {/* 6"/12" measurement grid overlay */}
      <mesh position={[0, WALL_HEIGHT / 2, -0.008]}>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        <meshBasicMaterial map={grid} transparent />
      </mesh>
    </group>
  );
}

function CameraRig() {
  const { cameraView, personaId, mode, viewingDistance, diagonal, aspectW, aspectH, mountBottom, tiltDeg } =
    useConfigStore();
  const persona = PERSONAS[personaId];
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const distance = mode === 'touch' ? persona.touchDistance : viewingDistance;
  const geom = screenGeometry({ mountBottom, height: size.height, tiltDeg });
  const center: [number, number, number] = [0, f(geom.center[1]), f(geom.center[2])];
  const screenCenter = center[1];
  const L = avatarLayout(persona, distance, mountBottom, mountBottom + size.height, tiltDeg);

  const fpRef = useRef<THREE.PerspectiveCamera>(null);

  // Aim the first-person camera at the screen centre whenever inputs change.
  // Nudge the eye slightly forward (toward the screen) past the head's surface.
  useEffect(() => {
    if (cameraView === 'first-person' && fpRef.current) {
      fpRef.current.position.set(L.eye[0], L.eye[1], L.eye[2] - f(3));
      fpRef.current.lookAt(center[0], center[1], center[2]);
      fpRef.current.updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraView, L.eye, center[1], center[2]]);

  if (cameraView === 'first-person') {
    // ~55° vertical FOV ≈ natural human perception, so an oversized screen
    // visibly overflows the frame — the "this is overwhelming" moment.
    return <PerspectiveCamera ref={fpRef} makeDefault fov={55} near={0.05} far={200} />;
  }

  const orbitTarget: [number, number, number] = [0, Math.max(3.5, screenCenter), L.z / 2];
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={45}
        position={[-Math.max(7, f(size.width)), 5.5, L.z + 9]}
      />
      <OrbitControls target={orbitTarget} maxPolarAngle={Math.PI / 2} />
    </>
  );
}

export function Scene() {
  const { diagonal, aspectW, aspectH } = useConfigStore();
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      style={{
        background: 'linear-gradient(180deg,#dfe4ea 0%,#bcc4ce 55%,#9ca5b0 100%)',
      }}
    >
      <CameraRig />
      <Lights />
      <Floor />
      <Wall width={size.width} />
      <ScreenMesh />
      <ReachBandOverlay width={size.width} />
      <Measurements />
      <AvatarSwitch />
    </Canvas>
  );
}
