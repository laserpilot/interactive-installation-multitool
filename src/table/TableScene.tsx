import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PERSONAS, type Persona } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { tableReach } from '../ergonomics/tableEngine';
import { MARBLE, MODELS, type ModelCfg } from '../scene/GltfAvatar';
import { f } from '../scene/scale';
import { makeTestPattern } from '../scene/testPattern';
import { useConfigStore } from '../store/useConfigStore';
import { makeReachHeatmap } from './reachHeatmap';

// The horizontal table 3D stage. The screen lies FACE-UP on a tabletop at the
// surface height; a border/bezel frames it; the user(s) stand at the edge(s).
// Self-contained Canvas (each tab owns its own, like placement/projection).

const STAND_GAP = 8; // in, how far behind the table edge a figure stands

// Table-specific avatar: a figure bent over, looking down, arm outstretched to
// point at the surface — the right posture for reaching across a flat table
// (the wall MODELS reach at a vertical screen). Standing personas use it; the
// seated user keeps its own wheelchair model. Tweak rot/faceYaw/lift here.
const BASE = import.meta.env.BASE_URL;
const TABLE_ADULT: ModelCfg = {
  url: `${BASE}adult_table.glb`,
  rot: [0, 0, 0], // uprighting — adjust if the export lies down
  faceYaw: Math.PI, // turn to face the table centre (−Z)
  handGap: 0,
};
const TABLE_MODELS: Partial<Record<string, ModelCfg>> = {
  adult: TABLE_ADULT,
  child: TABLE_ADULT,
  wheelchair: MODELS.wheelchair,
};

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#aab2bd', 1.5]} />
      <directionalLight position={[6, 14, 9]} intensity={1.4} castShadow />
      <directionalLight position={[-8, 8, 6]} intensity={0.5} />
    </>
  );
}

function Floor() {
  return (
    <>
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
        position={[0, 0.002, 0]}
      />
    </>
  );
}

