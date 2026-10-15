# N107 — LOCAL_READY after reviewed resume

## Current result — run c61563e2-10f5-4440-887d-4142bce81803

Continued the same saved session/worktree and preserved candidate `6017d0a344115095461318ecf0b80385eacfc288`, based on `2b875721e8cee777489d8e99fb2a253065cdbb4e`. **Product source did not change during this resume.** The final AI commit adds the validated browser harness/evidence and the supplemental lease fixture adapter. Its full candidate SHA is returned in the runner result.

Fresh canonical state showed N106 absent from active workers, no browser lease, `deliveryInFlight: null`, and no publisher process. The canonical phase helper acquired the browser lease for this run. Actual app checks used `http://127.0.0.1:49107`, original application modules/DOM/handlers/CSS, fresh disposable contexts, no user profile/credentials, only synthetic local data, and blocked non-loopback requests. The separate installed-offline context allowed the real Service Worker. Browser, contexts and HTTP server closed in each owned finally; the canonical phase helper returned `RELEASED browser` afterward.

Executed successfully:

```text
node tests/n107-classes-import-browser.mjs
node tests/n107-classes-import-browser.mjs --recovery-only
```

Nine actual browser check records PASS in `tests/n107-classes-import-browser.json`:

- 320, 390, 768 and 1280: RTL, light/dark empty/populated Home and Classes, state-A secondary import only, top toolbar, bottom Demo, central class-scoped import/export, actual CSV preview/cancel/final save of ONE of two groups, actual XLSX explicit missing-context mapping, no horizontal overflow, no score creation. The actual bottom Demo button creates a synthetic account-local package; existing two-step deletion cancels without writes and then deletes only that Demo while preserving the imported real-class-shaped synthetic rows. Pending outbox on the imported class correctly refuses N77 deletion rather than bypassing Sync.
- Actual account entry rejects archived/foreign teachings, wrong Auth user/session and other term. Expired offline lease hides import and performs no Product writes.
- Real SW v65 cached both new modules; a controlled Demo document reloads the import route and opens the central selector offline. This is local offline certification, not live account/Sync certification.
- Actual injected student-transaction failure shows saved section/teaching IDs, zero saved students and the pending name in the rendered receipt. A fresh explicit review/confirmation imports the name once, preserving the same section and default-item count, with no scores. The class card opens its actual hub.
- Auth session changes while the final modal is visible reject with zero writes and retain pending names. Only a subsequent explicit same-owner review permits continuation.
- Changing term after preview rejects before confirmation/write. Keyboard Tab reaches controls; app Back follows the actual recorded predecessor (including the class hub), with no navigation-side writes.

Inspected screenshots from the actual app, including 320 light fresh Home, 1280 light fresh Home, 390 dark populated Classes and 390 partial receipt. The screenshot set remains in ignored local artifacts `test-results/n107/`. JSON records SHA-256 of all eight changed Product source files and the tested Product commit; these bytes are unchanged in the final candidate.

The first unvalidated harness exposed four test-assumption failures, preserved verbatim in `previousFailures`: stale old-route/old-paint selectors (fixed by waiting for actual route content and preview paint), expecting real-class deletion to ignore its pending Sync outbox (corrected to assert the original safe refusal and exercise two-step Demo deletion), and assuming Back always means Classes (corrected to the existing observed in-app predecessor contract). No Product guard was weakened or changed to pass these checks. The later recovery-only run reused the already-passed width/offline evidence.

### Supplemental original subject assertions — valid fixture, no Product lease changes

The old helper only mounted the registry account. It omitted `leaseGeneration`, Auth user/session, persisted matching Auth storage, the runtime context update and a verified lease renewal. `workspaceLeaseBinding` and `renew` correctly reject this missing evidence, explaining the historical `OFFLINE_LEASE_LIMITED` on both candidate and base.

The allowed `tests/n12-student-import.test.mjs` is a fixture adapter that imports the **unchanged original** `subject-flexibility.test.mjs` and retains every original assertion. Before each original test it supplies a matching synthetic session/storage, the lower-level claimed-account descriptor with generation `[owner,null,null,null]` used by the existing N12 store fixture, updates the actual runtime lease context, and renews with the existing verified-owner callback contract. It asserts `editable === true` before running assertions. This lower-level subject fixture does not claim UI account provenance; the actual N107 UI checks separately used a provisioned account receipt and the real provenance guard. No Auth/lease/Product implementation or denial assertion was changed.

Executed:

```text
node --test tests/n107-central-entry.test.mjs tests/n104-class-operations.test.mjs tests/n107-classes-import-mutation.test.mjs tests/n12-student-import.test.mjs
```

**18/18 PASS**: original source/route inventory, owner/provenance and term/session/DB/cross-tab negatives, partial retry/idempotency, and all six unchanged supplemental subject assertions with the corrected fixture. Historical direct-entry failures below remain historical facts; the supported supplemental invocation now uses the fixture adapter. Unchanged parser (4), original N12 parser/store (9), and section-validation (10) PASS evidence is reused from the saved candidate. No blanket suite/build/Preview was repeated.

Result: **LOCAL_READY**, with no local blocker. Sole controller/publisher still owns integration/build metadata/Cloudflare/provider and exact served asset checks. No push, deploy, service operation, real teacher/student write, queue/status edit or Product acceptance claim was made.

## Previous attempt — historical record, superseded by the current result above

AI-authored implementation and evidence. Task `continuous-n107-central-classes-local-file-import-20261015`, run `d3c03b8f-0bdd-4dba-b907-f1643fb52721`. Base `2b875721e8cee777489d8e99fb2a253065cdbb4e`. Candidate is the commit containing this record; its full identity is returned in the runner result.

