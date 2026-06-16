import { describe, expect, it } from 'vitest';
import {
  classifyAngle,
  reachBand,
  recommendMountBottom,
  sizeFromDiagonal,
  subtendedAngle,
  verdict,
  type ScreenConfig,
} from './engine';

describe('geometry', () => {
  it('derives 16:9 width/height from a diagonal', () => {
    const s = sizeFromDiagonal(55, 16, 9);
    expect(s.width).toBeCloseTo(47.94, 1);
    expect(s.height).toBeCloseTo(26.96, 1);
    // round-trips back to the diagonal
    expect(Math.hypot(s.width, s.height)).toBeCloseTo(55, 5);
  });
});

describe('subtended angle', () => {
  it('matches the 65" @ 1ft horror case (~134°)', () => {
    const s = sizeFromDiagonal(65, 16, 9);
    const a = subtendedAngle(s.width, 12);
    expect(a).toBeGreaterThan(120);
    expect(classifyAngle(a)).toBe('bad');
  });

  it('a 55" at 8ft is comfortable', () => {
    const s = sizeFromDiagonal(55, 16, 9);
    const a = subtendedAngle(s.width, 96);
    expect(a).toBeLessThan(35);
    expect(['ideal', 'ok']).toContain(classifyAngle(a));
  });
});

describe('reach band', () => {
  it('a screen mounted with its bottom at 50" AFF is unreachable (ADA)', () => {
    const s = sizeFromDiagonal(55, 16, 9);
    const r = reachBand(50, s.height, 15, 48);
    expect(r.reachableFraction).toBe(0);
    expect(r.fullyReachable).toBe(false);
    expect(r.bottomReachable).toBe(false);
  });

  it('centers a short screen in the band', () => {
    const bottom = recommendMountBottom(20, 15, 48);
    // band center is 31.5, screen 20 tall => bottom at 21.5
    expect(bottom).toBeCloseTo(21.5, 5);
  });

  it('drops a tall screen to the band floor', () => {
    expect(recommendMountBottom(60, 15, 48)).toBe(15);
  });
});

describe('verdict', () => {
  it('flags the 12ft LED wall touchscreen as a bad idea', () => {
    const cfg: ScreenConfig = {
      size: sizeFromDiagonal((144 / 16) * Math.hypot(16, 9), 16, 9), // 144" wide
      mountBottom: 0,
      mode: 'touch',
      viewingDistance: 25,
      personaId: 'adult',
      pitchMm: 3.9,
    };
    const v = verdict(cfg);
    expect(v.level).toBe('bad');
    // it should give multiple distinct reasons: angle, reach, pixels
    expect(v.reasons.length).toBeGreaterThanOrEqual(3);
    expect(v.horizontalAngle).toBeGreaterThan(120);
    expect(v.adaReach.reachableFraction).toBeLessThan(0.5);
    expect(v.reasons.some((r) => /ADA reach band/.test(r.text))).toBe(true);
    expect(v.reasons.some((r) => /wall/.test(r.text))).toBe(true);
  });

  it('passes a well-placed 55" view-only display', () => {
    const cfg: ScreenConfig = {
      size: sizeFromDiagonal(55, 16, 9),
      mountBottom: 42,
      mode: 'view',
      viewingDistance: 96,
      personaId: 'adult',
      horizontalPixels: 3840,
    };
    const v = verdict(cfg);
    expect(v.level).toBe('good');
    expect(v.angleClass === 'ideal' || v.angleClass === 'ok').toBe(true);
  });
});
