import { describe, expect, it } from 'vitest';
import {
  classifyAngle,
  comfortableStandoff,
  pixelMetrics,
  reachBand,
  recommendMountBottom,
  sizeFromDiagonal,
  subtendedAngle,
  verdict,
  type ScreenConfig,
} from './engine';

const w169 = (diag: number) => sizeFromDiagonal(diag, 16, 9);

// Build a verdict config with sensible defaults; override per test.
function cfg(over: Partial<ScreenConfig> & { diag?: number; aw?: number; ah?: number } = {}): ScreenConfig {
  const { diag = 55, aw = 16, ah = 9, ...rest } = over;
  return {
    size: sizeFromDiagonal(diag, aw, ah),
    mountBottom: 24,
    mode: 'touch',
    viewingDistance: 96,
    personaId: 'adult',
    ...rest,
  };
}

const hasBad = (v: ReturnType<typeof verdict>) => v.reasons.some((r) => r.level === 'bad');

describe('geometry', () => {
  it.each([
    [55, 16, 9, 47.94, 26.96],
    [42, 16, 9, 36.61, 20.59],
    [65, 16, 9, 56.65, 31.87],
    [32, 9, 16, 15.68, 27.88], // portrait
    [60, 4, 3, 48.0, 36.0],
    [50, 1, 1, 35.36, 35.36], // square
    [50, 21, 9, 45.96, 19.7], // ultrawide
  ])('%i" %i:%i → %f × %f', (d, aw, ah, ew, eh) => {
    const s = sizeFromDiagonal(d, aw, ah);
    expect(s.width).toBeCloseTo(ew, 1);
    expect(s.height).toBeCloseTo(eh, 1);
    expect(Math.hypot(s.width, s.height)).toBeCloseTo(d, 4); // round-trips diagonal
  });
});

describe('subtendedAngle', () => {
  it('width = distance → 53.13°', () => {
    expect(subtendedAngle(10, 10)).toBeCloseTo(53.13, 1);
  });
  it('width = 2·distance → 90°', () => {
    expect(subtendedAngle(20, 10)).toBeCloseTo(90, 4);
  });
  it('shrinks with distance', () => {
    expect(subtendedAngle(40, 100)).toBeLessThan(subtendedAngle(40, 50));
  });
  it('degenerate distance is clamped, not NaN/Infinity', () => {
    expect(subtendedAngle(40, 0)).toBe(180);
  });
});

describe('classifyAngle — strict thresholds', () => {
  it.each([
    [30, 'ideal'], [31, 'ok'], [40, 'ok'], [41, 'caution'], [55, 'caution'], [56, 'bad'],
  ])('strict view %i° → %s', (deg, cls) => {
    expect(classifyAngle(deg, 'view', 'strict')).toBe(cls);
  });
  it.each([
    [55, 'ideal'], [56, 'ok'], [85, 'ok'], [86, 'caution'], [105, 'caution'], [106, 'bad'],
  ])('strict touch %i° → %s', (deg, cls) => {
    expect(classifyAngle(deg, 'touch', 'strict')).toBe(cls);
  });
});

describe('classifyAngle — realistic thresholds (default)', () => {
  it.each([
    [35, 'ideal'], [36, 'ok'], [45, 'ok'], [46, 'caution'], [62, 'caution'], [63, 'bad'],
  ])('realistic view %i° → %s', (deg, cls) => {
    expect(classifyAngle(deg, 'view')).toBe(cls);
  });
  it.each([
    [70, 'ideal'], [71, 'ok'], [100, 'ok'], [101, 'caution'], [120, 'caution'], [121, 'bad'],
  ])('realistic touch %i° → %s', (deg, cls) => {
    expect(classifyAngle(deg, 'touch')).toBe(cls);
  });
  it('a 55" touch screen at arm’s length (~88°) is FINE realistically, caution strictly', () => {
    expect(classifyAngle(88, 'touch', 'realistic')).toBe('ok');
    expect(classifyAngle(88, 'touch', 'strict')).toBe('caution');
  });
});

describe('comfortableStandoff', () => {
  it('is the distance at which the screen subtends ~40°', () => {
    const s = w169(55);
    const d = comfortableStandoff(s.width);
    expect(subtendedAngle(s.width, d)).toBeCloseTo(40, 4);
  });
});