Read the canonical operating contract, activated canonical card and current canonical N107 Product row. The worktree ledger predates N107; the canonical row says IN_PROGRESS and limits this change to local teacher-uploaded files. No queue, ledger, service, Auth, schema or real account mutation was performed. No push, Preview or deployment was performed.

## Implemented scope

- Home state A retains primary creation and adds secondary green class import. Other Home states get no extra import action.
- Both Classes states use the same top toolbar: class import, add, central Koshoof, quiet accessible trash icon. Existing two-step delete and owner-scoped Demo deletion implementation are retained. Demo creation moves to the bottom. Cards retain their main link and lose the redundant Koshoof shortcut.
- `#/classes/import` reads actual CSV/XLSX through the existing vetted `readStudentFile`. Source choices explicitly mean uploaded files, including Noor/Madrasati exports, without portal login/network integration.
- Simple columns: `الصف، الفصل، المادة، اسم الطالب`. Student name is optional. Alternative headers near the top are detected; column selection and explicit manual missing grade/section/subject are available. Unknown grades and unsafe labels/subjects block review. Explicit school metadata must match the configured school and may not mix schools.
- Preview groups grade + normalized section + subject alias identity. Repeated/invalid names block that group rather than silently merging students. Same names in different groups remain separate identities. Existing or archived same-year sections are rejected and directed to existing Koshoof for teacher review. Different years remain separate.
- Each explicit final confirmation saves only one selected group through existing subject resolution, section creation, teaching creation/default items, and student import. Other groups say «للمراجعة لاحقًا».
- Private immutable review capabilities bind workspace object/database/provenance, Auth session, active year/term, reviewed class and names. Guards run before steps, after awaits and inside the existing persistence transaction. Persisted class/roster/device-term changes from another tab reject the write. Optional guarded-save callbacks retain existing outbox/lease/owner mechanisms; no raw Product database writes were introduced.
- Partial in-memory receipts retain section/teaching IDs, saved count and pending names. Explicit retries reuse only the saved steps; successful repeat calls create no new outbox, default items or students. Session callback changes stop continuation; a later explicit same-owner review can rebind the current session. Drafts are memory-only, not crash recovery. Switching account/workspace clears visible draft data for owner isolation; existing class collisions remain rejected after reopening.
- Central Koshoof lists only allowed current-term teachings with separate contextual import/export links. It does not promise bulk export.
- Store now statically imports `class-import-file.js`, and router dynamically imports the new view. Both are added to the existing offline shell; cache generation advances v64 → v65. Offline installation/reload still needs the browser check below.

## Actual checks

Executed:

```text
node --test tests/n107-central-entry.test.mjs tests/n107-classes-import-parser.test.mjs tests/n107-classes-import-mutation.test.mjs tests/n12-import.test.mjs tests/n12-import-store.test.mjs tests/n104-class-operations.test.mjs tests/subject-flexibility.test.mjs tests/section-validation.test.mjs
```

Result: **39 PASS, 2 FAIL / 41 tests**. The N107 parser (4), N107 mutation (6), N107 source/route inventory (2), N12 (9), N104 (4), and section validation (10) tests all PASS. Expected injected transaction failures log errors while their rejection/partial-receipt assertions PASS.

The two supplemental `subject-flexibility.test.mjs` failures are at lines 82 and 122: `OFFLINE_LEASE_LIMITED` before subject persistence. A read-only Node loader replayed that suite with the exact base Git blob for `src/store.js`; the **same two failures** occurred (4 PASS / 2 FAIL). This is preserved as FAIL, not converted to PASS or repaired by weakening a lease. The N107 valid-account fixture exercises actual subject resolution, alias reuse, owner-bound outbox and defaults with a genuine synthetic lease.

Source/route inventory checks are **not rendered-UI evidence**. The real-browser harness has been prepared in `tests/n107-classes-import-browser.mjs` but **has not run**. No screenshots or offline-install PASS exists. Intended coverage is actual app HTTP DOM/handlers/CSS at 320/390/768/1280, RTL light/dark, fresh claimed synthetic empty/populated accounts, CSV confirmation/cancel, XLSX mapping, central Koshoof, delete-step cancellation, owner/term/archive/offline expiry and separately installed offline routes. Harness remains unvalidated until its first permitted run.

## Exact blocker and retry condition

Canonical `resource-lease.ps1 -Name browser -Action acquire`, with this canonical task file, run token and `-WaitSeconds 0`, returned the same response twice:

```text
BUSY browser; the recorded owner must finish or be factually recovered
```

Observed lease owner: task `continuous-n106-koshoof-followup-ux-identity-mapping-20261015`, token `ad277a1f-fc36-4411-99ce-7b7542f8b321`, worker PID 8472, birth `2026-10-15T17:59:30.5954960Z`, lease recorded `2026-10-15T18:02:25.3069978Z`. This worker did not alter or reap that lease. This N107 card contains `liveMutation: true` and `liveAuthorizationRef`, so the non-shared isolated-browser exception is ineligible. No browser/server was launched and no browser resource was owned or left behind.

Return **BLOCKED**, preserving this candidate/session. Retry only once the canonical browser lease is released by its owner or factually recovered by the authorized controller. Resume this worktree/session, acquire the phase lease, run and validate the prepared actual-app harness, resolve actual failures in scope, inspect rendered results, release owned resources, and return a new exact candidate. Do not repeat passed unaffected parser/store checks merely to restate contention.

Provider, integration, build metadata, Cloudflare and exact served-asset verification remain exclusively with the controller/publisher after local readiness. This record makes no Product acceptance, deployment or CLOSED claim.
