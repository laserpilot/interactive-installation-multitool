import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PERSONAS, type Persona, type PersonaId } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { useConfigStore } from '../store/useConfigStore';
import { Avatar } from './Avatar';
import { avatarLayout } from './avatarLayout';
import { ReachEnvelope } from './ReachEnvelope';
import { f } from './scale';

type ModelCfg = {
  url: string;
  /** Euler radians applied to the model to STAND IT UPRIGHT. */
  rot: [number, number, number];
  /** World-Y turn applied after uprighting, to FACE THE WALL (−Z). */
  faceYaw: number;
  /** Inches to nudge the figure toward the wall so the posed hand meets the
   *  glass (per-model, since arm poses differ). Cosmetic only. */
  handGap: number;
};

// Each export comes out of Blender in its own orientation, so orientation is
// per-model: `rot` stands it up, `faceYaw` turns it to face the wall. Decoupling
// the two makes "facing" a single independent knob.
// Prefix with Vite's base URL so model paths resolve under the GitHub Pages
// subpath (/<repo>/) — runtime string URLs aren't rewritten by the bundler.
const BASE = import.meta.env.BASE_URL;
const MODELS: Partial<Record<PersonaId, ModelCfg>> = {
  adult: { url: `${BASE}adult.glb`, rot: [0, 0, 0], faceYaw: Math.PI, handGap: 5 },
  child: { url: `${BASE}child.glb`, rot: [Math.PI, 0, 0], faceYaw: Math.PI, handGap: 5 },
  // seated model includes its own seat (Cube); native upright like the adult.
  wheelchair: { url: `${BASE}seated_adult.glb`, rot: [0, 0, 0], faceYaw: Math.PI, handGap: 1 },
};

// Off-white matte "marble / Corian" look, overriding whatever the export shipped.
const MARBLE = new THREE.MeshStandardMaterial({
  color: '#e9e6e0',
  roughness: 0.72,
  metalness: 0.0,
});


function GltfAvatar({ cfg, persona }: { cfg: ModelCfg; persona: Persona }) {
  const { scene } = useGLTF(cfg.url);
  const { mode, viewingDistance, diagonal, aspectW, aspectH, mountBottom, tiltDeg } =
    useConfigStore();

  // Clone (skeleton-aware), strip lights/cameras, apply marble, orient per the
  // model's config, then measure the normalized bounding box once per asset.
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

  const screen = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const distance = mode === 'touch' ? persona.touchDistance : viewingDistance;
  const L = avatarLayout(persona, distance, mountBottom, mountBottom + screen.height, tiltDeg);

  const scale = f(persona.statureHeight) / prep.height;
  const bodyZ = L.z - f(cfg.handGap);

  return (
    <group>
      <group position={[0, 0, bodyZ]} rotation={[0, cfg.faceYaw, 0]}>
        <group
          scale={scale}
          position={[-prep.center.x * scale, -prep.min.y * scale, -prep.center.z * scale]}
        >
          <primitive object={prep.holder} />
        </group>
      </group>

      <ReachEnvelope shoulder={L.shoulder} hand={L.hand} armLen={L.armLen} touches={L.touches} />
    </group>
  );
}

/** Render-error boundary: if a model fails to load/parse, show the fallback. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Picks the GLB model for the active persona, else the primitive figure. */
export function AvatarSwitch() {
  const personaId = useConfigStore((s) => s.personaId);
  const cfg = MODELS[personaId];
  if (!cfg) return <Avatar />;
  return (
    <ModelBoundary key={personaId} fallback={<Avatar />}>
      <Suspense fallback={null}>
        <GltfAvatar cfg={cfg} persona={PERSONAS[personaId]} />
      </Suspense>
    </ModelBoundary>
  );
}