describe('reachBand', () => {
  it('fully inside the band', () => {
    const r = reachBand(20, 20, 15, 48); // 20→40, inside 15–48
    expect(r.reachableFraction).toBe(1);
    expect(r.fullyReachable).toBe(true);
  });
  it('partially above the band', () => {
    const r = reachBand(40, 20, 15, 48); // 40→60, only 40–48 reachable
    expect(r.reachableFraction).toBeCloseTo(8 / 20, 5);
  });
  it('entirely above the band is unreachable', () => {
    const r = reachBand(50, 20, 15, 48);
    expect(r.reachableFraction).toBe(0);
    expect(r.bottomReachable).toBe(false);
  });
  it('entirely below the band is unreachable', () => {
    const r = reachBand(0, 10, 15, 48); // 0→10, below 15
    expect(r.reachableFraction).toBe(0);
  });
  it('exact boundary touch counts as in-band', () => {
    const r = reachBand(15, 33, 15, 48); // 15→48 exactly fills band
    expect(r.reachableFraction).toBeCloseTo(1, 5);
    expect(r.fullyReachable).toBe(true);
  });
});

describe('recommendMountBottom', () => {
  it('touch: centers a short screen in the ADA band', () => {
    expect(recommendMountBottom(20, 'touch')).toBeCloseTo(21.5, 5); // (15+48)/2 - 10
  });
  it('touch: drops a tall screen to the band floor', () => {
    expect(recommendMountBottom(60, 'touch')).toBe(15);
  });
  it('view: centers the screen on the eye line', () => {
    expect(recommendMountBottom(27, 'view', 64)).toBeCloseTo(50.5, 5); // 64 - 13.5
  });
  it('view: never recommends below the floor', () => {
    expect(recommendMountBottom(140, 'view', 64)).toBe(6);
  });
});

describe('pixelMetrics', () => {
  it('derives pitch from pixels and pixels from pitch reciprocally', () => {
    const width = 47.94; // 55" 16:9
    const fromPixels = pixelMetrics(width, 96, { horizontalPixels: 3840 });
    const fromPitch = pixelMetrics(width, 96, { pitchMm: fromPixels.pitchMm });
    expect(fromPitch.horizontalPixels).toBeCloseTo(3840, 0);
  });
  it('42" 4K at arm’s length resolves ~46 px/° (acceptable, not retina)', () => {
    const v = pixelMetrics(36.61, 25, { horizontalPixels: 3840 });
    expect(v.pitchMm).toBeCloseTo(0.242, 2);
    expect(v.ppd).toBeCloseTo(46, 0);
    expect(v.acceptable).toBe(true);
    expect(v.retina).toBe(false);
  });
  it('ppd hits 60 exactly at the retina distance', () => {
    const m = pixelMetrics(100, 0, { pitchMm: 2.5 });
    const retinaDistanceIn = m.retinaDistanceM * 39.3701;
    const at = pixelMetrics(100, retinaDistanceIn, { pitchMm: 2.5 });
    expect(at.ppd).toBeCloseTo(60, 0);
  });
  it.each([
    [1.5, 1.5, 5.16],
    [2.5, 2.5, 8.59],
    [3.9, 3.9, 13.41],
  ])('P%s wall: min-clean %s m, retina %s m', (pitch, minClean, retina) => {
    const m = pixelMetrics(120, 60, { pitchMm: pitch });
    expect(m.minCleanDistanceM).toBeCloseTo(minClean, 2);
    expect(m.retinaDistanceM).toBeCloseTo(retina, 1);
  });
});

describe('verdict — angle exposure', () => {
  it('reports the horizontal angle consistent with subtendedAngle', () => {
    const v = verdict(cfg({ diag: 65, mode: 'view', viewingDistance: 12 }));
    expect(v.horizontalAngle).toBeCloseTo(subtendedAngle(w169(65).width, 12), 4);
    expect(v.horizontalAngle).toBeGreaterThan(120);
  });
});

describe('verdict — the regression that started this: 42" touch is NOT bad', () => {
  it('42" 4K touchscreen, well mounted → not a bad idea, no bad reasons', () => {
    const v = verdict(
      cfg({ diag: 42, mode: 'touch', mountBottom: recommendMountBottom(w169(42).height, 'touch'), horizontalPixels: 3840 }),
    );
    expect(v.level).not.toBe('bad');
    expect(hasBad(v)).toBe(false);
    expect(v.horizontalAngle).toBeCloseTo(72, 0);
  });
});

