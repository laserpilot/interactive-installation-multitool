import * as THREE from 'three';

// A reach heatmap painted over the screen: how easily the user at the table edge
// can touch each point. Green = comfortable, amber → red toward the arm's limit,
// faint grey beyond reach. The reach origin is the table's outer edge (centre of
// the near side); the screen is offset back by the border `bezel`, so points are
// measured from `bezel` in. Mirrors the projection heatmap's CanvasTexture style.

type RGBA = [number, number, number, number];

// Comfort ramp by normalized reach t = distance / maxReach.
function rampColor(t: number): RGBA {
  if (t > 1) return [120, 130, 140, 70]; // beyond reach — faint grey
  const a = 150; // translucent so the content shows through
  if (t <= 0.6) {
    // easy: green → yellow-green
    const k = t / 0.6;
    return [Math.round(40 + 180 * k), Math.round(170 + 20 * k), 60, a];
  }
  if (t <= 0.85) {
    // reaching: yellow → orange
    const k = (t - 0.6) / 0.25;
    return [Math.round(220 + 20 * k), Math.round(190 - 70 * k), 50, a];
  }
  // straining: orange → red at the limit
  const k = (t - 0.85) / 0.15;
  return [Math.round(240 - 20 * k), Math.round(120 - 70 * k), Math.round(50 - 10 * k), a];
}

/**
 * @param widthIn   screen width (along the near edge)
 * @param depthIn   screen depth (reach-across dimension)
 * @param bezelIn   border between the user's edge and the screen
 * @param maxReachIn  max horizontal reach from the user's edge (TableReach.depthMax)
 */
export function makeReachHeatmap(
  widthIn: number,
  depthIn: number,
  bezelIn: number,
  maxReachIn: number,
): THREE.CanvasTexture {
  const W = 220;
  const H = Math.max(24, Math.min(220, Math.round((W * depthIn) / Math.max(1, widthIn))));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const maxR = Math.max(1e-3, maxReachIn);

  for (let py = 0; py < H; py++) {
    // py = 0 is the NEAR edge (user side); depth into the screen grows downward.
    const dn = (py / (H - 1 || 1)) * depthIn;
    const depthFromUser = bezelIn + dn;
    for (let px = 0; px < W; px++) {
      const x = (px / (W - 1 || 1) - 0.5) * widthIn;
      const dist = Math.hypot(x, depthFromUser);
      const [r, g, b, a] = rampColor(dist / maxR);
      const i = (py * W + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false; // row 0 = near edge, aligned by the plane orientation
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
