import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../ergonomics/constants';
import {
  bodyCoverage,
  confidenceAtFt,
  confRgb,
  inFromFt,
  makeBasis,
  modeProfileIn,
  mToIn,
  samplePoint,
  trackableField,
  type SensorParams,
} from './sensorMath';

// Azure-Kinect-ish sensor on a 9 ft ceiling aimed straight down, with a
// skeletal-style confidence window (≈0.5 / 1.2 / 3.5 / 4.5 m).
const ceiling: SensorParams = {
  mount: 'ceiling',
  mountAffIn: 108,
  pitchDeg: -90,
  yawDeg: 0,
  hFovDeg: 75,
  vFovDeg: 65,
  minRangeIn: mToIn(0.5),
  confNearIn: mToIn(1.2),
  confFarIn: mToIn(3.5),
  maxRangeIn: mToIn(4.5),
};

describe('confidenceAtFt', () => {
  // min 1 / near 3 / far 8 / max 12 ft.
  const B = makeBasis({
    ...ceiling,
    minRangeIn: inFromFt(1),
    confNearIn: inFromFt(3),
    confFarIn: inFromFt(8),
    maxRangeIn: inFromFt(12),
  });

  it('is 0 inside the blind zone, 1 in the sweet spot, and decays in the tail', () => {
    expect(confidenceAtFt(0.5, B)).toBe(0);
    expect(confidenceAtFt(5, B)).toBe(1);
    expect(confidenceAtFt(8, B)).toBe(1);
    expect(confidenceAtFt(13, B)).toBe(0);
  });

  it('ramps up across the near edge and down across the far tail', () => {
    const up = confidenceAtFt(2, B);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(1);
    const down = confidenceAtFt(10, B);
    expect(down).toBeGreaterThan(0);
    expect(down).toBeLessThan(1);
  });
});

describe('samplePoint — cone containment', () => {
  it('sees a point straight below, within range', () => {
    const s = samplePoint(ceiling, [0, 0, 0]); // floor under the sensor, 9 ft away
    expect(s.inFOV).toBe(true);
    expect(s.distFt).toBeCloseTo(9, 4);
  });

  it('rejects a point far outside the FOV cone', () => {
    const s = samplePoint(ceiling, [0, 0, 50]);
    expect(s.inFOV).toBe(false);
    expect(s.conf).toBe(0);
  });

  it('rejects a point behind the sensor', () => {
    const s = samplePoint(ceiling, [0, 20, 0]); // above a down-facing sensor
    expect(s.inFOV).toBe(false);
  });
});

describe('bodyCoverage', () => {
  const adult = PERSONAS.adult;

  it('tracks a full body standing under the sensor', () => {
    const c = bodyCoverage(ceiling, adult, 0, 0);
    expect(c.parts.every((p) => p.inFOV)).toBe(true);
    expect(c.band).toBe('good');
  });

  it('reports "outside coverage" when the person is off to the side', () => {
    const c = bodyCoverage(ceiling, adult, 40, 0);
    expect(c.band).toBe('out');
  });

  it('reports "too far" (not "too close") when the ceiling is out of range', () => {
    // 30 ft ceiling, skeletal max ~4.5 m (~14.8 ft): the body is in the FOV cone
    // straight below but well beyond usable range.
    const c = bodyCoverage({ ...ceiling, mountAffIn: 360 }, adult, 0, 0);
    expect(c.parts.every((p) => p.inFOV)).toBe(true); // still in the cone
    expect(c.band).toBe('toofar');
  });

  it('reports "too close" when the body sits inside the blind zone', () => {
    const blind: SensorParams = {
      ...ceiling,
      minRangeIn: inFromFt(13), // blind nearer than 13 ft, but the floor is 9 ft down
      confNearIn: inFromFt(14),
      confFarIn: inFromFt(18),
      maxRangeIn: inFromFt(20),
    };
    const c = bodyCoverage(blind, adult, 0, 0);
    expect(c.band).toBe('tooclose');
  });
});

describe('trackableField', () => {
  const adult = PERSONAS.adult;

  it('finds a non-empty standing zone for a sensible setup', () => {
    const f = trackableField(ceiling, adult, 40);
    expect(f.coveredAreaSqFt).toBeGreaterThan(0);
  });

  it('shrinks the zone when the usable range is tightened', () => {
    const wide = trackableField(ceiling, adult, 40);
    const tight = trackableField(
      { ...ceiling, confFarIn: mToIn(2.0), maxRangeIn: mToIn(2.5) },
      adult,
      40,
    );
    expect(tight.coveredAreaSqFt).toBeLessThan(wide.coveredAreaSqFt);
  });
});

describe('modeProfileIn', () => {
  it('keeps thresholds ordered and clamps skeletal below the hardware max', () => {
    const hw = mToIn(5.46);
    const p = modeProfileIn('skeletal', hw);
    expect(p.minRangeIn).toBeLessThan(p.confNearIn);
    expect(p.confNearIn).toBeLessThan(p.confFarIn);
    expect(p.confFarIn).toBeLessThanOrEqual(p.maxRangeIn);
    expect(p.maxRangeIn).toBeLessThan(hw); // skeletal can't use the full depth range
  });

  it('lets point-cloud ride most of the hardware range', () => {
    const hw = mToIn(5.46);
    const p = modeProfileIn('pointcloud', hw);
    expect(p.maxRangeIn).toBeCloseTo(hw, 4);
  });
});

describe('confRgb', () => {
  it('runs red → amber → green with confidence', () => {
    expect(confRgb(0)).toEqual([224, 65, 65]);
    expect(confRgb(1)).toEqual([46, 204, 113]);
    const mid = confRgb(0.5);
    expect(mid[0]).toBeGreaterThan(confRgb(1)[0]); // amber redder than green
    expect(mid[1]).toBeGreaterThan(confRgb(0)[1]); // amber greener than red
  });
});
