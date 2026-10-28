# N44 Core V1 automatic scheduler — inactive source qualified

AI-authored continuation ca7222f4-5a3d-4959-be3b-f61d0b825b98. Previous scope blocker resolved by explicit addition of backend.mjs and existing-host.mjs. Historical checkpoint follows below unchanged; its unimplemented/blocker statements describe the earlier attempt only.

## Delivered implementation

Existing host accepts server-only N44_FINITE_SCHEDULER_JSON (default null). Invalid descriptors fail closed. Existing backend selects the exact pinned owner/workspace/device/source kind/id/stamp/event/registration set, then uses unchanged canonical-source and delivery eligibility. No separate reminder engine or HTTP manual-send endpoint was added. Finite mode denies general due/cleanup and the old device-test operation, and is disabled if general delivery is enabled simultaneously.

The descriptor is cloned/frozen, with at most 20 targets, 20 send permits and 20 distinct tick slots. tickMs is at least one minute; activatedAt/hardEnd are absolute, at most 60 minutes apart and within one UTC day. Existing durable owner-locked day budget rows store descriptor binding, tick-slot claims, total ticks and send permits. A different descriptor for the same grant/owner cannot replenish counters during the window. No new schema, SQL shape, role, Auth behavior or repository validation was introduced. One provider attempt per event, including definitive retryable rejection; uncertain outcomes never resend. The grant descriptor is immutable authorization: changing owner/grant or moving its window is not an allowed continuation.

The scheduled worker calls one signed finite-due operation. The server independently enforces the window and caps inside reservation transactions. At hardEnd all subsequent finite operations are inert (logical automatic disarm); this does not delete the installed cron or rewrite remote configuration. Owned cron removal and OFF/NULL readback remain explicit later cleanup operations. Source changes/deletion, preferences, current session and consent are rechecked by existing canonical preparation/delivery. No private destination is added to scheduler output.

## Evidence and limits

Eight affected tests PASS using actual backend, repository codec/transaction control, canonical source and delivery modules with synthetic SQL/clock/provider ports. Ten timing scenarios cover lesson lead and all four due stages in Asia/Riyadh and Pacific/Kiritimati. Additional cases cover quiet/category, revoked consent/inactive session, cancelled/deleted/changed source, foreign device/owner, duplicate/concurrent ticks, UNKNOWN, restart, immutable binding, caps, lost tick COMMIT acknowledgment, hard end and general-operation denial. Actual staged scheduled callback and signed request are exercised. These are not native PostgreSQL locking, hosted TLS/Auth/RLS, browser, or physical OS acceptance. Existing unchanged proofs are not rerun.

Syntax checks passed for modified modules; diff whitespace check passed. The initial harness syntax failure and missing optional esbuild tool are preserved in qualification history. The staged one-line branch was updated directly to match the source and executed by the scoped test. No full build, service call, secret read, browser/server resource, live account action or queue edit occurred.

## Exact inactive delivery / smallest future live packet

Canonical SHA256s for every changed runtime file plus unchanged service entry, canonical source, delivery and repository are in qualification.json. Service entry index.ts SHA256: e315b5ce524361326cb98e832fcd1d8ac98f2e8e04c22917c82f6c8c752749e8. New finite guard SHA256: ab954b9f0bdf7de76ab61211cacd307087f872925ee145d4cb1833c2b25213aa. Backend SHA256: 960f28fef9f4c5ba51837b5be94d0c02920a12cc3daee307762b9b4523fbf33e. Host SHA256: ae4fa5644cebe1c11e4904cbc763a5906d5e1c672152317712c4fe585e636a12. Staged scheduler SHA256: cadbab601c317fb52c756f4597af29754c5156005f6da64396d7969581319832.

The required service source delta is backend.mjs + existing-host.mjs + new core-teacher-scheduler.mjs; index.ts itself is unchanged. No compiled Native archive or upload/readback is claimed. Before any future service installation the original custodian must compare this delta with its actual verified Native178 composition, preserve its mobile/transport guards, compile the exact import graph and bind archive/source hashes. The sole frontend publisher may publish inactive source only; it does not install this service capability.

