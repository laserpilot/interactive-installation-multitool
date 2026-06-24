import * as THREE from 'three';
import { confRgb, type TrackableField } from './sensorMath';

const HIDE_BELOW = 0.04; // scores this low read as "not tracked" → transparent

/**
 * Paint the trackable-zone field into a canvas texture: each cell coloured by
 * its whole-body trackability score (red→amber→green via the shared confidence
 * ramp), fading to transparent where a standing person would not be tracked so
 * the floor shows through. Row 0 of the field is the far (+z) edge; `flipY=false`
 * keeps that at UV v=0.
 */
export function makeZoneTexture(field: TrackableField): THREE.CanvasTexture {
  const n = field.n;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < field.data.length; i++) {
    const score = field.data[i];
    const [r, g, b] = confRgb(score);
    img.data[i * 4 + 0] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = score < HIDE_BELOW ? 0 : 205;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
