// Serialization for the whole-app config: one snapshot = every tool's state at
// once. Used by three channels — localStorage autosave, JSON export/import, and
// the share link — so they can never disagree on what "the state" is.
//
// A snapshot is just the store's data fields (everything that isn't an action
// function). Restore is deliberately defensive: a snapshot may come from an old
// build, a hand-edited file, or a truncated URL, so validateAndApply() keeps only
// keys it recognizes whose type matches the default and silently drops the rest.

import { INITIAL, SCHEMA_VERSION, type ConfigData, type ConfigState } from './useConfigStore';

export interface Snapshot {
  /** Schema version the snapshot was written with (informational). */
  v: number;
  /** ISO timestamp the snapshot was created. */
  savedAt: string;
  /** The persisted config fields. */
  state: Partial<ConfigData>;
}

/** A copy of the field map with the uploaded image dropped (too big for
 *  localStorage and share links). */
export function withoutContent(data: Partial<ConfigData>): Partial<ConfigData> {
  const rest: Record<string, unknown> = { ...data };
  delete rest.contentUrl;
  return rest as Partial<ConfigData>;
}

/** The store minus its action functions — the serializable surface. */
export function dataFields(state: ConfigState): ConfigData {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof v !== 'function') out[k] = v;
  }
  return out as ConfigData;
}

/** Wrap the current state in a versioned, timestamped snapshot. `includeContent`
 *  keeps the uploaded image (a potentially multi-MB data URL) — true for JSON
 *  files, false for localStorage and share links where size matters. */
export function serialize(
  state: ConfigState,
  opts: { includeContent: boolean } = { includeContent: true },
): Snapshot {
  const data = dataFields(state);
  const stateOut = opts.includeContent ? data : withoutContent(data);
  return { v: SCHEMA_VERSION, savedAt: new Date().toISOString(), state: stateOut };
}

function isTypeSample(u: unknown): boolean {
  if (!u || typeof u !== 'object') return false;
  const s = u as Record<string, unknown>;
  return typeof s.label === 'string' && typeof s.fontPx === 'number' && Number.isFinite(s.fontPx);
}

function isSpeakerUnit(u: unknown): boolean {
  if (!u || typeof u !== 'object') return false;
  const s = u as Record<string, unknown>;
  const nums = [
    'xIn', 'zIn', 'mountAffIn', 'yawDeg', 'pitchDeg',
    'hCovDeg', 'vCovDeg', 'sensitivity', 'powerW', 'maxSplDb',
  ];
  return (
    (s.mount === 'ceiling' || s.mount === 'wall') &&
    nums.every((k) => typeof s[k] === 'number' && Number.isFinite(s[k] as number))
  );
}

/** Sanitize an arbitrary blob into a patch safe to push into the store. Only keys
 *  present in INITIAL survive, and only when the value's type matches the default
 *  (with `contentUrl` and `speakers` handled specially). Accepts either a raw
 *  field map or a {state} wrapper. */
export function validateAndApply(raw: unknown): Partial<ConfigData> {
  if (!raw || typeof raw !== 'object') return {};
  // Tolerate a {v, savedAt, state} wrapper as well as a bare field map.
  const maybeWrapped = raw as Record<string, unknown>;
  const src =
    maybeWrapped.state && typeof maybeWrapped.state === 'object'
      ? (maybeWrapped.state as Record<string, unknown>)
      : maybeWrapped;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(INITIAL) as (keyof ConfigData)[]) {
    if (!(key in src)) continue;
    const val = src[key as string];

    if (key === 'contentUrl') {
      if (val === null || typeof val === 'string') out[key] = val;
      continue;
    }
    if (key === 'speakers') {
      if (Array.isArray(val) && val.length > 0 && val.every(isSpeakerUnit)) out[key] = val;
      continue;
    }
    if (key === 'typeSamples') {
      if (Array.isArray(val) && val.length > 0 && val.every(isTypeSample)) out[key] = val;
      continue;
    }
    if (key === 'screenPpi') {
      // number | null — a saved number would be rejected by the primitive branch
      // below (default is null → typeof 'object'), so handle it explicitly.
      if (val === null || (typeof val === 'number' && Number.isFinite(val))) out[key] = val;
      continue;
    }
    // Primitive fields: accept only when the runtime type matches the default.
    if (typeof val === typeof INITIAL[key] && val !== null) out[key] = val;
  }
  return out as Partial<ConfigData>;
}
