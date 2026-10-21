# N36 — 0.5.35 persisted-selection / receipt uncertainty

Task: `continuous-n36-1109-persisted-term-receipt-recovery-20261021`
Run: `5e50775e-0e75-4434-b2dc-900ff34a6e99`
Base: `f3f4fe4c074881e5eac9a4a767cb1140d023be32`

Local candidate only. No push, deployment, queue/status change, live account/source browser, real school read, real mutation, SQL/Auth/schema operation, or PO batch inspection occurred. The current canonical N36 note and activated card remain authoritative. Product is open; actual PO save and its receipt boundary remain unresolved.

## Immutable original reproduction

The public 0.5.35 ZIP was fetched and matched the existing immutable archive: SHA256 `025fb2a896fb6027789575c0cd35ff4cfd9e3740b55137b81e7880a79ea71aef`, 146711 bytes, 29 files. The baseline serves the receiver/handoff modules from the explicit base Git blobs. Existing native-like storage/worker, source, account-provisioning, actual store/ownership and served-app helpers were reused. Chrome transport is synthetic; popup DOM, handlers/CSS, serialized source readers, complete ESM background/collector/worker, real receiver/store and native IndexedDB run over owned HTTP. Only the exact protocol app-origin constants are substituted with the isolated loopback origin. This is not an installed extension or live-service certification.

`tests/n36-1109-persisted-term-receipt-recovery-20261021/baseline-certified.json` records six independent PASS reproductions. Each stages 303 rows, binds teacher/school, refuses the optional timetable GET as `live-link-unsafe`, and remains in receipt with an unknown result:

| Synthetic boundary | Durable source rows at observation | Receipt result |
| --- | ---: | --- |
| Missing raw year; effective live fallback | 0 | persisted-term denial, no first checkpoint |
| Missing raw term; effective live fallback | 0 | persisted-term denial, no first checkpoint |
| Real `patchDevice` optimistic update with delayed IndexedDB write | 0 | persisted-term denial before delayed selection settles |
| Different valid durable term in a separate writer | 0 | persisted-term denial |
| Drift after a confirmed class chunk | 300 | first receipt retained; next chunk unknown |
| Rows committed, final receipt put fails | 300 | unknown; no invented receipt |

The final-put fault is an independent boundary control, with `WRITE_FAILED`; it does not assert that this was the PO failure. The other five reproduce `BATCH_PERSISTED_TERM_CHANGED`. The actual PO report supplies neither a saved count nor a confirmed receipt count. None of these timings determines which actual transaction committed. Actual student-page coverage was reported partial; synthetic explicit-page coverage is separate and does not upgrade it.

## Receiver change

Explicit Start qualifies one durable selection before source collection. A maximum five-second wait accepts a previously optimistic selection only when the exact original memory selection and its write stamp settle durably. Ownership/workspace/database/lease, Auth session, unchanged academic records and this application document are rechecked. No selection or calendar-region hold is patched.

Missing/deleted raw IDs are read through only when the transaction's nondeleted records provide a unique, coherent, active, exactly owned year/term matching the batch. A valid different ID is never classified stale. Ambiguous fallback, foreign/conflicting context and persistent/new valid selection fail closed. The popup asks the teacher to choose the year/term explicitly in Rakeez before any source GET.

Before/inside transactions the exact persisted context remains guarded. Teaching-backed and subjectless names now share that guard, including actual roster identities. Receipts require same-checkpoint durable roster and receipt readback; a failed readback stays unknown. Confirmed chunks survive later denials.

The old automatic and explicit pending-record writer paths no longer manufacture a fresh envelope/lifetime without an original extension nonce. The app's follow-up action is read-only count inspection. It checks the original stored batch/digest, current section/roster and owner-bound creation provenance for unsynced local rows. It returns only bounded confirmed-receipt/row and currently present pending-row counts with fixed checkpoint/relation enums. Original-term guidance never changes the selection. Missing/unverifiable traces are explicitly unresolved.

A future qualified job completes its original batch and original worker envelopes/actions/nonces; repeated delivery of the same nonce does not write again. An unknown job retains its nonce and pending state during readback, without recollection or missing writes. Expired/different-document acknowledgements are rejected. No current 0.5.35 nonce is extended, revived or retroactively acknowledged. The PO need not reload an unresolved extension job for this package.

