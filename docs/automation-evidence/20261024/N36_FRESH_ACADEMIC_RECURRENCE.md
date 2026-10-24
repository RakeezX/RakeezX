# N36 — fresh account academic recurrence, 24 October 2026

AI-authored. Task `continuous-n36-fresh-academic-recurrence-20261024`, run `1ee94e6d-6fdf-4e7f-afec-36c16a8d1026`; base `3b6dfe789297c98e4a6ff1b977e098796a633b37`.

## Current-source reproduction and cause

`git ls-remote origin refs/heads/main` returned the base above. The previous candidate `6d114069e2a85c04e83d975905916aa686bebc06` and its exact tests/report were read first. Its post-renewal completion already exists; this is a different, newly reproduced refusal inside that completion. The old fixture assigned revision 1 to every foundation row and skipped the real profile-completion lifecycle. It therefore could not expose the current service's initial revisions.

`tests/n36-fresh-recurrence-20261024/baseline.json` uses the current main store, actual mounted app/CSS/profile form, actual extension 0.5.41 popup and worker, fresh Chromium/native IndexedDB, and the real `runAccountProvisioning`. No academic pointers, demo records, years, subjects, classes or student rows are injected for this reproduction. The user completes the existing initial profile form; its normal handlers call the existing RPC adapters against a disposable local PostgreSQL instance. The server fixture reuses the existing N117 native qualification setup and its exact service migration dependencies. No live database is contacted or changed.

The server's normal profile setup returns **profile revision 3**: education department advances to 2, then profile completion advances the identity/contact fields to 3. Initial provisioning inserts the year and then selects its approved calendar, returning **year revision 2**, with `fieldRevisions.calendar_selection = 2` and every other year group still 1. Terms/calendars/days/subjects/time profiles remain at revision 1. The descriptor is `account-provisioned`; its owner-bound version-1 receipt and foundation hash come from the normal provisioner/registry, not handwritten pointers. These revisions are produced by repository SQL, not guessed fixture numbers.

After provisioning and its normal reload, the fixture holds the first Auth verification until store initialization finishes. Both persisted pointers are null. Release runs the existing verified identity, workspace routing and writable lease path. The completion's blanket `row.serverRevision !== 1` condition refuses the otherwise pristine foundation. No device put occurs. Actual .41 Start then stops at **binding / worker-ack / APP_ACADEMIC_SELECTION_REQUIRED**, with source timing counts, staged/observed rows and receipts all zero. There is no historical 302-row run or prior UNKNOWN involved.

`public-source-identity.json` separately records an anonymous static fetch: the published `src/store.js` SHA-256 exactly matches the base source. Public generated build metadata has a different content fingerprint, recorded honestly. This rules out a stale source assumption for the reproduction; it does **not** establish what version was loaded in the user's actual Incognito document. That document/account was not inspected.

## Small correction and preserved guards

Only production file `src/store.js` changes, inside `completeProvisionedDeviceSelection`:

- A positive safe-integer profile revision is valid metadata; completing or syncing a profile is not academic use and cannot by itself establish academic ambiguity.
- A year at revision 2 is permitted only when `calendar_selection` alone is at 2 and every other supplied year revision group remains 1. Other academic rows still require revision 1. A changed year label at revision 2, later calendar revision, or changed term is refused.

All surrounding restrictions remain: ready account-provisioned workspace, both pointers unset, owner/session/workspace/database binding and writable lease, versioned provisioning receipt/generation, exact in-memory versus durable checkpoint, no teaching/Product rows or outbox, no previous import/lifecycle/delete trace, no deleted or conflicting-owner foundation, exact foundation counts, sole live year, approved selected preset, coherent indexed terms and open first term. The transaction still rechecks guards, writes only the device, awaits commit, then publishes the saved selection. User-selected pointers win. No receiver selection proof, UNKNOWN receipt, calendar record, lease/security policy, extension protocol/package, schema, migration or dependency changes.

The existing first-academic-index policy in `ensureFoundation` remains the policy. No new choice or default is invented. The current service's ordinary first-account initialization can safely use that policy once the incorrect revision assumption is removed; an extra selection flow is unnecessary for this reproduced case. The calendar-switch temporary hold is unchanged.

## Affected evidence

`node tests/n36-fresh-recurrence-20261024/certify.mjs` certifies **20 selected observations** and the three required named checks in `certified.json`, with exact store/evidence hashes. No blanket suite or Vite build was run. `node --check` and `git diff --check` pass.

- Fresh completion: null before verified readiness; exactly one device put afterwards; unchanged year/term rows and empty outbox before import. Actual .41 Start imports two synthetic students, saves a receipt, repeats without duplicates, then reloads with the same owner/database, rows, selection and durable receipt in the new document checkpoint. After repeat the receipt correctly says `existing`; the original first outcome says `saved`.
- Actual profile Sync before first import: normal profile completion changes the server profile to revision 4; the actual Sync coordinator reaches `synced` and refreshes the store itself. Start/import/repeat/reload succeeds. The selected final proof in `settled-sync-and-rendered.json` does not manually hydrate or refresh state.
- Actual calendar DOM/handlers: initial term 1 is marked current and agrees with disk after reload (`rendered-defaults.png`, visually inspected). The existing “اجعله الحالي” button selects term 2; a subsequent verified renewal preserves it and the real receiver qualifies it.
- Refused Auth, mature teaching data, ambiguous terms, foreign owner, owner/session/lease changes and native transaction abort do not gain selection. Concurrent valid user selection is preserved. Year-label edit, later calendar revision, term edit and prior UNKNOWN trace remain refused; the previous trace is retained.
- Term drift during transfer and final-receipt failure remain UNKNOWN. Repeated Start preserves the nonce and rows and performs no additional source reads. A receipt put fault never becomes a saved receipt.

Successful observations are selected individually from their aggregates; failed aggregate cases have not been relabeled. `academic-and-sync.json` preserves the original wrong text locator (the button says “اجعله الحالي”) and a Start during asynchronous Sync that was correctly refused before collection. The corrected Sync check waits for actual coordinator/store settlement. `selection-sync-receipts.json` contains an earlier redundant harness refresh after Sync success; only the later refresh-free proof is selected for Sync acceptance. Original missing-RPC-binding/Auth-hold and Sync-metadata comparison/role-serialization harness failures remain in their original JSON files. The certifier's first assertion incorrectly expected the pre-repeat `saved` label after a deduplicating repeat; it was corrected to assert both original `saved` and final `existing`, without rerunning Product behavior.

The unchanged 0.5.41 timetable/source matrix is referenced by hashes of `tests/n36-actual-timetable-20261023/certificate-913a4635.json` and `certified-runtime-913a4635.json`. Extension/source/protocol/ZIP and all libraries, receiver, app entry, service SQL and `sw.js` are unchanged from base. This slice adds no startup dependency or offline-shell obligation.

## Resources and limits

Canonical `withIsolatedLocalBrowser` checks use owned HTTP port 49948, fresh synthetic contexts, blocked remote network and Service Workers, and no personal profiles/cookies. This eligible isolated phase does not reserve the shared live-browser lease. Contexts/browser/server close in finally. The native PostgreSQL fixture uses its own random loopback port/cluster; queued operations drain, its owned server stops, and the bounded owned directory is removed before results are written. The certifier checks recorded cleanup and absence of owned runtime directories.

No real account/profile/browser/service reads, real data writes, provider operation, push, deployment, queue edit or Product closure occurred. Local synthetic readiness is established. The independent controller/publisher still owns integration and exact served verification of this candidate. Real new-account/Incognito acceptance and full N36 acceptance remain explicit and unclaimed.
