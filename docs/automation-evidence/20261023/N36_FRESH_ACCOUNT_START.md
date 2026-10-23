# N36 fresh-account first Start — scoped local correction

AI-authored, 23 October 2026. Task `continuous-n36-fresh-account-academic-start-20261023`, run `1fa756aa-86c0-4594-9345-0a2c4d38d462`; base `6d9e4effb6d46943085a7a015f07bc11495de440`.

## Reproduced boundary

`tests/n36-fresh-account-start-20261023/baseline.json` records the actual application boot, native Chromium IndexedDB and actual extension 0.5.37 popup/worker. The fixture uses `runAccountProvisioning` and its supplied `buildAccountFoundationDefaults` records with fabricated server canonical responses, a fresh registry/database, no demo seed, no preselected academic pointers and no teaching rows. The existing account routing, store ownership checks and actual Auth verification/lease implementation run; only the Auth HTTP response is fabricated in memory. No external request is permitted.

Provisioning produces null device academic pointers. The mounted store finishes initialization while the first Auth verification is held; after verification the lease becomes writable, but baseline device pointers remain null. The UI/store fallback resolves the sole year and term 1. Start fails at binding/worker-ack with `APP_ACADEMIC_SELECTION_REQUIRED`, staged/observed zero and home/sourceGuard/descriptor/fetch counters zero. In `persistedSelection`, two live terms prevent null `activeTermId` from being qualified. This reproduces the supplied source hypothesis. It establishes a first-lease initialization defect; it does not establish Incognito itself as the cause or inspect the PO's account.

## Correction

Only `src/store.js` changes. After normal verified workspace renewal, before renewal readiness resolves, complete the untouched provisioned device selection using the same first academic index as existing `ensureFoundation`. Do not rerun `ensureFoundation`, provisioning, restore or migration. No new dependency or offline-shell change.

The completion requires the existing account-provisioned descriptor, receipt, ownership/session/readiness and writable checks; both pointers must still be null. A single existing `rawDB.applyBatch` transaction reads device/foundation and Product collections, compares them with the mounted checkpoint, refuses prior teaching data/outbox/batch traces, conflicting owners, noninitial revisions and ambiguous years/terms, and invokes the existing Product write guard. Canonical provisioning decodes foundation rows without `ownerId`; their existing receipt-bound provenance remains authoritative, while an explicit owner conflict is refused. It writes only the device's year/term pointers and timestamp, awaits commit, then updates memory. Academic records and outbox are unchanged. Valid user selections are retained. It neither changes nor prolongs the lease, and the receiver's persisted-selection/unknown-receipt guards are unchanged.

## Actual affected checks

`node tests/n36-fresh-account-start-20261023/certify.mjs` certifies 16 selected observations (baseline plus 15 candidate scenarios) against the exact store hashes and resource cleanup in their JSON files. Source syntax and `git diff --check` also passed. No blanket suite or build was run.

- Fresh delayed verification: pointers remain null before readiness; after readiness exactly one device put, no other initialization writes or outbox entries, unchanged years/terms. Actual extension Start reads the synthetic source and imports two rows with a saved receiver receipt. A second explicit Start recognizes existing rows without duplicates. Reload preserves students, academic selection and durable receipt in the same new-document checkpoint.
- Already-writable boot uses the existing initialization default. A valid existing nondefault term remains selected and passes the real receiver entry.
- Refused verification, mature data, additional ambiguous term and explicit foreign-owner foundation do not gain an automatic selection.
- Concurrent device selection is preserved; if normal hydration makes it coherent, Start may qualify that valid choice. Owner/session/lease changes and a native transaction abort refuse the write. A subsequent genuine term drift during transfer yields an unknown outcome, not a saved receipt.
- A native final-receipt put fault after two rows commit remains unknown with a pending trace. Repeated Start preserves its nonce/rows and performs no additional source reads; genuine term-drift uncertainty is likewise retained.
- `corrected-boot-cases.json` includes the actual calendar settings DOM/handlers/CSS: term 1 carries the current badge, year matches the stored year, and the same rendered defaults agree after reload. `rendered-defaults.png` was visually inspected. The import page screenshot was also inspected; the popup screenshot is a transient repaint during the repeat Start, not acceptance evidence.

Evidence is deliberately composed from unchanged successful cases in `first-certification.json` and corrected fixture cases in `corrected-boot-cases.json`. Original harness failures remain in `original-harness-failures.json` and `first-certification.json`: fixture URL query violated the extension's existing app URL contract; a complete-batch repeat was incorrectly assumed to perform no reads; a pre-checkpoint raced already-writable store initialization; initialization instrumentation included the fixture's own setup writes. The fixture now clears its case query before extension Start, waits for store initialization, excludes setup writes, and expects legitimate complete-batch re-collection to deduplicate. Earlier source-fixture preparation also used a legacy optional-rejection scenario that .37 refused; the small import uses an explicit coherent school/timetable fixture. No Product guard was relaxed to correct these harness expectations.

## Reused scope and limits

Extension source/ZIP/protocol, all shared libraries including lease/security policy, app entry, receiver, models and `sw.js` are unchanged from base (certifier checks protected paths). Existing .36/.37 303-row/transport/source evidence remains unchanged; it was not rerun. Historical unknown batches and timetable proof are not resolved by this correction.

Browser runs use the canonical `withIsolatedLocalBrowser` helper with this active synthetic card, owned loopback port 49947, fresh disposable contexts, blocked Service Workers/external network and no shared live-browser lease. Each run closes its owned contexts/browser/server in finally; JSON records cleanup. No real account/profile, service, provider, Issue, queue, push or deployment operation occurred. This is local readiness only; the independent publisher owns delivery and Production verification. N36 remains open for actual acceptance.
