/** Public, privacy-safe identity for the running application build. */
import { GENERATED_BUILD_META } from '../generated/build-meta.generated.js';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function safeCanonicalOrigin(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && url.pathname === '/'
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function resolveBuildMeta(generated = GENERATED_BUILD_META, { development = false } = {}) {
  const appVersion = VERSION_PATTERN.test(String(generated?.appVersion ?? ''))
    ? generated.appVersion
    : '0.0.0-dev';
  if (development) {
    return Object.freeze({
      appVersion,
      buildSha: 'development',
      buildShaKind: 'development',
      buildTimestamp: null,
      canonicalOrigin: null,
    });
  }
  const buildSha = String(generated?.buildSha ?? '').toLowerCase();
  const timestamp = String(generated?.buildTimestamp ?? '');
  return Object.freeze({
    appVersion,
    buildSha: SHA_PATTERN.test(buildSha) ? buildSha : 'unknown',
    buildShaKind: ['git', 'content'].includes(generated?.buildShaKind) ? generated.buildShaKind : 'unknown',
    buildTimestamp: Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null,
    canonicalOrigin: safeCanonicalOrigin(generated?.canonicalOrigin),
  });
}

export const BUILD_META = resolveBuildMeta(GENERATED_BUILD_META, {
  development: import.meta.env?.DEV === true,
});
