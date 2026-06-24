import { describe, expect, it } from 'vitest';
import { dataFields, serialize, validateAndApply, withoutContent } from './snapshot';
import { INITIAL, useConfigStore } from './useConfigStore';

const state = () => useConfigStore.getState();

describe('snapshot serialization', () => {
  it('dataFields drops action functions, keeps every data key', () => {
    const data = dataFields(state());
    expect(typeof (data as Record<string, unknown>).set).toBe('undefined');
    for (const key of Object.keys(INITIAL)) expect(key in data).toBe(true);
  });

  it('omits the uploaded image unless asked to include it', () => {
    useConfigStore.setState({ contentUrl: 'data:image/png;base64,AAAA' });
    expect('contentUrl' in serialize(state(), { includeContent: false }).state).toBe(false);
    expect(serialize(state(), { includeContent: true }).state.contentUrl).toBe(
      'data:image/png;base64,AAAA',
    );
    useConfigStore.setState({ contentUrl: null });
  });

  it('stamps a version and timestamp', () => {
    const snap = serialize(state());
    expect(snap.v).toBe(1);
    expect(typeof snap.savedAt).toBe('string');
  });
});

describe('validateAndApply', () => {
  it('round-trips a real snapshot back to the same field values', () => {
    useConfigStore.setState({ diagonal: 77, tiltDeg: 12, speakerNoiseFloor: 62 });
    const snap = serialize(state(), { includeContent: false });
    const patch = validateAndApply(snap);
    expect(patch.diagonal).toBe(77);
    expect(patch.tiltDeg).toBe(12);
    expect(patch.speakerNoiseFloor).toBe(62);
    useConfigStore.setState(INITIAL);
  });

  it('accepts both a {state} wrapper and a bare field map', () => {
    expect(validateAndApply({ state: { diagonal: 50 } }).diagonal).toBe(50);
    expect(validateAndApply({ diagonal: 50 }).diagonal).toBe(50);
  });

  it('drops keys whose type does not match the default', () => {
    const patch = validateAndApply({ diagonal: 'huge', mountType: 'wall', tiltDeg: 5 });
    expect('diagonal' in patch).toBe(false); // string where a number is expected
    expect(patch.mountType).toBe('wall');
    expect(patch.tiltDeg).toBe(5);
  });

  it('drops unknown keys entirely', () => {
    const patch = validateAndApply({ diagonal: 60, somethingMadeUp: 1 });
    expect(patch.diagonal).toBe(60);
    expect('somethingMadeUp' in patch).toBe(false);
  });

  it('accepts a valid speakers array but rejects a malformed one', () => {
    const good = [
      {
        mount: 'ceiling', xIn: 0, zIn: 72, mountAffIn: 108, yawDeg: 0, pitchDeg: -90,
        hCovDeg: 90, vCovDeg: 90, sensitivity: 89, powerW: 1, maxSplDb: 110,
      },
    ];
    expect(validateAndApply({ speakers: good }).speakers).toHaveLength(1);
    expect('speakers' in validateAndApply({ speakers: [{ mount: 'ceiling' }] })).toBe(false);
    expect('speakers' in validateAndApply({ speakers: [] })).toBe(false);
  });

  it('accepts contentUrl as a string or null', () => {
    expect(validateAndApply({ contentUrl: 'data:x' }).contentUrl).toBe('data:x');
    expect(validateAndApply({ contentUrl: null }).contentUrl).toBe(null);
    expect('contentUrl' in validateAndApply({ contentUrl: 42 })).toBe(false);
  });

  it('returns an empty patch for junk input', () => {
    expect(validateAndApply(null)).toEqual({});
    expect(validateAndApply('nope')).toEqual({});
    expect(validateAndApply(123)).toEqual({});
  });

  it('withoutContent strips only the image', () => {
    const stripped = withoutContent({ diagonal: 60, contentUrl: 'data:x' });
    expect(stripped.diagonal).toBe(60);
    expect('contentUrl' in stripped).toBe(false);
  });
});
