import * as THREE from 'three';

/**
 * Procedurally draw a recognizable broadcast-style test pattern sized to the
 * screen's aspect ratio, so the default (un-uploaded) screen is bright, clearly
 * legible, and shows how content scales. No external asset needed.
 */
export function makeTestPattern(
  aspectW: number,
  aspectH: number,
  diagonalIn: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(
    makeTestPatternCanvas(aspectW, aspectH, diagonalIn),
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The raw canvas behind {@link makeTestPattern}, for consumers (e.g. the LED Display
 * WebGL preview) that need a DOM image source rather than a Three texture.
 */
export function makeTestPatternCanvas(
  aspectW: number,
  aspectH: number,
  diagonalIn: number,
): HTMLCanvasElement {
  const LONG = 1024;
  // Sanitize the aspect: a zeroed / NaN / wildly lopsided ratio would collapse a
  // dimension toward 0, which makes the grid step below round to 0 — and a
  // `for (… ; … ; += 0)` loop never terminates, freezing the tab. Fall back to
  // 16:9 for nonsense, and clamp so neither side can shrink below a few pixels.
  const aw = Number.isFinite(aspectW) && aspectW > 0 ? aspectW : 16;
  const ah = Number.isFinite(aspectH) && aspectH > 0 ? aspectH : 9;
  const landscape = aw >= ah;
  const w = Math.max(16, landscape ? LONG : Math.round((LONG * aw) / ah));
  const h = Math.max(16, landscape ? Math.round((LONG * ah) / aw) : LONG);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // base
  ctx.fillStyle = '#0e1216';
  ctx.fillRect(0, 0, w, h);

  // SMPTE-ish vertical colour bars across the top ~62%
  const bars = ['#ffffff', '#ffe000', '#00e0e0', '#00c853', '#e000e0', '#e00000', '#2030ff'];
  const barH = h * 0.62;
  const bw = w / bars.length;
  bars.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * bw, 0, Math.ceil(bw) + 1, barH);
  });

  // greyscale step strip below the bars
  const stripY = barH;
  const stripH = h * 0.12;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect((i * w) / steps, stripY, Math.ceil(w / steps) + 1, stripH);
  }

  // alignment grid over the whole frame
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  const grid = Math.max(1, Math.round(Math.min(w, h) / 10));
  for (let x = grid; x < w; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = grid; y < h; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }

  // centre crosshair + circle
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.3;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 1.2, cy);
  ctx.lineTo(cx + r * 1.2, cy);
  ctx.moveTo(cx, cy - r * 1.2);
  ctx.lineTo(cx, cy + r * 1.2);
  ctx.stroke();

  // corner registration marks
  const m = Math.round(Math.min(w, h) * 0.06);
  ctx.lineWidth = 3;
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ];
  corners.forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * 6, y + sy * 6);
    ctx.lineTo(x + sx * m, y + sy * 6);
    ctx.moveTo(x + sx * 6, y + sy * 6);
    ctx.lineTo(x + sx * 6, y + sy * m);
    ctx.stroke();
  });

  // labels
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(Math.min(w, h) * 0.085)}px -apple-system, sans-serif`;
  ctx.fillText(`${Math.round(diagonalIn)}"  ${aspectW}:${aspectH}`, cx, cy - r * 0.42);
  ctx.font = `${Math.round(Math.min(w, h) * 0.05)}px -apple-system, sans-serif`;
  ctx.fillText('TEST PATTERN', cx, cy + r * 0.45);

  return canvas;
}
