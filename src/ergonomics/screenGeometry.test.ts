import { describe, expect, it } from 'vitest';
import { screenGeometry } from './screenGeometry';

describe('screenGeometry — reduces to a vertical wall at tilt 0', () => {
  const g = screenGeometry({ mountBottom: 24, height: 30, tiltDeg: 0 });
  it('center is the vertical mid-height at z=0', () => {
    expect(g.center).toEqual([0, 39, 0]);
  });
  it('top edge is at z=0', () => expect(g.top).toEqual([0, 54, 0]));
  it('normal faces the viewer (+z)', () => expect(g.normal).toEqual([0, 0, 1]));
  it('a screen point stays on the wall plane (z=0)', () => {
    expect(g.pointAtHeight(40)).toEqual([0, 40, 0]);
  });
  it('perpendicular distance equals the eye standing distance', () => {
    expect(g.perpDistanceFromEye([0, 64, 25])).toBeCloseTo(25, 6);
  });
});

describe('screenGeometry — look-down kiosk: pushed forward, top recedes to wall', () => {
  const t = 30;
  const rad = (t * Math.PI) / 180;
  const g = screenGeometry({ mountBottom: 24, height: 30, tiltDeg: t });
  it('the panel is pushed forward by frontOffset = h·sin', () => {
    expect(g.frontOffset).toBeCloseTo(30 * Math.sin(rad), 4);
    expect(g.pivot[2]).toBeCloseTo(g.frontOffset, 6); // bottom edge out front
  });
  it('the back-tilted top edge lands at the wall (z = 0) and rises by h·cos', () => {
    expect(g.top[2]).toBeCloseTo(0, 6);
    expect(g.top[1]).toBeCloseTo(24 + 30 * Math.cos(rad), 3);
  });
  it('center sits in front of the wall (z > 0)', () => {
    expect(g.center[2]).toBeGreaterThan(0);
  });
  it('higher points on the screen recede toward the wall (smaller z)', () => {
    expect(g.pointAtHeight(44)[2]).toBeLessThan(g.pointAtHeight(30)[2]);
  });
  it('the face normal points up and toward the viewer', () => {
    expect(g.normal[1]).toBeGreaterThan(0);
    expect(g.normal[2]).toBeCloseTo(Math.cos(rad), 4);
  });
});
