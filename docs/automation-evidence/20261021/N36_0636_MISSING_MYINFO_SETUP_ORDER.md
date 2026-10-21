# N36 — AI: immutable setup-order proof and empty MyInfo repair

Task: `continuous-n36-0636-missing-myinfo-setup-order-20261021`
Run: `33864882-7d7d-4a20-a301-78ec47c3fbe1`
Base: `baa8fe5eb4577362d81ab9643aef219331fa2f06`

## Immutable result and exact cause

The public `https://rakeezx.com/assets/extensions/rakeez-teacher-import-helper-0.5.32.zip` was fetched before implementation. Its 143808 bytes match the checked-in immutable ZIP and manifest SHA256 `600532ddac600a66f9b0bc8b6be50b4ea4a4f72352f71c95376296a7719f35b6`. All 29 unpacked runtime files, including popup/CSS, selection, background/collector and source adapter, were used by the synthetic HTTP runtime. Existing protocol-origin substitution is confined to the synthetic receiver boundary.

`immutable.json` preserves eight actual application/receiver cases. Both opposite DOM orders **pass** without MyInfo, from the teacher dashboard and selected teacher-card entry: each setup route is read once after report school binding, both saved receipts contain supported setup, and 303 rows persist. There is no lost classes/timetable route in those four cases; changing queue priority would be unjustified.

The other four cases **fail** with MyInfo present and an explicitly empty school field (`<dl><dt>اسم المدرسة</dt><dd></dd></dl>`). The metadata reader emits a school table with an empty value. The source adapter inserts that empty value into `schoolNames`, and the collector consequently marks an empty name bound; the next report read refuses `SCHOOL_CONTEXT_CHANGED`. With a selected card, its nonempty consistency constraint refuses the empty field earlier. There are zero receiver deliveries in all four failures. This prevents a truthful NO_CHANGE result.

## Minimal correction, 0.5.33

The source adapter discards only empty school metadata tables before school binding/conflict comparison. They supply no identity evidence. The already queued observed report remains the source of the explicit school name; no new route, retry, enqueue or navigation is added. Existing nonempty conflicting-school, role, SchoolId, readProof, document and receiver owner/session/batch checks remain intact. No students transfer until all existing school-binding gates pass.

Executable change: one filter and its comment in `source-adapter.js`. The other Product edits are the manifest version, README note, versioned ZIP/manifest and exact application download href/label. Background queue/runner/collector, selection, receiver/store, grade/Sync/date/offline-shell code and permissions/CSP are unchanged.

## Affected verification

Evidence: `tests/n36-0636-missing-myinfo-setup-order-20261021/`.

- `immutable.json`: four no-MyInfo PASS cases and four explicit empty-school FAIL cases above, including actual 300+3 receiver outcomes and source request traces. Original failures remain FAIL.
- `candidate.json`: **17 PASS** cases using the exact prepared .33 ZIP. Eight positive cases cover no MyInfo / empty MyInfo × setup before / after MyStudents/report DOM order × dashboard / selected-card entry. Live DOM assertions establish visible observed links, one unique SchoolId and no badge. Every classes/timetable GET is bound, occurs exactly once in the HTTP request log, follows report binding, and retains teacher/principal/school/classes/timetable in **both saved receipts (300+3)**. Actual profile, timetable/subject relationship, 303 students, complete coverage, owner-bound Outbox and unchanged scores/years are checked.
- Nine negatives: absent report school; late report conflict after 300 staged rows; owner, document and session drift; nonempty conflicting MyInfo with/without selected card; empty MyInfo plus missing report school with/without selected card. All stop specifically with **zero deliveries/receipts**, preserving students/profile/Outbox. A selected card alone cannot bind the school.
- Source request allowlist, inert script/image/iframe traps and zero unexpected source resources pass. Dashboard scenarios have zero visual navigation. Selected-card scenarios retain exactly their single explicit teacher-role transition; setup/roster collection never navigates.
- `package.json`: all 29 source/ZIP paths, sizes and SHA256 match; historical packages, manifest permissions/hosts/CSP, affected unchanged receiver/data/offline assets and JS syntax pass.
- `download.json`: actual application DOM/handler downloads .33 with the exact archive hash and unchanged app route. Popup, populated receiver/settings and application download screenshots are captured; popup and download rendering were visually inspected.
- `checks.json`: aggregate assertions validate actual HTTP counts and saved receipts, preserve immutable failures, and bind current source bytes to the candidate runtime fingerprint. No full Vite build or unrelated suite was run.

Reproduction:

