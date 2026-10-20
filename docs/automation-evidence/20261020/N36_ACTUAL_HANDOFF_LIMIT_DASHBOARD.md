# N36 handoff limit, dashboard principal and precise department fallback

Task: continuous-n36-actual-0522-handoff-limit-dashboard-principal-20261020
Run: 536e4ab3-78b9-4172-817b-9284060be45d
Base: b990848dc3b0300bcb8f4ea56c992dce7cb2d063

## Demonstrated failure and bounded correction

The existing background coordinator creates each v3 envelope with expiresAt equal to the minimum of now + 120000, the original review expiry and the original 30-minute job expiry. The existing validator instead required expiresAt - createdAt to equal exactly 120000. Within the final two minutes of an otherwise valid review window, that invariant rejects the coordinator's own envelope as HANDOFF_LIMIT_OR_EXPIRED. This is not a call-counter exhaustion: the relevant branch validates timestamps, row count and bytes; no action-call counter appears in it. The independent per-class 300-row/100000-byte limits are unchanged.

The immutable 0.5.22 worker/protocol graph reproduces that exact error with an already-collected 303-name, 10-class, 20-slot checkpoint and 60 seconds remaining. The corrected graph completes the same serialized background -> handoff -> real app receiver -> IndexedDB path. This demonstrates a source defect consistent with the reported umbrella error; it does not establish the unobserved native account's exact timing.

Only v3 accepts a positive shorter remaining window up to the existing two-minute maximum. The application adapter checks that bound, delegates all schema/row/setup validation to its existing legacy validator and returns the real original timestamps. V1/V2 retain their exact legacy duration. Neither job/review deadline nor receiver grant is extended or recreated. Background coordinator, transport, nonce, document, owner/Auth-session, lease, year/term, receipt and source-navigation guards are unchanged. Unknown outcomes keep their original action/batch and reconcile without reposting.

Stopped limit results now name the transport-limit category instead of generic closed-tab guidance. Confirmed partial local counts remain visible without implying complete transfer or cloud acknowledgement. The actual popup result is rendered and inspected, with no Start click or repeated app toast.

## Principal and department

The supported SchoolDashboard reader now reads visible name text adjacent to the exact قادة المدرسة : label even when the name is in a link. It never follows or extracts that link. The original reader omits the linked name in the representative DOM fixture; the corrected receiver persists it and real settings display it. Multiple distinct leaders produce ambiguity and no chosen principal. The added linked-name handling is restricted to /Dashboards/Schools; the existing route/role/school fences remain.

An explicit labelled department retains priority. Only an empty profile can receive the fallback from an exact final locative school-title suffix such as بمكة المكرمة, resolved uniquely through the existing canonical 47-option mapping. A generic city substring, misleading school name, multiple locatives or an existing user department does not supply a fallback. The fallback uses the existing non-source-wins profile write, its owner-bound atomic outbox/CAS path and normal context guard; it cannot overwrite a newly selected differing department. Existing calendar and teacherForm remain unchanged. A feminine profile with a visible بنين school type stays feminine; no gender inference is added.

## Affected checks

- n36_actual_longjob_handoff_budget_receipts_no_duplicate — PASS in browser.json: original short-window failure; corrected 303 additions, ten unique actions and ten serialized completed receipts, all 20 slots durable, no source roster recollection/navigation. Rendered principal/settings and owner-bound outbox read back from the same document. Original deadlines retained.
- n36_original_owner_expiry_unknown_outcome_fences — PASS: different owner/Auth session, app/source document and true job expiry prevent delivery and durable writes. A fresh worker with an unknown outcome retains the exact pending action/batch, makes no duplicate post and completes after the existing receipt arrives. Unchanged negative proofs are reused after the targeted profile/metadata refinements.
- n36_dashboard_principal_precise_location_only — PASS: linked single leader, ambiguous leaders, outside-dashboard exclusion, canonical suffix, misleading/multiple locations and existing department. Actual serialized explicit-department case takes priority over the suffix; calendar and teacherForm preserved.
- n36_0523_changed_source_package_download_parity — PASS in package.json and download.json: exact source/ZIP/member/hash parity for 27 runtime files, unchanged permissions/hosts/CSP, immutable .22 assets, actual local browser download of .23 with matching bytes and no application navigation. The import view differs only by the guarded department fallback and href/version; N107 and all other receiver logic are exact-base identical.

Commands: browser.mjs (actual HTTP app with existing served-demo/account helpers), then --profile-only / --metadata-only for materially changed profile/metadata checks while retaining unaffected PASS evidence; boundaries.mjs; package.mjs --prepare; download.mjs; package.mjs. All are under tests/n36-actual-handoff-limit-20261020. Boundaries additionally deny expired, future, overlong, oversized-row, duplicate, extra-key, prototype and legacy-short envelopes, including the department path. Changed JS syntax and Git whitespace checks pass; no full build/suite was run.

Preserved harness failures: initial timeout exceeded the canonical helper's bound (corrected to 120000); stored synthetic Chrome values initially retained the host VM's prototypes (corrected to JSON rehydration in the receiving realm, preserving Product plain-object validation); the fixture used an incorrect slot-store assertion and a subject alias rather than canonical العلوم; the standalone metadata fixture initially omitted route-diagnostics bootstrap. These failures remain in owned JSON artifacts. No actual tool-policy denial or service refusal was bypassed.

## Package and disposition

Version: 0.5.23, bumped once from 0.5.22. Archive: assets/extensions/rakeez-teacher-import-helper-0.5.23.zip
SHA256: e79674c119aabba88bdb5a2196d6860179006aea4055050cd90d81278afc7c55
Bytes: 129313; runtime files: 27. The companion manifest records exact per-file hashes. All previous immutable archives remain unchanged. The same candidate changes the application download href/label to .23 for atomic publisher delivery.

Last observed origin/main: bd54480f4c2c8d4107524ca452a9a52b6cf968ed; its affected-path diff from the assigned base is empty. Global app/store/Sync/SW and legacy protocol source are untouched. No startup module path is added; the existing department directory dependency is reused.

Fresh canonical isolated local browser contexts use only owned loopback ports 49642/49643, with external requests and Service Workers blocked. Contexts/browser/server close in finally; temporary browser download is deleted. Chrome tab creation is forbidden at the synthetic API boundary. This is not native MV3, live portal, real account, provider or whole Sync certification. No live collection, real data mutation, SQL/Auth/service operation, queue edit or push.

Publication/immutable/served verification, existing stable updater installation and physical folder parity remain NOT_RUN by this worker and belong to publisher/controller phases. Chrome reload and actual user success are not claimed; whole N36 remains open for actual acceptance.
