import { describe, expect, it } from 'vitest';
import {
  bandForDba,
  combineDb,
  coverageField,
  designThrowFt,
  directivityDb,
  listenerVerdict,
  makeBasis,
  pointLevel,
  powerBudget,
  sampleSpeaker,
  USE_CASES,
  type SpeakerUnit,
} from './speakerMath';

// A single speaker on a 9 ft ceiling firing straight down, 90° conical.
const ceiling: SpeakerUnit = {
  mount: 'ceiling',
  xIn: 0,
  zIn: 0,
  mountAffIn: 108,
  yawDeg: 0,
  pitchDeg: -90,
  hCovDeg: 90,
  vCovDeg: 90,
  sensitivity: 90,
  powerW: 1, // 1 W so refDb1m == sensitivity exactly
  maxSplDb: 120, // well above the drive level, so it never caps in these tests
};

describe('inverse-square dropoff', () => {
  it('on-axis SPL loses ~6 dB per doubling of distance', () => {
    const B = makeBasis(ceiling);
    // Points straight below the down-firing driver, at 1 m and 2 m (driver y is in
    // feet, so step down by metres÷0.3048 feet).
    const below = (meters: number): [number, number, number] => [
      0,
      B.pos[1] - meters / 0.3048,
      0,
    ];
    const s1 = sampleSpeaker(B, below(1));
    const s2 = sampleSpeaker(B, below(2));
    expect(s1.splFlat).toBeCloseTo(90, 4); // sensitivity at 1 m, on-axis, 1 W
    expect(s1.splFlat - s2.splFlat).toBeCloseTo(6.02, 1); // doubling distance → −6 dB
  });

  it('drive power adds 10·log10(W) to the 1 m on-axis level', () => {
    const B1 = makeBasis(ceiling);
    const B10 = makeBasis({ ...ceiling, powerW: 10 });
    expect(B10.refDb1m - B1.refDb1m).toBeCloseTo(10, 6);
  });
});

describe('directivity', () => {
  it('is 0 dB on-axis and −6 dB at the rated coverage half-angle', () => {
    const B = makeBasis(ceiling); // 90° → half-angle 45°
    expect(directivityDb(B, 0, 0)).toBeCloseTo(0, 6);
    expect(directivityDb(B, (45 * Math.PI) / 180, 0)).toBeCloseTo(-6, 6);
    expect(directivityDb(B, 0, (45 * Math.PI) / 180)).toBeCloseTo(-6, 6);
  });

  it('points behind the driver get no direct contribution', () => {
    const B = makeBasis(ceiling);
    const above = sampleSpeaker(B, [0, B.pos[1] + 3, 0]); // up, behind a down-firing unit
    expect(above.inFront).toBe(false);
    expect(Number.isFinite(above.splFlat)).toBe(false);
  });
});

describe('incoherent power sum', () => {
  it('two equal uncorrelated sources add +3 dB, not +6', () => {
    expect(combineDb([80, 80])).toBeCloseTo(83.01, 2);
    expect(combineDb([80, 80, 80, 80])).toBeCloseTo(86.02, 2);
  });

  it('a much quieter source barely lifts the total', () => {
    expect(combineDb([80, 60])).toBeCloseTo(80.04, 2);
  });

  it('silence (−Infinity) contributes nothing', () => {
    expect(combineDb([80, -Infinity])).toBeCloseTo(80, 6);
  });
});

describe('overlap at the listener', () => {
  it('two ceiling speakers straddling a listener sum above either alone', () => {
    const left: SpeakerUnit = { ...ceiling, xIn: -42 };
    const right: SpeakerUnit = { ...ceiling, xIn: 42 };
    const bases = [makeBasis(left), makeBasis(right)];
    const ear: [number, number, number] = [0, 5, 0]; // 5 ft ear height, centred
    const single = sampleSpeaker(bases[0], ear).splFlat;
    const both = pointLevel(bases, ear);
    expect(both.flat).toBeGreaterThan(single);
    expect(both.flat).toBeLessThan(single + 6); // power sum, not coherent doubling
  });
});

describe('Max SPL ceiling', () => {
  it('caps the 1 m reference at Max SPL no matter the drive power', () => {
    // 90 dB @1W; 1000 W would be +30 dB → 120, but the box maxes at 106.
    const B = makeBasis({ ...ceiling, powerW: 1000, maxSplDb: 106 });
    expect(B.refDb1m).toBe(106);
    expect(B.clipped).toBe(true);
    expect(B.headroomDb).toBe(0);
  });

  it('reports remaining headroom below the ceiling', () => {
    const B = makeBasis({ ...ceiling, powerW: 1, maxSplDb: 106 });
    expect(B.refDb1m).toBe(90);
    expect(B.headroomDb).toBe(16);
    expect(B.clipped).toBe(false);
  });

  it('maxDba at a point sits a speaker’s headroom above its set level', () => {
    const B = makeBasis({ ...ceiling, powerW: 1, maxSplDb: 106 });
    const p = pointLevel([B], [0, B.pos[1] - 1 / 0.3048, 0]); // 1 m on-axis
    expect(p.maxDba - p.dba).toBeCloseTo(16, 4);
  });
});