Proposed smallest new acceptance descriptor: one protected owner/workspace, the two named phones through original custody, at most two source events (lesson and due) and four event/device tuples, at most two registrations and four provider attempts, at most 20 scheduled ticks. Choose a <=20-minute window within one UTC day containing the canonical due boundary and lesson lead, after readiness; do not override canonical timing to force delivery. Exact source parent/child creation counts must be declared from the existing normal UI dependencies before authorization, with zero grades/contributions. No device IDs or credentials go in this packet. No allowance is inferred from the old grant.

Separate authority must name the new finite grant/descriptor and source policy, conditional single service install/readback if needed, exact owned scheduler install with minutely cadence and finite mode, enable/readback and cleanup operations. Both staged enable flags remain false, cron=[] and sample descriptor=null now. Set general delivery OFF throughout a future finite trial. Activate only when service/source/phone readiness and cleanup margin are proven. Require automatic closed-app OS arrival and click destination for both reminder types, peer retention and no duplicate/foreign delivery, then ordered Stop/local+cloud receipts, exact canonical source cleanup, owned schedule removal and OFF/NULL readback. Unknown provider/COMMIT outcomes consume permits; no resend. Rollback means disarm/remove the owned schedule and restore only authorized saved configuration; any service rollback upload needs explicit allowance.

Prior grant60fc7d23 and private candidate d4e695d3 remain untouched. The separately permitted READ-ONLY cleanup checkpoint and post-stability UI simplification scope are retained below. Core V1 remains OPEN; D107/Admin/marketing are deferred.

---

## Preserved earlier checkpoint

# N44 Core V1 automatic reminders — bounded integration checkpoint

AI-authored, 28 October 2026. Task n44-core-auto-1028, run 8d8f5ef4-fc62-486b-8965-63ddba37f0ac.
Base and observed origin/main: deb8562669ac08a7bf50f7ab0a865cc114733109.

## Actual result

BLOCKED by two missing implementation paths in the activated card. No application/service code changed. This is not a qualified scheduler or live acceptance packet. Current Core V1 DECISIONS and current N44 ledger require automatic teacher lesson/due delivery; Admin/D107/marketing are deferred. Click delivery is already verified separately and was not retested. The supplied card records issue 5 follow-up 6464988955; its remote comment was not independently retrieved in this checkpoint.

The actual service entry imports createExistingHost from drafts/n44-push/existing-host.mjs. That host creates createWebEntry, which creates createBackend from drafts/n44-push/backend.mjs. The existing backend schedule operation supports general due/cleanup and a historical one-device operation. It does not consume a finite Core V1 descriptor. Changing only scheduler-entry or the staged worker would leave the server's due selection and send permits unconstrained. Supplying an unknown operation would fail rather than provide automatic reminders. Recreating the backend in the allowed index.ts or adding a parallel engine would duplicate guarded composition rather than repair it.

## Exact missing scope and retry condition

- drafts/n44-push/backend.mjs: wire finite scheduled due selection to the existing owner transaction, canonical prepare/source stamp checks and createDeliveryBoundary. Reserve tick identity/cap before any send, and check descriptor pins/window/send budget in beforePermit inside the same durable transaction as the delivery reservation. Preserve current normal automatic architecture and reject widening/general traffic while finite mode is selected.
- drafts/n44-push/existing-host.mjs: parse and pass the immutable server-only finite descriptor through existing verified host construction. Keep TLS/private-session/typed-query/Auth guards and delivery disabled by default. Do not accept recipient or authority pins from browser/request input.

Existing postgres-repository.mjs rejects arbitrary budget record shapes and namespaces. This is not evidence that a schema change is required: one-device-test.mjs already demonstrates durable fixed day-budget markers. A minimal finite composition can reuse these existing operations with conservative caps within the current per-day limits and an immutable window wholly inside one UTC day. Descriptor identity must be pinned, changed binding denied, counters never reset on tick/run/process restart, and an unknown COMMIT/provider result must never permit replay. No repository/schema path addition is currently requested. If the implementation proves another necessity, record it before expanding scope.

