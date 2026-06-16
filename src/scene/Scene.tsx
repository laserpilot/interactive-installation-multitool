import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { useConfigStore } from '../store/useConfigStore';
import { Avatar } from './Avatar';
import { avatarLayout } from './avatarLayout';
import { ReachBandOverlay } from './ReachBandOverlay';
import { ScreenMesh } from './ScreenMesh';
import { f } from './scale';

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#33404d', 1.1]} />
      <directionalLight position={[6, 12, 8]} intensity={1.4} castShadow />
    </>
  );
}

function Floor() {
  return (
    <Grid
      args={[60, 60]}
      cellSize={1}
      cellColor="#33414f"
      sectionSize={5}
      sectionColor="#475568"
      infiniteGrid
      fadeDistance={45}
      position={[0, 0.001, 8]}
    />
  );
}

function Wall({ width }: { width: number }) {
  const w = Math.max(f(width) + 6, 16);
  return (
    <mesh position={[0, 6, -0.02]} receiveShadow>
      <planeGeometry args={[w, 18]} />
      <meshStandardMaterial color="#1c242e" />
    </mesh>
  );
}

function CameraRig() {
  const { cameraView, personaId, mode, viewingDistance, diagonal, aspectW, aspectH, mountBottom } =
    useConfigStore();
  const persona = PERSONAS[personaId];
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const distance = mode === 'touch' ? persona.touchDistance : viewingDistance;
  const screenCenter = f(mountBottom + size.height / 2);
  const L = avatarLayout(persona, distance, mountBottom, mountBottom + size.height);

  const fpRef = useRef<THREE.PerspectiveCamera>(null);

  // Aim the first-person camera at the screen centre whenever inputs change.
  useEffect(() => {
    if (cameraView === 'first-person' && fpRef.current) {
      fpRef.current.position.set(L.eye[0], L.eye[1], L.eye[2]);
      fpRef.current.lookAt(0, screenCenter, 0);
      fpRef.current.updateProjectionMatrix();
    }
  }, [cameraView, L.eye, screenCenter]);

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
    <Canvas shadows dpr={[1, 2]} style={{ background: '#0b0e12' }}>
      <CameraRig />
      <Lights />
      <Floor />
      <Wall width={size.width} />
      <ScreenMesh />
      <ReachBandOverlay width={size.width} />
      <Avatar />
    </Canvas>
  );
}
