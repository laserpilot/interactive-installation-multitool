import { describe, expect, it } from 'vitest';
import { dvledMetrics } from './optics';
import { sizeFromDiagonal } from '../ergonomics/engine';

// A 12 ft (165") 16:9 LED wall, ~2.5 mm pitch — the README's cautionary example.
const wall = sizeFromDiagonal(165, 16, 9);

describe('dvledMetrics', () => {
  it('derives native LED count from physical size and pitch', () => {
    const m = dvledMetrics(wall.width, wall.height, 2.5, 120, 40);
    // width in mm / pitch
    const expectedCols = (wall.width * 25.4) / 2.5;
    expect(m.nativeCols).toBeCloseTo(expectedCols, 1);
    expect(m.nativeRows).toBeCloseTo((wall.height * 25.4) / 2.5, 1);
  });

  it('cells shrink in the visual field as the viewer backs away', () => {
    const near = dvledMetrics(wall.width, wall.height, 2.5, 24, 40);
    const far = dvledMetrics(wall.width, wall.height, 2.5, 240, 40);
    expect(far.cellAngleDeg).toBeLessThan(near.cellAngleDeg);
    expect(far.ppd).toBeGreaterThan(near.ppd);
  });

  it('flags pixels visible up close, clean/retina far away', () => {
    const close = dvledMetrics(wall.width, wall.height, 2.5, 18, 40);
    const back = dvledMetrics(wall.width, wall.height, 2.5, 400, 40);
    expect(close.perceived).toBe('pixelated');
    expect(['clean', 'retina']).toContain(back.perceived);
  });

  it('the visible slice grows with distance and eventually contains the whole wall', () => {
    const close = dvledMetrics(wall.width, wall.height, 2.5, 24, 40);
    const back = dvledMetrics(wall.width, wall.height, 2.5, 600, 40);
    expect(close.viewSpanWidthIn).toBeLessThan(back.viewSpanWidthIn);
    expect(close.fillsFrame).toBe(true); // zoomed into a slice
    expect(back.fillsFrame).toBe(false); // whole wall now sits inside the FOV
  });

  it('retina distance scales with pitch (~1 arcmin rule)', () => {
    const fine = dvledMetrics(wall.width, wall.height, 1.2, 120, 40);
    const coarse = dvledMetrics(wall.width, wall.height, 4, 120, 40);
    expect(coarse.retinaDistanceM).toBeGreaterThan(fine.retinaDistanceM);
    // P2.5 ⇒ a cell is 1 arcmin at ~8.6 m.
    const p25 = dvledMetrics(wall.width, wall.height, 2.5, 120, 40);
    expect(p25.retinaDistanceM).toBeCloseTo(8.59, 1);
  });
});
