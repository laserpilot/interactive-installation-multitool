import * as THREE from 'three';
import {
  splToRgb,
  uniformityToRgb,
  TARGET_CENTER,
  type CoverageField,
  type UseCaseDef,
} from './speakerMath';
import type { CoverageView } from '../store/useConfigStore';

/**
 * Paint the ear-height coverage field into a canvas texture. Two views share the
 * field:
 *   • 'spl' colours each cell by its absolute level (cold→green→hot via the
 *     scenario-anchored ramp), fading out below the audible floor so the room
 *     shows through where nothing reaches.
 *   • 'uniformity' colours by how far the cell sits from the target centre level
 *     (green on-target → red ≥6 dB off) — the ±3 dB evenness view.
 * Row 0 of the field is the far (+z) edge; `flipY=false` keeps that at UV v=0.
 */
export function makeCoverageTexture(
  field: CoverageField,
  view: CoverageView,
  u: UseCaseDef,
): THREE.CanvasTexture {
  const n = field.n;
  const center = TARGET_CENTER(u);
  const floor = u.minDba;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < field.data.length; i++) {
    const dba = field.data[i];
    const audible = dba >= floor;
    const [r, g, b] =
      view === 'uniformity' ? uniformityToRgb(dba - center) : splToRgb(dba, u);
    img.data[i * 4 + 0] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    // Below the floor, the SPL view fades out (nothing usable here); the
    // uniformity view also drops it (off-target by definition, but not actionable).
    img.data[i * 4 + 3] = audible ? 210 : 0;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