```powershell
node --experimental-vm-modules tests/n36-0636-missing-myinfo-setup-order-20261021/runtime.mjs
# Expected FAIL on immutable .32's explicit empty-school cases.
node tests/n36-0636-missing-myinfo-setup-order-20261021/package.mjs --prepare
node --experimental-vm-modules tests/n36-0636-missing-myinfo-setup-order-20261021/runtime.mjs --candidate
node tests/n36-0636-missing-myinfo-setup-order-20261021/download.mjs
node tests/n36-0636-missing-myinfo-setup-order-20261021/checks.mjs
```

`--candidate --remaining` reuses successful cases only with the same runtime fingerprint. This was used for additional targeted negatives without replaying unchanged positive cases. `candidate.json.previousFailures` preserves a test expectation bug: the card-prefixed conflicting-info case correctly returned SCHOOL_CONTEXT_CHANGED, while the harness initially expected APP_CHANGED; its classification was corrected and only that case rerun.

`harness-initial.json` preserves initial harness errors: unrelated application push-config 404s were counted as source requests, and the observer incorrectly required metadata itself to be bound. `harness-popup-and-empty-field.json` preserves the subsequent popup refresh wait failure and an ambiguous paragraph label/value fixture. The harness now checks source requests separately, allows preliminary metadata as the existing contract requires, reopens the actual popup to read persisted status, and represents an empty school field explicitly with dt/dd. The later `immutable.json` failure uses this valid empty field and is the Product reproduction, not those harness failures.

The canonical isolated-local-browser helper owns disposable contexts/browser. Ports **49866/49867** are loopback-only task servers closed in finally, as recorded in result JSON. This active synthetic phase does not reserve the shared live-browser lease. No real source browser, credentials, persistent profile, Service Worker, real account mutation, service operation, queue/status change, push or deployment occurred.

## Prepared identity and remaining delivery

Version: **0.5.33**. Archive: `assets/extensions/rakeez-teacher-import-helper-0.5.33.zip`, **143911 bytes**, SHA256 `48bf7ce0af84bac3739b39ad143c91456eada39a00b5fbe801f1b3d5fbc5b5d0`. Companion manifest lists the same exact **29 files**.

Production publication and stable installed-folder parity are **NOT_RUN** here; the independent controller/sole publisher owns those phases. Actual Madrasati/manual acceptance remains unverified and N36 is not CLOSED. Local package/source parity is not a claim that the stable folder was updated.

## Saved-session continuation: result classification

Continuation run `8adeead2-377d-4fb2-9ff4-d7c447042267` resumes Product candidate `6bcd95d8806eddecb13935398508473e58e8565c`. The prior result was rejected by candidate validation: `An affected check must pass and no recorded check may fail`. The final result had incorrectly mixed the intentionally failing historical .32 acceptance outcome into candidate readiness checks, although .33's affected acceptance checks passed.

The aggregation now gives the distinct **failure-reproduction assertions** their own check, `n36_0532_immutable_setup_order_failure_reproduction`. It requires the historical .32 outcome to remain FAIL and verifies its exact failure codes and zero deliveries. It does not relabel .32 acceptance as PASS. `immutable.json`, all raw browser/receiver results and the prior committed result classification remain preserved; the new aggregate additionally records `immutableAcceptanceStatus: FAIL` and the original evidence run ID.

Only this aggregation and documentation changed during continuation. The .33 executable/package/link and all 17 successful scenarios remain unchanged and are reused. No browser or service phase was reopened. The current-run aggregate was checked with:

```powershell
node tests/n36-0636-missing-myinfo-setup-order-20261021/checks.mjs --run-id=8adeead2-377d-4fb2-9ff4-d7c447042267
```

## Required-name correction — resumed run 947c4d46-6f79-4cb5-8290-52ceca171067

The activated card explicitly clarifies that the expected red-first reproduction is reported under the original required name `n36_0532_immutable_full_runtime_no_myinfo_opposite_dom_order_setup_receipts` with PASS for reproduction proof. The aggregate now uses that exact name, replacing only the distinct reproduction alias introduced in the prior continuation. Its assertions and evidence meaning are unchanged: immutable .32 acceptance remains FAIL, all original traces remain untouched, and unchanged .33 evidence is reused. All other aggregate check names and statuses remain unchanged. No Product code/package/link change, new browser phase, publication or queue mutation occurred.

Current-run verification: `node tests/n36-0636-missing-myinfo-setup-order-20261021/checks.mjs --run-id=947c4d46-6f79-4cb5-8290-52ceca171067`, JS syntax, unchanged Product/raw-evidence Git comparison and whitespace checks.