/** Tabletop slab (screen + border) + pedestal, screen + reach heatmap on top. */
function Table({
  widthFt,
  depthFt,
  bezelFt,
  topY,
}: {
  widthFt: number;
  depthFt: number;
  bezelFt: number;
  topY: number;
}) {
  const { diagonal, aspectW, aspectH, tableHeight, tableBezel, personaId, tableShowReach } =
    useConfigStore();
  const pattern = useMemo(
    () => makeTestPattern(aspectW, aspectH, diagonal),
    [aspectW, aspectH, diagonal],
  );
  useEffect(() => () => pattern.dispose(), [pattern]);

  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const depthMax = tableReach(PERSONAS[personaId], tableHeight, size.height, tableBezel).depthMax;
  const heat = useMemo(
    () => makeReachHeatmap(size.width, size.height, tableBezel, depthMax),
    [size.width, size.height, tableBezel, depthMax],
  );
  useEffect(() => () => heat.dispose(), [heat]);

  const slabThk = f(1.5);
  const legH = Math.max(0.1, topY - slabThk);
  const slabW = widthFt + 2 * bezelFt;
  const slabD = depthFt + 2 * bezelFt;

  return (
    <group>
      {/* tabletop slab incl. the border (top face at topY) */}
      <mesh position={[0, topY - slabThk / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[slabW, slabThk, slabD]} />
        <meshStandardMaterial color="#3a4048" />
      </mesh>
      {/* pedestal column + base — central, leaving knee room at the edges */}
      <mesh position={[0, legH / 2, 0]} castShadow>
        <boxGeometry args={[f(8), legH, f(8)]} />
        <meshStandardMaterial color="#5a6470" />
      </mesh>
      <mesh position={[0, f(0.6), 0]} castShadow>
        <boxGeometry args={[f(22), f(1.2), f(22)]} />
        <meshStandardMaterial color="#4a525c" />
      </mesh>

      {/* active screen, face-up */}
      <mesh position={[0, topY + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[widthFt, depthFt]} />
        <meshBasicMaterial map={pattern} toneMapped={false} />
      </mesh>
      {/* reach heatmap, just above the screen */}
      {tableShowReach && (
        <mesh position={[0, topY + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[widthFt, depthFt]} />
          <meshBasicMaterial map={heat} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** A GLB figure standing at a seat around the table, facing the surface. */
function TableFigure({
  cfg,
  persona,
  pos,
  yaw,
}: {
  cfg: ModelCfg;
  persona: Persona;
  pos: [number, number];
  yaw: number;
}) {
  const { scene } = useGLTF(cfg.url);
  const prep = useMemo(() => {
    const root = skeletonClone(scene) as THREE.Object3D;
    root.traverse((o) => {
      const any = o as unknown as { isLight?: boolean; isCamera?: boolean; isMesh?: boolean };
      if (any.isLight || any.isCamera) o.visible = false;
      if (any.isMesh) {
        (o as THREE.Mesh).material = MARBLE;
        o.castShadow = true;
        (o as THREE.Mesh).frustumCulled = false;
      }
    });
    root.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
    const holder = new THREE.Group();
    holder.add(root);
    holder.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    return { holder, center: box.getCenter(new THREE.Vector3()), min: box.min.clone(), height: size.y };
  }, [scene, cfg.rot]);

  const scale = f(persona.statureHeight) / prep.height;
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, cfg.faceYaw + yaw, 0]}>
      <group
        scale={scale}
        position={[-prep.center.x * scale, -prep.min.y * scale, -prep.center.z * scale]}
      >
        <primitive object={prep.holder} />
      </group>
    </group>
  );
}

class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Seats around the table facing the centre, filled front→back→left→right with up
 * to 2 on each long side and 1 on each short side. Front side is the user side
 * (+z). `yaw` turns the model (which faces −z) to face the centre.
 */
function seatPositions(
  n: number,
  widthFt: number,
  depthFt: number,
  bezelFt: number,
): { pos: [number, number]; yaw: number }[] {
  const halfW = widthFt / 2 + bezelFt + f(STAND_GAP);
  const halfD = depthFt / 2 + bezelFt + f(STAND_GAP);
  const counts = { front: 0, back: 0, left: 0, right: 0 };
  const order: (keyof typeof counts)[] = ['front', 'back', 'left', 'right', 'front', 'back'];
  for (let i = 0; i < Math.min(n, 6); i++) counts[order[i]]++;

  const seats: { pos: [number, number]; yaw: number }[] = [];
  // 0 → none, 1 → centred, 2 → split across the long side.
  const longX = (c: number) => (c <= 0 ? [] : c === 1 ? [0] : [-widthFt / 4, widthFt / 4]);
  for (const x of longX(counts.front)) seats.push({ pos: [x, halfD], yaw: 0 }); // face −z
  for (const x of longX(counts.back)) seats.push({ pos: [x, -halfD], yaw: Math.PI }); // face +z
  if (counts.left) seats.push({ pos: [-halfW, 0], yaw: -Math.PI / 2 }); // face +x
  if (counts.right) seats.push({ pos: [halfW, 0], yaw: Math.PI / 2 }); // face −x
  return seats;
}

function Figures({ widthFt, depthFt, bezelFt }: { widthFt: number; depthFt: number; bezelFt: number }) {
  const personaId = useConfigStore((s) => s.personaId);
  const seats = useConfigStore((s) => s.tableSeats);
  const cfg = TABLE_MODELS[personaId] ?? MODELS[personaId];
  const positions = seatPositions(seats, widthFt, depthFt, bezelFt);
  if (!cfg) return null;
  return (
    <ModelBoundary key={personaId}>
      <Suspense fallback={null}>
        {positions.map((s, i) => (
          <TableFigure key={i} cfg={cfg} persona={PERSONAS[personaId]} pos={s.pos} yaw={s.yaw} />
        ))}
      </Suspense>
    </ModelBoundary>
  );
}

function CameraRig({ widthFt, depthFt, topY }: { widthFt: number; depthFt: number; topY: number }) {
  const dist = Math.max(widthFt, depthFt);
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={45}
        position={[Math.max(6, widthFt) + 2, topY + 5, depthFt / 2 + dist + 7]}
      />
      <OrbitControls target={[0, topY, 0]} maxPolarAngle={Math.PI / 2} />
    </>
  );
}

export function TableScene() {
  const { diagonal, aspectW, aspectH, tableHeight, tableBezel } = useConfigStore();
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const widthFt = f(size.width); // along x, the near edge
  const depthFt = f(size.height); // along z, reach-across
  const bezelFt = f(tableBezel);
  const topY = f(tableHeight);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      style={{ background: 'linear-gradient(180deg,#dfe4ea 0%,#bcc4ce 55%,#9ca5b0 100%)' }}
    >
      <CameraRig widthFt={widthFt} depthFt={depthFt + 2 * bezelFt} topY={topY} />
      <Lights />
      <Floor />
      <Table widthFt={widthFt} depthFt={depthFt} bezelFt={bezelFt} topY={topY} />
      <Figures widthFt={widthFt} depthFt={depthFt} bezelFt={bezelFt} />
    </Canvas>
  );
}