The approved maintenance path may add these two paths to the inactive card only under its own idle/ownership procedure, then the controller resumes this saved candidate/session. This worker did not invoke maintenance, change card/status/locks, or start another worker. This is a path-scope defect, not a service/tool rejection or a grant of live permissions.

## Reused source foundation and affected verification

Existing canonical-source derives lesson start minus lead, and due stages 3/2/1/0 in authoritative preferences timezone. Existing delivery rechecks consent, category, quiet window, canonical destination/expiry, current session and registration; persists sending before provider invocation and does not replay UNKNOWN. These are source observations, not new end-to-end PASS results.

A bounded local smoke invocation of both actual scheduler-entry.runScheduled and the staged bundle runScheduled with both enable flags false returned disabled; injected fetch calls = 0. The staged TOML retains crons=[] and both flags false. No browser/server/lease resource was created. No timing or owner suite was run against a nonexistent finite integration. All three requested composite checks remain NOT_RUN. Exact affected inspection SHA256s and statuses are in tests/n44-core-auto-1028/qualification.json.

## Concrete remaining implementation and live packet requirements

After scope correction: use the existing scheduled entry and staged worker; add only small finite integration where necessary. Pin descriptor/grant identity, owner/workspace/device/registration and source kind/id/stamp/event set; immutable send/tick ceilings; activation and hard end (at most 60 minutes, within one UTC budget day for the existing budget format); stable scheduled tick slots; no manual send operation masquerading as a scheduled tick. Every request at/after hard end must be inert, with automatic disarm and no delayed catch-up. Service-side enforcement is required independently of the caller. Keep all enable flags and crons inactive in delivered source.

Qualify actual composition with synthetic clock/provider: lesson lead and each due stage across timezone boundaries; quiet and category suppression; cancelled/deleted/changed source; changed owner/device/session; repeated/concurrent ticks; failed/unknown COMMIT and provider outcome; restart with retained budgets; cap and hard-end disarm. Use existing canonical source/delivery/repository helpers; no replacement domain engine or live tests here.

The future live packet cannot yet name a qualified new service hash: that artifact has not been implemented. The current index.ts and host hashes are recorded in qualification.json only as inspected preimages, not as deployable new capability. After implementation, bind exact service entry/import-map/archive/module hashes and staged scheduler artifact hash, and describe the minimal difference from original custodian's verified Native178 material. No service upload is permitted now, and frontend publication cannot install that capability.

Separately authorized live acceptance must explicitly name a new immutable finite grant, original-custodian protected account/device references, exact source/fixture allowance, registration/event/provider caps, bounded scheduler install/enable/tick allowance, window activated only after readiness, and owned disarm/cleanup/rollback operations. Preserve current Auth/config and peers; unknown attempts consume their permits. Require genuinely automatic closed-app timed OS arrival and click destination, peer retention/no duplicate evidence, then ordered local+cloud Stop and canonical source cleanup. Keep provider ACK distinct from physical acceptance. No identifiers or secrets belong in this document.

## Historical cleanup and next UI slice

Grant 60fc7d23 remains DISARMED_CLOSED_SPENT; original private candidate d4e695d3 and all FAIL/UNKNOWN receipts are untouched. Root's existing canonical visible deletion receipt is preserved. Remaining cleanup proof requires a separately permitted fresh READ-ONLY same-document checkpoint from Root/original custodian: same owner and ancestry, existing parent/child tombstones and revisions, canonical ACK, pending Sync empty/healthy, zero grade impact, plus exact local/cloud disposition and preferences where not already proven. Preserve the original deletion mutation receipt; never repeat Delete, create, registration, send or clock activation to obtain proof.

Only after actual automatic stability: simplify ordinary teacher settings/center to device state and Enable/Stop, lesson lead, due offsets, quiet hours and autosave. Move technical support identifiers, HTTP details and long source lists into separate safe diagnostics while retaining owner invalidation and real receipt safeguards. No UI was edited in this slice. N44 Core V1 remains OPEN.