describe('“loud enough” verdict vs the room', () => {
  const ear = (B: ReturnType<typeof makeBasis>): [number, number, number] => [
    0,
    B.pos[1] - 1 / 0.3048,
    0,
  ];
  it('flags a layout that cannot clear a loud room even maxed out', () => {
    const u = { ...USE_CASES.speech }; // needs noise + 15 dB
    const B = makeBasis({ ...ceiling, powerW: 1, maxSplDb: 95 });
    const v = listenerVerdict([B], ear(B), u, 90); // 90 dBA room → needs ~105
    expect(v.canReach).toBe(false);
    expect(v.tone).toBe('bad');
    expect(v.label).toMatch(/loud enough/i);
  });

  it('says turn it up when headroom exists but the set level is short', () => {
    const u = USE_CASES.speech;
    // Light 0.3 W tap → ~83 dBA at 1 m (under the 85 fatigue line), Max SPL 120 so
    // there's ~35 dB of headroom. Room needs noise+15 = 100 dBA.
    const B = makeBasis({ ...ceiling, powerW: 0.3, maxSplDb: 120 });
    const v = listenerVerdict([B], ear(B), u, 85);
    expect(v.loudEnough).toBe(false);
    expect(v.canReach).toBe(true);
    expect(v.tone).toBe('caution');
    expect(v.label).toMatch(/turn it up/i);
  });
});

describe('verdict bands', () => {
  const u = USE_CASES.speech; // 60 / 65–75 / 85
  it('classifies dBA into the five-band scale', () => {
    expect(bandForDba(55, u)).toBe('too-quiet');
    expect(bandForDba(62, u)).toBe('quiet');
    expect(bandForDba(70, u)).toBe('good');
    expect(bandForDba(80, u)).toBe('loud');
    expect(bandForDba(90, u)).toBe('fatiguing');
  });
});

describe('design throw', () => {
  it('is the on-axis distance where the level decays to the target', () => {
    const B = makeBasis({ ...ceiling, sensitivity: 90, powerW: 1 });
    // 90 dB flat at 1 m → flat target = dba target − A_OFFSET. For 70 dBA target,
    // flat target ≈ 71.5; (90 − 71.5)/20 → ~8.4 m.
    const throwFt = designThrowFt(B, 70);
    const m = throwFt * 0.3048;
    expect(m).toBeGreaterThan(7);
    expect(m).toBeLessThan(10);
  });
});

describe('power budget', () => {
  const taps = (ws: number[]): SpeakerUnit[] => ws.map((w) => ({ ...ceiling, powerW: w }));
  it('sums taps and flags load against the amp rating with headroom', () => {
    // 4 × 15 W = 60 W on a 120 W amp → 50%, comfortably within the 80% headroom.
    const ok = powerBudget(taps([15, 15, 15, 15]), 120);
    expect(ok.totalTapW).toBe(60);
    expect(ok.loadPct).toBeCloseTo(50, 4);
    expect(ok.band).toBe('ok');
    // 100 W on 120 W → 83% → past 80% headroom but under the rating → tight.
    expect(powerBudget(taps([60, 40]), 120).band).toBe('tight');
    // 140 W on 120 W → over the amp entirely.
    expect(powerBudget(taps([60, 60, 20]), 120).band).toBe('over');
  });
});

describe('coverage field', () => {
  it('fills the gap between two speakers more as they move closer', () => {
    const midLevel = (halfSpacingIn: number) =>
      pointLevel(
        [
          makeBasis({ ...ceiling, xIn: -halfSpacingIn }),
          makeBasis({ ...ceiling, xIn: halfSpacingIn }),
        ],
        [0, 5, 0], // midpoint between them, at 5 ft ear height
      ).flat;
    // Closer together → the off-axis dip at the midpoint is shallower → louder.
    expect(midLevel(24)).toBeGreaterThan(midLevel(72));
  });

  it('covers audible area at/above the use-case floor', () => {
    const field = coverageField([ceiling], 60, USE_CASES.music, 40);
    expect(field.audibleAreaSqFt).toBeGreaterThan(0);
    expect(field.goodAreaSqFt).toBeLessThanOrEqual(field.audibleAreaSqFt);
  });
});
