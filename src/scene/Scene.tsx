import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

// First-person "look around" = a clamped head-turn. The eye never moves; we only
// rotate the gaze within a natural head-turn cone. Scratch objects are module-level
// so the per-frame applier allocates nothing.
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const YAW_LIMIT = THREE.MathUtils.degToRad(35);
const PITCH_LIMIT = THREE.MathUtils.degToRad(25);
const LOOK_SENS = THREE.MathUtils.degToRad(0.15); // radians of gaze per pixel dragged
const _qYaw = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _lookMat = new THREE.Matrix4();
const _eye = new THREE.Vector3();
const _center = new THREE.Vector3();

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
  const { cameraView, personaId, mode, viewingDistance, diagonal, aspectW, aspectH, mountBottom, tiltDeg, fpFov } =
    useConfigStore();
  const gl = useThree((s) => s.gl);
  const persona = PERSONAS[personaId];
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const distance = mode === 'touch' ? persona.touchDistance : viewingDistance;
  const geom = screenGeometry({ mountBottom, height: size.height, tiltDeg });
  const center: [number, number, number] = [0, f(geom.center[1]), f(geom.center[2])];
  const screenCenter = center[1];
  const L = avatarLayout(persona, distance, mountBottom, mountBottom + size.height, tiltDeg);

  const fpRef = useRef<THREE.PerspectiveCamera>(null);

  // Look-around state lives in refs so dragging never triggers a React re-render
  // (and so unrelated store updates can't clobber an in-progress drag).
  const yaw = useRef(0); // head-turn left/right, radians, clamped to ±YAW_LIMIT
  const pitch = useRef(0); // head-tilt up/down, radians, clamped to ±PITCH_LIMIT
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const baseQuat = useRef(new THREE.Quaternion()); // orientation that faces the screen
  const eyePos = useRef(new THREE.Vector3()); // authoritative eye position, enforced per-frame

  // Place the eye and recompute the base (screen-facing) orientation whenever the
  // geometry moves. We do NOT touch yaw/pitch here, so the head keeps facing the
  // screen as it moves without yanking an active manual gaze. Deps are scalars to
  // avoid the array-literal identity refiring this every render.
  useEffect(() => {
    if (cameraView !== 'first-person' || !fpRef.current) return;
    const cam = fpRef.current;
    _eye.set(L.eye[0], L.eye[1], L.eye[2] - f(3));
    _center.set(center[0], center[1], center[2]);
    eyePos.current.copy(_eye);
    cam.position.copy(_eye);
    // Matrix4.lookAt uses the camera convention (−z toward target); Object3D.lookAt
    // would flip a non-camera dummy 180° and aim us back at the head.
    _lookMat.lookAt(_eye, _center, WORLD_UP);
    baseQuat.current.setFromRotationMatrix(_lookMat);
    cam.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraView, L.eye[1], L.eye[2], center[1], center[2]]);

  // Re-center the gaze on entering first-person and on persona change.
  useEffect(() => {
    yaw.current = 0;
    pitch.current = 0;
  }, [cameraView, personaId]);

  // Drag to look around. Listen on the canvas element directly so r3f's own
  // raycasting (screen/avatar meshes) is left untouched.
  useEffect(() => {
    if (cameraView !== 'first-person') return;
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !last.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      yaw.current = THREE.MathUtils.clamp(yaw.current - dx * LOOK_SENS, -YAW_LIMIT, YAW_LIMIT);
      pitch.current = THREE.MathUtils.clamp(pitch.current - dy * LOOK_SENS, -PITCH_LIMIT, PITCH_LIMIT);
    };
    const onUp = (e: PointerEvent) => {
      dragging.current = false;
      last.current = null;
      el.releasePointerCapture?.(e.pointerId);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.style.cursor = 'grab';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.style.cursor = '';
    };
  }, [cameraView, gl]);

  // Apply the composed orientation (base × yaw × pitch) every frame. Writes only
  // the quaternion — the eye position set above never drifts.
  useFrame(({ camera }) => {
    if (cameraView !== 'first-person') return;
    // Enforce BOTH position and orientation every frame. An unrelated store
    // update (e.g. toggling the type specimen) can re-render the rig and hand
    // r3f a freshly-defaulted camera at the origin; the geometry-keyed effect
    // above won't re-run to reposition it, so without this the view would snap
    // to empty space. Driving position from the ref keeps first-person stable.
    camera.position.copy(eyePos.current);
    _qYaw.setFromAxisAngle(WORLD_UP, yaw.current);
    _qPitch.setFromAxisAngle(RIGHT, pitch.current);
    camera.quaternion.copy(baseQuat.current).multiply(_qYaw).multiply(_qPitch);
  });

  if (cameraView === 'first-person') {
    // Vertical FOV (default ~60°) ≈ natural human perception, so an oversized screen
    // visibly overflows the frame — the "this is overwhelming" moment. Adjustable so
    // the tradeoff between focal cone and peripheral fill can be explored.
    return <PerspectiveCamera ref={fpRef} makeDefault fov={fpFov} near={0.05} far={200} />;
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
