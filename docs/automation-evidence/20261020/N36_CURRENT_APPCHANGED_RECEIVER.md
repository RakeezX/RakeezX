# N36 — current receiver APP_CHANGED boundary

Task `continuous-n36-current-appchanged-receiver-context-20261020`, run `c226fb0c-7562-4066-a7a0-7627cb7641ee`.
Base and fetched origin/main: `15991a36f0a7b3f082b85acd1c45a6c9d581f9a2`.

The existing background task is `awaiting_po`; its recorded candidate is `32cb9b4df7205aeaa04d9d7688c265e2a06143a8`, recorded publication `15991a36f0a7b3f082b85acd1c45a6c9d581f9a2`, verifiedAt `2026-10-20T13:42:47.939Z`. These are existing controller records, not publication steps run by this worker. Extension 0.5.21, its 27 files/ZIP and the current download link remain byte-identical. N107 implementation, store, cloud, public v3 protocol and SW are unchanged (`reuse.json`). No new startup module, package bump or repackaging.

## Concrete reproduction and correction

The immutable current app with the reported 0.5.20 worker grants a batch, then rejects its boolean receiver check after replacement of a session object with the SAME owner and Authsid. Profile/outbox remain unchanged before acceptance. This proves a concrete local cause of the umbrella APP_CHANGED, not that the PO's unseen document/session definitely took this branch. Source fields were already present in the actual reported envelope; no extraction or stale-capability case was repeated.

The receiver now captures the existing authoritative cloud owned-mutation guard, which fences Auth generation/logout, owner, workspace identity, database and writable lease. Existing `extensionOwnerBinding` authenticated-state/ownership/lease checks still run. Authsid is an additional session-continuity DENIAL fence after those guards, not JWT-only authorization: no user metadata is trusted, no credential is logged or persisted, and a different/missing previously present Authsid retires the grant. For opaque same-token fixtures/legacy state, exact bearer identity can survive object replacement; a changed opaque token fails closed. The grant keeps its original expiry and raw academic snapshots.

A valid same-batch busy receiver reports readiness with finite `SAME_BATCH_BUSY` status rather than APP_CHANGED. Direct requests are serialized and deduplicated by original extension/nonce under the captured grant; cancellation/retirement clears owned queued references. Auto-resume does not replace/compete with an explicit grant, and an adopted auto-resume stops before starting another pending write. Optional same-account manual mapping/resume uses the same session fence and cannot interrupt a busy writer. No original nonce/batch is replaced because its outcome is unknown.

Same-document harmless navigation AFTER a valid claim no longer masquerades as account change in the direct app receiver. The unchanged worker still enforces its original URL/main-frame/document/nonce checks BEFORE claim; no such check was relaxed. Manual v1 route/review guards remain. Actual owner/Authsid/workspace/lease/year/raw-term/document/expiry failures still deny access. `rakeezNamesBatchStatus` exposes only finite ready/reason values: READY, SAME_BATCH_BUSY, NO_GRANT, EXPIRED, AUTH_SESSION, OWNER_OR_LEASE or ACADEMIC_CONTEXT, never IDs/names/tokens. Existing boolean/capability/v3 calls remain compatible.

## Affected verification

`node --experimental-vm-modules tests/n36-current-appchanged-20261020/browser.mjs`: PASS.

- `n36_current_appchanged_fence_specific_reproduction`: immutable current app + reported worker reproduces rejection after same-owner/Authsid refreshed object.
- `n36_same_verified_session_refresh_and_real_owner_context_denial`: actual receiver accepts the authenticated synthetic same-session refresh, rejects different Authsid and foreign owner, raw-term/year changes and original expiry, without profile/outbox changes on denial.
- `n36_serialized_setup_receipt_settings_after_fence_fix`: actual unchanged 0.5.21 serialized transport → real owner-bound receiver → atomic existing profile/outbox paths → detailed v3 receipt → rendered Settings/header. Three differing existing personal fields update; absent department/classes/timetable remain honestly missing; existing calendar unchanged.
- Deterministic held-claim busy case: original nonce coalesces, same grant survives a pending-device refresh/autoresume notification and a post-claim harmless route change. A delayed original final receipt reconciles after an unknown transport outcome with exactly one claim and no duplicate write. Actual optional manual saved-batch resume also completes unchanged data without another outbox write.

The transport-focused test seam exports the existing serialized worker transport and suppresses collection scheduling only; all real transport/nonce/schema/sender/document/receiver guards remain. The old reported worker uses its actual popup message handler. Chrome APIs/session state and Auth tokens are synthetic. No collector/source DOM is read and no native MV3 lifecycle certification is claimed. The real application DOM, handlers and source CSS run over task-owned loopback HTTP `127.0.0.1:49602`, with the canonical fresh isolated browser helper; contexts/browser/server close in finally. This eligible local phase uses no shared browser lease.

`node tests/n36-current-appchanged-20261020/reuse.mjs`: PASS — affected JS syntax, unchanged extension/package/protocol/cloud/store/SW and non-N36 N107 implementation. The existing offline shell already includes `n36-extension-handoff.js`; no new offline dependency was added. Prior source/profile-write/grade/Sync/Delete proofs are reused, not rerun. See `browser.json`, `reuse.json`, `settings-receiver.png`.

Harness failures were corrected without changing Product guards: the old VM helper had asynchronous module-link races; the scoped helper now lets one root linker resolve the actual graph. A mixed old-popup/new-worker fixture produced BATCH_EXPIRED, so the reproduction uses the immutable reported 0.5.20 worker and the positive test calls the current background transport with explicit synthetic job authority. A test initially moved the hash BEFORE claim and correctly hit the retained worker route denial; the harmless-route case now changes it only AFTER that valid claim. The optional manual-resume test waits for actual writer readiness rather than merely observing cleared pending state.

Official primary context: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions) documents the stable UUID session_id claim across access-token refresh. The changelog markdown fetch was unsupported by the web reader; no service/API/configuration change depends on it. Existing local cloud guards remain the authority.

Actual PO account/source success remains unproven and N36 stays open. No real account/pupil mutation, school/result read, Auth configuration, SQL, service operation, push, deployment, stable-folder install or Chrome reload occurred. Independent publisher owns integration/served verification; the current actual failure remains pending genuine acceptance.
