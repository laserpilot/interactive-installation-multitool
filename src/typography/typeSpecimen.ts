import * as THREE from 'three';
import type { TypeSample } from './legibility';

export interface SpecimenOpts {
  samples: TypeSample[];
  text: string;
  artboardPx: number; // artboard width; sample fontPx are in these units
  aspectW: number;
  aspectH: number;
}

const MAX_CANVAS = 2048; // cap the raster so a huge artboard doesn't allocate wildly

/**
 * Draw the type samples onto a canvas whose pixel grid IS the artboard, so a
 * `fontPx` sample is rendered at exactly `fontPx` (times a clamp scale for very
 * wide artboards). Mapped 1:1 across the screen face, the first-person camera
 * then shows every line at its true angular size — the whole point of the tool.
 */
export function makeTypeSpecimenCanvas(opts: SpecimenOpts): HTMLCanvasElement {
  const aw = Number.isFinite(opts.aspectW) && opts.aspectW > 0 ? opts.aspectW : 16;
  const ah = Number.isFinite(opts.aspectH) && opts.aspectH > 0 ? opts.aspectH : 9;
  const artboard = Number.isFinite(opts.artboardPx) && opts.artboardPx > 0 ? opts.artboardPx : 1920;

  // Everything is authored in artboard px, then multiplied by `scale` so the
  // backing raster stays within MAX_CANVAS. Proportions are preserved exactly.
  const scale = Math.min(1, MAX_CANVAS / artboard);
  const w = Math.max(16, Math.round(artboard * scale));
  const h = Math.max(16, Math.round((artboard * (ah / aw)) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Neutral dark ground, like a powered display; light type for contrast.
  ctx.fillStyle = '#0e1216';
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(artboard * 0.03 * scale);
  const text = opts.text || 'The quick brown fox';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  let y = pad;
  for (const s of opts.samples) {
    const fontPx = Math.max(1, s.fontPx) * scale;
    // Small caption above each line so the specimen is self-labelling.
    const capPx = Math.max(9 * scale, artboard * 0.008 * scale);
    ctx.fillStyle = '#7d8794';
    ctx.font = `${Math.round(capPx)}px -apple-system, system-ui, sans-serif`;
    y += capPx * 1.2;
    ctx.fillText(`${s.label} — ${Math.round(s.fontPx)}px`, pad, y);

    // The sample line at true size.
    ctx.fillStyle = '#f2f5f8';
    ctx.font = `${Math.round(fontPx)}px -apple-system, system-ui, sans-serif`;
    y += fontPx;
    ctx.fillText(text, pad, y);
    y += fontPx * 0.35; // gap before the next block

    if (y > h) break; // ran off the artboard — stop cleanly
  }

  return canvas;
}

/** Three texture wrapper, mirroring makeTestPattern. */
export function makeTypeSpecimen(opts: SpecimenOpts): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(makeTypeSpecimenCanvas(opts));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