describe('verdict — touch sizing matrix (adult, recommended mount)', () => {
  const at = (diag: number) =>
    verdict(cfg({ diag, mode: 'touch', mountBottom: recommendMountBottom(w169(diag).height, 'touch') }));
  it('42" touch → not bad', () => expect(at(42).level).not.toBe('bad'));
  it('55" touch (kiosk standard) → not bad realistically', () => {
    expect(at(55).level).not.toBe('bad');
  });
  it('55" touch is harsher under strict mode', () => {
    const strict = verdict(
      cfg({ diag: 55, mode: 'touch', strictness: 'strict', mountBottom: recommendMountBottom(w169(55).height, 'touch') }),
    );
    expect(['caution', 'bad']).toContain(strict.level);
  });
  it('86" touch → caution realistically, bad strictly (~113°)', () => {
    expect(at(86).horizontalAngle).toBeGreaterThan(105);
    expect(at(86).level).toBe('caution');
    expect(verdict(cfg({ diag: 86, mode: 'touch', strictness: 'strict' })).level).toBe('bad');
  });
  it('12 ft LED wall as a touchscreen → bad with multiple reasons', () => {
    const v = verdict(cfg({ diag: 165, mode: 'touch', mountBottom: 0, pitchMm: 3.9 }));
    expect(v.level).toBe('bad');
    expect(v.horizontalAngle).toBeGreaterThan(130);
    expect(v.adaReach.reachableFraction).toBeLessThan(0.5);
    expect(v.reasons.filter((r) => r.level === 'bad').length).toBeGreaterThanOrEqual(2);
  });
});

describe('verdict — view mode', () => {
  it('55" 4K viewed at 8 ft → good', () => {
    const v = verdict(cfg({ diag: 55, mode: 'view', viewingDistance: 96, mountBottom: 42, horizontalPixels: 3840 }));
    expect(v.level).toBe('good');
    expect(['ideal', 'ok']).toContain(v.angleClass);
  });
  it('65" viewed at 1 ft → bad (the original horror case)', () => {
    const v = verdict(cfg({ diag: 65, mode: 'view', viewingDistance: 12 }));
    expect(v.level).toBe('bad');
  });
  it('view mode does not raise ADA reach complaints', () => {
    const v = verdict(cfg({ diag: 65, mode: 'view', viewingDistance: 120, mountBottom: 60 }));
    expect(v.reasons.some((r) => /ADA reach/.test(r.text))).toBe(false);
  });
});

describe('verdict — standoff guidance', () => {
  it('offers a stand-back distance when a touch screen is large', () => {
    const v = verdict(cfg({ diag: 86, mode: 'touch' }));
    expect(v.reasons.some((r) => /stand back/.test(r.text))).toBe(true);
    expect(v.comfortableStandoff).toBeCloseTo(comfortableStandoff(w169(86).width), 4);
  });
  it('no stand-back nag for a comfortable small touch screen', () => {
    const v = verdict(cfg({ diag: 42, mode: 'touch' }));
    expect(v.reasons.some((r) => /stand back/.test(r.text))).toBe(false);
  });
});

describe('verdict — tilt', () => {
  it('tiltDeg 0 is identical to omitting tilt (non-breaking)', () => {
    const base = cfg({ diag: 55, mode: 'view', viewingDistance: 96 });
    const withZero = verdict({ ...base, tiltDeg: 0 });
    const without = verdict(base);
    expect(withZero.effectiveDistance).toBeCloseTo(without.effectiveDistance, 9);
    expect(withZero.horizontalAngle).toBeCloseTo(without.horizontalAngle, 9);
    expect(withZero.level).toBe(without.level);
  });
  it('a tilt changes the effective distance (and thus the angle)', () => {
    const base = cfg({ diag: 55, mode: 'view', viewingDistance: 96, mountBottom: 40 });
    const flat = verdict({ ...base, tiltDeg: 0 }).effectiveDistance;
    const tilted = verdict({ ...base, tiltDeg: 30 }).effectiveDistance;
    expect(tilted).not.toBeCloseTo(flat, 1);
  });
});

describe('verdict — personas reach differently', () => {
  it('a child cannot reach as high as an adult on the same screen', () => {
    const tall = cfg({ diag: 55, mode: 'touch', mountBottom: 40 });
    const adult = verdict({ ...tall, personaId: 'adult' });
    const child = verdict({ ...tall, personaId: 'child' });
    expect(child.personaReach.reachableFraction).toBeLessThanOrEqual(
      adult.personaReach.reachableFraction,
    );
  });
});
