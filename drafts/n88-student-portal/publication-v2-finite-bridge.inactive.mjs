/** AI-authored INACTIVE composition. No transport, acquisition, environment or route
 * installation. The only public capability is the existing OFF service handler.
 * Repository and admission ports are trusted LOCAL synthetic dependencies, never
 * request fields. The old query port retains its ORIGINAL finite allowlist; it
 * must not be replaced with a general SQL executor for hosted use.
 */
import { publicationV2FiniteCatalog, publicationV2FiniteCatalogSha256,
  createInactivePublicationV2FiniteCatalog } from './publication-v2-finite-catalog.inactive.mjs';
import { createCanonicalPublicationV2Ports } from './publication-v2-canonical.inactive.mjs';
import { createPublicationV2Service } from './publication-v2-service.inactive.mjs';
import { CREDENTIAL_FORMAT } from './numeric-credentials.mjs';

const fail = () => { throw Error('n88_v2_bridge_unavailable'); };
const must = v => { if (!v) fail(); };
const operations = new Map(publicationV2FiniteCatalog.map(op => [op.sql, op]));

// Explicit wire codec between the EXISTING numeric store and finite catalogue.
// No unknown field is discarded: the catalogue validates every remaining field.
// Preserve original numeric Auth's numeric revision comparison and format marker.
function encodeNumeric(op, raw) {
  if (!op.id.startsWith('numeric-') || !Array.isArray(raw?.rows) || raw.rows.length !== 1) return raw;
  const row = raw.rows[0], payload = row?.payload;
  must(Object.getPrototypeOf(raw) === Object.prototype && row && Object.getPrototypeOf(row) === Object.prototype &&
    payload && Object.getPrototypeOf(payload) === Object.prototype && Buffer.byteLength(JSON.stringify(payload)) <= op.maxBytes);
  if (op.id === 'numeric-session') {
    must(Number.isSafeInteger(payload.membershipRevision) && payload.membershipRevision >= 1);
    return { ...raw, rows: [{ ...row, payload: { ...payload, membershipRevision: String(payload.membershipRevision) } }] };
  }
  must(payload.format === CREDENTIAL_FORMAT);
  const { format: _format, ...finitePayload } = payload;
  return { ...raw, rows: [{ ...row, payload: finitePayload }] };
}
function decodeNumeric(op, result) {
  if (!op.id.startsWith('numeric-') || result.rows.length !== 1) return result;
  const payload = result.rows[0].payload;
  if (op.id === 'numeric-session') {
    const revision = Number(payload.membershipRevision);
    must(Number.isSafeInteger(revision) && revision >= 1 && String(revision) === payload.membershipRevision);
    payload.membershipRevision = revision;
  } else payload.format = CREDENTIAL_FORMAT;
  must(Buffer.byteLength(JSON.stringify(payload)) <= op.maxBytes);
  return result;
}

/** repository.transaction owns locks/rollback/COMMIT ACK and connection cleanup.
 * Its ports have the unchanged query/beforeCommit/canonicalReadMode plus a named
 * executePublicationV2(sql,args,signal), mandatory and SYNTHETIC ONLY. No fallback
 * sends new SQL through the old hosted boundary. verifyAdmission(request,ports,
 * signal) must revalidate the original current teacher/numeric guards in this
 * SAME transaction, returning the catalogue's exact server-owned admission.
 * storageWrite is a trusted internal entitlement, not a role-derived grant;
 * effects ALSO require successful original service Auth AND canonical snapshot.
 * Numeric locator -> original authenticated student upgrade is owned by that
 * trusted port, with the catalogue enforcing exact locked tuple continuity.
 */
