import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { makeTestPatternCanvas } from '../scene/testPattern';
import { useConfigStore } from '../store/useConfigStore';
import { makeHeatmapTexture } from './heatmapTexture';
import {
  illuminanceField,
  type FrustumGeometry,
  type Vec3,
} from './projectionMath';

const LIFT = 0.012; // nudge the lit quad just in front of the wall

/** Build a quad mesh from the four landed corners, with UVs for the texture.
 *  `uRange` maps the quad onto a horizontal slice [u0,u1] of the content — the
 *  array uses it so each projector shows its own band of one spanning image. */
function quadGeometry(g: FrustumGeometry, uRange: [number, number]): THREE.BufferGeometry {
  const corners: Vec3[] = [g.topLeft, g.topRight, g.bottomRight, g.bottomLeft];
  const positions = new Float32Array(
    corners.flatMap((c) => [c[0], c[1], c[2] + LIFT]),
  );
  const [u0, u1] = uRange;
  // TL(0,0) TR(1,0) BR(1,1) BL(0,1) — v=0 is the top, matching the field rows.
  const uvs = new Float32Array([u0, 0, u1, 0, u1, 1, u0, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex([0, 3, 2, 0, 2, 1]);
  geo.computeVertexNormals();
  return geo;
}

export function ProjectionSurface({
  geom,
  footCandles,
  uRange = [0, 1],
}: {
  geom: FrustumGeometry;
  footCandles: number;
  /** Horizontal slice of the content this projector covers (array mode). The
   *  heatmap always uses the full [0,1] field — only content is sliced. */
  uRange?: [number, number];
}) {
  const view = useConfigStore((s) => s.projSurfaceView);
  const contentUrl = useConfigStore((s) => s.contentUrl);
  const aspectW = useConfigStore((s) => s.projAspectW);
  const aspectH = useConfigStore((s) => s.projAspectH);

  // Heatmap is a per-projector field (full quad); only content maps to a slice.
  const [u0, u1] = view === 'content' ? uRange : [0, 1];
  const geo = useMemo(() => quadGeometry(geom, [u0, u1]), [geom, u0, u1]);
  useEffect(() => () => geo.dispose(), [geo]);

  const heatTex = useMemo(() => {
    const field = illuminanceField(geom, footCandles, 40);
    return makeHeatmapTexture(field);
  }, [geom, footCandles]);
  useEffect(() => () => heatTex.dispose(), [heatTex]);

  // Content texture: uploaded image, or the procedural test pattern.
  const contentTex = useMemo(() => {
    const canvas = makeTestPatternCanvas(aspectW, aspectH, 100);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [aspectW, aspectH]);
  useEffect(() => () => contentTex.dispose(), [contentTex]);

  useEffect(() => {
    if (view !== 'content' || !contentUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      contentTex.image = canvas;
      contentTex.needsUpdate = true;
    };
    img.src = contentUrl;
  }, [view, contentUrl, contentTex]);

  const map = view === 'content' ? contentTex : heatTex;

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial map={map} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}
