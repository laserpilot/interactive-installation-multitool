// Shareable links: the whole config encoded into the URL hash, so a recipient
// opens the exact interactive scene with no server round-trip. The hash (not a
// query param) keeps it out of server/referrer logs and plays nice with the
// GitHub Pages static host. The uploaded image is excluded to keep links short.

import { useConfigStore } from '../store/useConfigStore';
import { serialize, validateAndApply } from '../store/snapshot';

const HASH_KEY = 's';

// UTF-8-safe base64url. btoa() only handles Latin-1, so encode to UTF-8 bytes
// first; then swap to the URL-safe alphabet and strip padding.
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Build a copy-pasteable link that encodes the current config (minus the
 *  uploaded image) into the URL hash. */
export function buildShareUrl(): string {
  const snap = serialize(useConfigStore.getState(), { includeContent: false });
  const encoded = toBase64Url(JSON.stringify(snap.state));
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${HASH_KEY}=${encoded}`;
}

/** If the page was opened with a share hash, apply it over the (autosaved)
 *  state and clear the hash so a refresh doesn't re-pin it. Returns whether a
 *  link was consumed. Safe to call once on mount. */
export function consumeShareHash(): boolean {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const encoded = params.get(HASH_KEY);
  if (!encoded) return false;

  try {
    const patch = validateAndApply(JSON.parse(fromBase64Url(encoded)));
    if (Object.keys(patch).length > 0) {
      useConfigStore.setState(patch);
    }
  } catch {
    // Malformed link — ignore and fall through to whatever state we had.
    return false;
  } finally {
    // Drop the hash regardless, so the address bar stays clean and refresh is sane.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return true;
}