export function createInactivePublicationV2FiniteBridge({ executionMode, enabled = false, origin,
  catalogSha256, repository, verifyAdmission, canonical, now = Date.now,
  budgetMs = 5000, maxOperations = 20000 } = {}) {
  if (enabled !== true || executionMode !== 'synthetic')
    return createPublicationV2Service({ executionMode, origin });
  must(catalogSha256 === publicationV2FiniteCatalogSha256 && typeof repository?.transaction === 'function' &&
    typeof verifyAdmission === 'function' && typeof now === 'function' && canonical &&
    Number.isSafeInteger(budgetMs) && budgetMs >= 10 && budgetMs <= 10000 &&
    Number.isSafeInteger(maxOperations) && maxOperations >= 1 && maxOperations <= 20000);
  // A separate closure per invocation: no shared mutable "current request".
  return async request => {
    let finite, admitted = null, sourceReady = false, live = true, poisoned = false;
    const deadline = now() + budgetMs;
    const fence = () => must(live && !poisoned && now() < deadline);
    const wrappedRepository = { transaction: action => repository.transaction(async (legacy, original) => {
      fence();
      must(typeof original?.query === 'function' && typeof original.beforeCommit === 'function' &&
        typeof original.canonicalReadMode === 'function' && typeof original.executePublicationV2 === 'function');
      // One catalogue state for the entire service request, including COMMIT guards.
      must(!finite);
      finite = createInactivePublicationV2FiniteCatalog({ executionMode, now, budgetMs: Math.max(10, deadline - now()), maxOperations,
        verifyAdmission: async (sameRequest, signal) => {
          fence(); must(sameRequest === request);
          const context = await verifyAdmission(sameRequest, original, signal); fence();
          if (admitted) must(context?.ownerId === admitted.ownerId && context.sessionId === admitted.sessionId && context.role === admitted.role);
          return context;
        },
        executeFixed: async (sql, args, signal) => {
          fence(); return encodeNumeric(operations.get(sql), await original.executePublicationV2(sql, args, signal));
        },
      });
      const query = async (sql, args) => {
        fence();
        try {
          const op = operations.get(sql);
          if (!op) {
            // Only existing trusted canonical/Auth code reaches the original
            // independently finite port. Never reinterpret unfamiliar V2 SQL.
            must(typeof sql === 'string' && !/publication_v2_|numeric_sessions|numeric_credentials|n88_private\.contexts/i.test(sql));
            const result = await original.query(sql, args); fence(); return result;
          }
          if (op.effect) must(sourceReady && admitted);
          const ticket = await finite.prepare(request, { operation: op.id, args });
          const result = await finite.execute(request, ticket); fence(); return decodeNumeric(op, result);
        } catch { poisoned = true; finite.close(request); fail(); }
      };
      original.beforeCommit(() => { fence(); });
      return action(legacy, Object.freeze({ query,
        beforeCommit: fn => { fence(); return original.beforeCommit(fn); },
        canonicalReadMode: () => { fence(); return original.canonicalReadMode(); },
      }));
    }) };
    try {
      const ports = createCanonicalPublicationV2Ports({ ...canonical, executionMode, repository: wrappedRepository, origin, now });
      const authenticate = async (r, tx, role) => {
        fence(); must(r === request);
        const auth = await ports.authenticate(r, tx, role); fence();
        if (auth?.current === true) {
          if (admitted) must(admitted.ownerId === auth.ownerId && admitted.sessionId === auth.sessionId && admitted.role === role);
          admitted = Object.freeze({ ownerId: auth.ownerId, sessionId: auth.sessionId, role });
        }
        return auth;
      };
      const readCurrent = async (tx, auth, scope) => {
        fence(); must(admitted && auth.ownerId === admitted.ownerId && auth.sessionId === admitted.sessionId);
        const snapshot = await ports.readCurrent(tx, auth, scope); fence(); sourceReady = true; return snapshot;
      };
      return await createPublicationV2Service({ executionMode, enabled: true, origin,
        transaction: ports.transaction, authenticate, readCurrent })(request);
    } catch {
      // Same private response and UNKNOWN semantics as the original service.
      return await createPublicationV2Service({ executionMode, enabled: true, origin,
        transaction: async () => fail(), authenticate: () => null, readCurrent: () => null })(request);
    } finally { live = false; finite?.close(request); }
  };
}
