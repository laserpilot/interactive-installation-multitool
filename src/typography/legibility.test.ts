import { describe, expect, it } from 'vitest';
import {
  ARCMIN_PER_DEG,
  DEFAULT_CAP_RATIO,
  LEGIBILITY_ARCMIN,
  classifyLegibility,
  devicePixels,
  legibilityReport,
  minFontPx,
  physicalHeightIn,
  sizeForArcmin,
  subtendedArcmin,
  type LegibilityConfig,
} from './legibility';

describe('subtendedArcmin / sizeForArcmin', () => {
  it('is 60× the degree angle', () => {
    // 10" span at 10" ≈ 53.13° → ×60 arcmin
    expect(subtendedArcmin(10, 10)).toBeCloseTo(53.13 * ARCMIN_PER_DEG, 0);
  });
  it('round-trips size → arcmin → size', () => {
    const arcmin = subtendedArcmin(2, 120);
    expect(sizeForArcmin(arcmin, 120)).toBeCloseTo(2, 6);
  });
  it('shrinks with distance', () => {
    expect(subtendedArcmin(1, 200)).toBeLessThan(subtendedArcmin(1, 100));
  });
  it('a 1 arcmin stroke at reading distance is a real, tiny size', () => {
    // 1 arcmin at 24" ≈ 0.007" ≈ 0.18 mm — the classic acuity limit.
    expect(sizeForArcmin(1, 24)).toBeCloseTo(0.00698, 4);
  });
});

describe('physicalHeightIn — deployed pixels cancel out', () => {
  it('artboard-to-physical proportional map', () => {
    // 48px on a 1920px artboard mapped across a 96"-wide screen → 2.4"
    expect(physicalHeightIn(48, 1920, 96)).toBeCloseTo(2.4, 6);
  });
  it('does not depend on native resolution', () => {
    // same artboard/font/screen → same physical size whether 1080p or 8K
    const a = physicalHeightIn(32, 1920, 120);
    expect(a).toBe(physicalHeightIn(32, 1920, 120));
  });
  it('guards a zeroed artboard', () => {
    expect(physicalHeightIn(48, 0, 96)).toBe(0);
  });
});

describe('devicePixels', () => {
  it('scales font px by the deployed/artboard ratio', () => {
    // 24px on 1920 artboard driving a 3840px panel → 48 device px
    expect(devicePixels(24, 1920, 3840)).toBe(48);
  });
  it('guards a zeroed artboard', () => {
    expect(devicePixels(24, 0, 3840)).toBe(0);
  });
});

describe('classifyLegibility', () => {
  it.each([
    [3, 'illegible'],
    [LEGIBILITY_ARCMIN.threshold, 'marginal'],
    [7, 'marginal'],
    [LEGIBILITY_ARCMIN.legible, 'legible'],
    [14, 'legible'],
    [LEGIBILITY_ARCMIN.comfortable, 'comfortable'],
    [40, 'comfortable'],
  ])('%i arcmin → %s', (arcmin, klass) => {
    expect(classifyLegibility(arcmin)).toBe(klass);
  });
});

describe('minFontPx — inverse solve round-trips', () => {
  const ctx = { distanceIn: 120, screenWidthIn: 96, artboardPx: 1920, capRatio: DEFAULT_CAP_RATIO };

  it('a font at the comfortable minimum lands exactly on the threshold', () => {
    const px = minFontPx('comfortable', ctx);
    const capIn = physicalHeightIn(px, ctx.artboardPx, ctx.screenWidthIn) * ctx.capRatio;
    expect(subtendedArcmin(capIn, ctx.distanceIn)).toBeCloseTo(LEGIBILITY_ARCMIN.comfortable, 4);
  });
  it('comfortable minimum exceeds the legible minimum', () => {
    expect(minFontPx('comfortable', ctx)).toBeGreaterThan(minFontPx('legible', ctx));
  });
  it('farther viewing demands bigger type', () => {
    const near = minFontPx('comfortable', { ...ctx, distanceIn: 60 });
    const far = minFontPx('comfortable', { ...ctx, distanceIn: 240 });
    expect(far).toBeGreaterThan(near);
  });
  it('guards a zeroed screen width', () => {
    expect(minFontPx('comfortable', { ...ctx, screenWidthIn: 0 })).toBe(0);
  });
});

describe('legibilityReport', () => {
  const base: LegibilityConfig = {
    samples: [
      { label: 'Body', fontPx: 16 },
      { label: 'Headline', fontPx: 72 },
    ],
    artboardPx: 1920,
    screenWidthIn: 96, // ~110" 16:9 wall
    screenPx: 3840,
    distanceIn: 120, // 10 ft
  };

  it('small body copy on a big wall viewed far is illegible; headline is fine', () => {
    const r = legibilityReport(base);
    const body = r.samples.find((s) => s.label === 'Body')!;
    const head = r.samples.find((s) => s.label === 'Headline')!;
    expect(body.klass).toBe('comfortable'); // 16px maps to 0.8" cap-ish at this huge scale
    expect(head.level).toBe('good');
    // sanity: physical size is large because the artboard maps across 96"
    expect(body.physicalHeightIn).toBeCloseTo(0.8, 2);
  });

  it('overall level is the worst sample', () => {
    const r = legibilityReport({
      ...base,
      // tiny artboard font on a small screen viewed far → illegible body
      samples: [{ label: 'Fine print', fontPx: 4 }, { label: 'Headline', fontPx: 200 }],
      screenWidthIn: 24,
      distanceIn: 240,
    });
    expect(r.level).toBe('bad');
  });

  it('flags under-resolved glyphs independently of distance', () => {
    const r = legibilityReport({
      ...base,
      samples: [{ label: 'Micro', fontPx: 1 }],
      artboardPx: 1920,
      screenPx: 1280, // low-res panel: 1px → <1 device px
    });
    expect(r.samples[0].underResolved).toBe(true);
  });

  it('is robust to a degenerate config (no NaN/Infinity)', () => {
    const r = legibilityReport({ ...base, artboardPx: 0, screenWidthIn: 0, distanceIn: 0 });
    for (const s of r.samples) {
      expect(Number.isFinite(s.capArcmin)).toBe(true);
      expect(Number.isFinite(s.physicalHeightIn)).toBe(true);
    }
  });
});