One targeted diagnostic defect was found during verification: after receiver ownership denial, the worker stopped before reading an already stored unknown receipt. It now reads only its own nonce's bounded unknown diagnosis while retaining the denied guard. A synthetic saved-receipt trap proves that this branch does not consume a success, move the cursor or add the last three rows.

## Verification and preserved failures

Final frozen runtime: 30 PASS cases across `certified-prospective-and-start.json`, `certified-receiver-and-isolation.json`, and `denied-saved-receipt-control.json` in the task test directory. `package.json` records exact inputs, hashes and checks. These include missing/deleted year and term, real delayed patch settlement, exact 303 saved/current rows, existing-only receipts with unchanged student records, four-class ordering, memory/disk ambiguity, foreign/conflicting contexts, persistent/new valid selections, second-writer drift before and inside the student transaction, owner/session/lease/document denials before and after a confirmed chunk, final-put/readback uncertainty, unchanged original batch/nonce, duplicate-nonce suppression, expiry/document denials, rejected diagnostic payloads, and the denied-success trap. Actual app/popup screenshots accompany the results.

Original unsuccessful observations remain in their original JSON files. They are not acceptance PASS:

- `baseline.json`: the original 1200ms timing settled during collection; it completed, so that timing did not reproduce uncertainty. The corrected baseline delays the real patch's `openDB` await for 3500ms, retaining its optimistic memory and actual native eventual transaction. `baseline-optimistic-corrected.json` also preserves the original premature raw-selection assertion before waiting for this fixture's own delayed write.
- `candidate-first.json` / `candidate-negative-first.json`: preserve the lost Start reason and the ineffective frozen-workspace lease test. The Start reason was fixed in Product; lease denial uses the actual runtime lease invalidator.
- `candidate-negatives-certified.json`: preserves the timeout from an open popup whose synthetic storage listener was a no-op. Corrected checks close/reopen only the synthetic popup, retaining the same source and receiver documents, worker, job and nonce, and inspect its actual initial status render.
- The browser reported exactly `SecurityError: Failed to read the 'sessionStorage' property from 'Window': Access is denied for this document.` for the old fixture initializer in an opaque empty document. The corrected initializer accesses storage only after checking the explicit permitted loopback HTTP origin; it never repeats the denied opaque-document operation. No file navigation, policy/ACL change or denied-operation alternate surface was used. The helper's intentional Service Worker block remains in force; no offline/Service Worker certification is claimed.
- `final-start-denials.json`: preserves an accidental broad scenario-list replacement that injected a term change into two unrelated fixtures. Corrected fixtures isolate these cases.
- `final-receiver-negatives.json` / `final-student-transaction-controls.json`: preserve faults aimed at a broader store transaction rather than the student write. Corrected faults target the native students-first transaction and preserve pending data through a read/merge in the independent device writer.
- `final-exact-student-transaction-controls.json`: preserves the real missing receiver diagnosis after owner/session/lease/document denial. The targeted worker correction and final controls above retain the rejection and prior confirmed receipt, with safe diagnosis. No failure file was relabelled PASS.

Tests compare protected scores, years, foreign-owned rows, nonselection device fields and the user's selection. Source readers/collector, 90-second pre-row and 8-second GET limits, transport protocol/300-row cap, per-class ordering, store/Sync/ownership/lease implementation, old packages and offline shell remain byte/content unchanged where protected by `package.mjs`. No new startup dependency was introduced.

## Package and delivery boundary

0.5.36 ZIP: SHA256 `1a2a4d1f70e27a30f262b176c65c22e8d412e5ff8d6cede1ee7d073ced21b46f`, 147844 bytes. All 29 files match the source and manifest hashes. Manifest permissions/CSP are unchanged apart from the version. The actual application download link renders 0.5.36, produces the exact archive hash through the native download event, and leaves the route unchanged (`download.json`). Metadata-only changes follow the frozen functional proof and are checked against `certified-runtime.json`.

Owned loopback ports 49929/49931 and fresh disposable browser contexts close in finally. The canonical isolated-local helper is authorized for this active synthetic card; no shared/live browser lease was acquired. No personal profile, credentials, Service Worker, public collector, or other owner's process/resource was used. Production/frontend served assets, the actual stable installed 29-file runtime and actual PO acceptance remain NOT RUN/PENDING with the sole controller/publisher and PO. The worker does not claim deployment or actual batch success.
