# N36 1150 — ownerless academic selection

AI implementation evidence. Task `continuous-n36-1150-ownerless-year-term-selection-20261021`; run `a721f179-0912-45cf-9d37-3cdf4aaffc8c`. Base `e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3`.

## Inspected predecessor and contract

Inspected predecessor candidate `6f9cd28eab5e44f63bafd5eb3aab99dcbbe3506e`, integrated in this base. The canonical predecessor card is `awaiting_po` with Production verification recorded at `2026-10-21T12:12:53.673Z`; the current canonical N36 ledger records publication as `2f235deaf73c9ab92a57ed53c518a5c216180304`, 0.5.36 archive hash `1a2a4d1f70e27a30f262b176c65c22e8d412e5ff8d6cede1ee7d073ced21b46f`, and stable 29-file parity. These are existing independent-publisher observations, not delivery actions by this worker. The prerequisite is integrated and published, not BLOCKED.

The predecessor requires exact ownerId in both prepareExtensionBatch and persistedSelection, and active-only status in persistedSelection. Models create ownerless years/terms by default. Store assertClassImportAccess accepts null/absent ownerId only within its verified immutable mounted account/DB/Auth/provenance/lease contract, denies any non-null foreign owner, and uses isTermClosed (closed term or archived year). It allows coherent upcoming year/term. Read the current canonical N36 row, activated card, operating contract, affected store/models and existing receiver/runtime helpers only.

## Bounded correction

Changed only the two N36 year/term qualification conditions in `src/views/class-import-center.js`. Both preserve explicit non-null foreign-owner denial. The durable condition mirrors closed-term/archived-year semantics on the transaction's own rows, permitting coherent upcoming rows. It does not use an older store snapshot to decide durable row status.

The surrounding real store import gate and exact account/database/workspace/Auth session/document/lease binding remain required. Start still qualifies durable academic selection before source collection. Missing/deleted raw selection still needs a unique coherent match; valid different selection and late record drift fail closed. Exact row snapshots and transaction guards remain intact. No calendar-region hold, nonce, uncertainty, receipt, source collector, extension, store, Sync, model, service, offline shell or data policy changes.

## Actual synthetic runtime evidence

`tests/n36-1150-ownerless-year-term-selection-20261021/runtime.mjs` reuses the predecessor's actual application, popup/CSS, collector/background VM fixture, synthetic account provisioning/mounted provenance, real store entry, native IndexedDB and canonical isolated browser helper. It serves actual app modules over owned loopback HTTP at port 49941; source pages/service responses alone are synthetic. No personal browser, credentials, remote source collection or live mutation.

`certify.mjs` produces `certified.json`: 26 selected PASS cases tied to the exact application and unchanged extension-runtime hashes. Four are expected predecessor-regression reproductions; 22 are corrected-runtime cases. Commands use `node --experimental-vm-modules tests/n36-1150-ownerless-year-term-selection-20261021/runtime.mjs`, N36_CASES/N36_LABEL as recorded by each result; use `--baseline` for immutable base app and `--ownerless` for regression fixtures with absent parent ownerId. Certification uses `node tests/n36-1150-ownerless-year-term-selection-20261021/certify.mjs`.

- `baseline.json`: ownerless active, ownerless upcoming and owned upcoming each pass the actual store gate but the immutable predecessor denies Start, zero source reads beyond initial dashboard, zero deliveries/writes.
- `baseline-persisted-ownerless.json`: memory retains owned parents while only durable parents lack ownerId; the store allows import and the predecessor's persisted qualification denies before source collection. This isolates the durable owner check from its separate initial memory owner check.
- `candidate-positive.json`: the three independent requested positives each finish the original 303-row batch with exactly two saved outcomes (300+3); exact deep equality with durable receipts, 303 current students, no pending envelope, no academic selection change.
- `candidate-initial-pending-assertion.json`: reuse its nine passing unchanged controls: foreign year, foreign term, closed term, archived year, late term-owner change in the second student transaction, and owner/session/database/lease mismatches at Start. Start denials collect zero rows, deliver nothing and preserve students/device. The transaction owner change leaves only the first 300 students and first exact confirmed receipt, with the second outcome unknown and no new receipt.
- `ownerless-receipt-selection-regressions.json`: existing-only current receipts with unchanged students, unique missing-year selection, real delayed optimistic patch settlement, valid cross-tab term drift, and drift after one confirmed chunk. The latter preserves its exact first receipt and original unknown nonce/job; no recollection or selection rewrite.
- `ownerless-transaction-unknown-regressions.json`: in-transaction selection drift, document retirement after the first chunk, saved rows before final receipt failure, failed readback and unique missing-term selection. Unknown remains unknown, local progress is read-only, original batch/nonce is retained, and expired/different-document acknowledgement is rejected.

All runs close their owned server and browser contexts in finally. The isolated synthetic phase requires no shared/live browser reservation. No other processes, locks or queue/status files were changed. App/popup and read-only recovery screenshots come from these real HTTP runtime checks; they are supplementary, not independent save proof. Syntax checks of app/runtime/certifier and `git diff --check` pass. Certification verifies protected extension/ZIP/store/models/shared-library/offline-shell scope is unchanged. Unchanged predecessor evidence for ambiguity/deleted-selection/calendar hold and source/security behavior is reused, not re-certified broadly.

## Preserved unsuccessful observations

`harness-missing-vm-flag.json` retains the initial VM SourceTextModule constructor failure; the existing VM fixture requires Node's process-local experimental-vm-modules flag. No global configuration changed.

`candidate-initial-pending-assertion.json` remains FAIL overall: its three positive scenarios saved 303 rows, but a new assertion incorrectly expected undefined rather than the actual durable null pending field. The corrected expectation is separately proved in candidate-positive.json; the nine unaffected passing negative cases are reused individually without relabelling the failed run.

`baseline-disk-fixture-first.json` was a valid ownerless Start-denial observation but did not isolate disk from memory because the fixture also removed memory owners. It is retained; baseline-persisted-ownerless.json uses the corrected disk-only setup. Product source did not change between the successful candidate runs.

## Delivery boundary

App-only candidate; no extension version/ZIP/download change or publisher action. The independent publisher must verify served app and unchanged extension download/stable parity. The actual PO 0.5.35 receipt remains unresolved: no owner-account readback, real row replay, expired nonce acknowledgement, account/year/term change or Product acceptance is claimed. No push/deploy by this worker.
