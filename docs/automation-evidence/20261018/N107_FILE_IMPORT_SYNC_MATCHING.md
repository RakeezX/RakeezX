# N107 — local file import Sync and item matching (AI-authored)

Task: `continuous-n107-file-import-sync-item-matching-20261018`  
Run: `306e6dd3-905a-49ed-9396-aaaf676e1344`  
Base: `522bc6d991aceb90cb2ff83982f6a26d0e75a002`

This continues only the new PO18October file defect. Previously accepted N107 presentation/export and N36 extension proofs are retained; no new claim of their acceptance or Production verification is made.

## Reproduction and correction

The private diagnostic CSV was read locally and its SHA256, 1823 bytes, 28 data rows and six columns verified. No original names, grades, identifiers or original attachment were copied to this repository. `tests/fixtures/n107-file-sync/roster.csv` contains fabricated names and values with the approved header/blank/type pattern, including a synthetic zero.

The baseline actual application over loopback HTTP reproduced the failure with real owned creation outbox commands and ordinary canonical receipts: creation reached an empty outbox, but canonicalId/serverCanonical metadata changed the academic review fingerprint. The foreground continuation reported «تغيّر أثر الاستيراد أو سياقه؛ يلزم مراجعة جديدة قبل حفظ درجات إضافية.» and saved no grades. The previous N107 browser harness had installed revisions directly and removed creation commands; that evidence did not cover this integration defect. This task uses neither technique.

Changes:

- Compare class-import business facts independently of ordinary Sync metadata. Retain explicit foreign-parent rejection, including persisted transaction snapshots, owner/session/lease and academic context guards.
- Refresh durable creation ACKs into the store before an unrelated trailing dispatch/post-pull failure. Preserve Sync failure status and unacknowledged/rejected commands; a partial ACK is never presented as whole-run success.
- Preview defaults from `defaultItemsFor`, the same resolver used by actual teaching creation. Rebind reviewed direct destinations to unique actual receipt items by name, maximum and direct/manual semantics before grading. Keep automatic, ambiguous, duplicate-column and maximum-mismatch protection.
- Current canonical defaults have activities/projects20 and homework10. The private file requests homework20. Activities reuse their existing destination automatically; homework requires an explicit reviewed destination choice. Tests choose the existing homework10 destination and preserve the current scoring contract. Nothing changes its maximum to20 or guesses by name alone. A separate existing-owned homework20 fixture verifies exact matching when maxima really agree.
- Retain the reviewed, owner/database-bound post-roster continuation in local device state, outside Sync and backup. An atomic compare prevents another tab's teaching draft from being replaced/cleared. Reload requires an explicit resume; expired/changed context requires a fresh review or cancellation. Existing same-request grade receipt recovery and rejected-request disposition remain intact. Completion is shown only after durable grade receipt reconciliation.

## Affected evidence

`tests/n107-file-sync-browser.json` records current actual-app checks and exact SHA256 values for Product sources, source CSS and the fabricated fixture. It retains original failed harness observations separately from the corrected check results. The app DOM, event handlers, account store, ownership guard, normal creation commands/ACK integration and grade receipt persistence run in fresh canonical isolated browser contexts at `http://127.0.0.1:49718`. External requests and Service Workers are blocked. This is synthetic evidence, not live-account, offline-shell or Production certification.

Required check groups:

| Required check | Evidence |
| --- | --- |
| `n107_new_class_file_normal_sync_ack_and_existing_default_item_mapping` | Actual grade11/section2/PE, 28 fabricated rows; immediate/delayed normal owned creation ACKs; existing default mapping, explicit homework maximum review; 31 durable changed scores including zero; blank/equal values preserve grades; one class,28 students,five unique items. |
| `n107_partial_delayed_rejected_ack_retry_reload_idempotence_and_grade_preservation` | Partial enrollment ACK with committed parent/default revisions visible despite trailing503; retry/reload resumes without creation duplication. Expired reload requires a new review. Lost receipt retries the identical mutation and reconciles one server commit. Parent409 prevents grades; grade409 remains rejected across reload with no automatic retry/new batch. |
| `n107_file_import_owner_term_session_and_mapping_safety` | Actual UI held-capability owner/term/session/expiry/item-change/cancel cases refuse grade dispatch. Mapping tests preserve automatic/ambiguous/max-mismatch/duplicate-column/foreign-owner safeguards. Durable continuation tests cover owner/database mismatch, cross-tab compare, session callback drift, canonical metadata tolerance and persisted foreign-parent refusal. |

Commands:

- `node tests/n107-file-sync-browser.mjs` — scoped actual-app synthetic journeys; no source/fixture mutation permitted during the verification run.
- `node --test tests/n107-file-sync-mapping.test.mjs tests/n107-classes-import-mutation.test.mjs` —9/9 passed, including existing partial creation/session/cross-tab safeguards.
- `node --test tests/n107-file-sync-state.test.mjs` —3/3 passed.
- Node syntax checks on changed Product JavaScript and scoped harness; `git diff --check`.

No full Vite build, unrelated suite, hosted service, SQL/Auth/RLS/schema operation, real account/data mutation, push or deploy was performed. The unique owned server and fresh browser contexts are closed in finally; no shared live-browser resource is used. The controller/publisher retains integration, deterministic build and actual served Production verification.
