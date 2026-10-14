# N58 reviewed empty-account recovery — bounded blocker

AI-authored evidence for task `continuous-n58-empty-account-reviewed-recovery-20261014`, run `8ce51596-fd43-4453-bab9-fd05e8c13020`.

**BLOCKED: existing ordinary Sync requests cannot enforce the required authoritative empty-account condition at the repair write boundary.** This candidate contains an executable counterexample and evidence only. No recovery UI or Product mutation behavior is enabled. No push, deployment, hosted account access, hosted service operation, migration change, queue edit or N58 closure occurred.

## Source and preserved foundation

Assigned/observed origin base: `2ec81320feb8fa32a7e99714f89d8921c70759b3`. The preceding task's clean, preserved corrected source is `8103557323ae7e342d615c4844268e8d48a71465`; its original foundation is `9603682900001d29ad8ccdb95d7ce26c5357a2f9`. This worktree has not merged or modified that candidate. The test checks the saved source's store, Sync, cloud and runtime bytes against immutable Git blobs before serving its actual application over a task-owned loopback HTTP server.

The saved `tests/n58-fresh-account-baseline.json` records the actual old-source/profile-only/store-entry rejection, before and after first Sync. Its first year request fails HTTP400 / SQLSTATE22023 / `N58_EXISTING_TERMS_REQUIRED`. That unchanged reproduction is reused with its artifact digest and original envelope in this receipt, rather than repeating its broad scenarios. The original fixture's counts are not asserted to describe either private PO account. This test also reproduces the exact selected-year rejection against the current metadata-matched LOCAL services before trying the corrected requests.

## Concrete counterexample

Run `node tests/n58-empty-recovery-race.mjs` with the canonical task's owned shared browser phase lease. The scenario uses the existing official service harness, copied under the allowed task-specific name; the only helper change is its cleanup evidence path. Four digest-pinned disposable LOCAL services run Auth/PostgREST/Postgres/mail. SQL setup is confined to the owned disposable database, with unchanged historical N58 definitions, and gives the scenario no SQL API. The three certified routine body MD5 values match the saved receipt and operator's existing-service binding:

- mutation entry: `a6284ed21c86f1cafcac2d4d84a5fadc`
- N58 guard: `6fc9fcdf35f78d0ae295fe61a833f70d`
- workspace provisioning: `a641c556c736f72b63d1e0cb203e1e1e`

The actual application completes profile-only Initial Restore, resolves/claims its owner workspace, renews the existing lease and enters `store.init()`. Owner, database, workspace and restore receipt are captured in the same live document. No mock transport or ownership bypass is installed.

1. A selected year CREATE reproduces `N58_EXISTING_TERMS_REQUIRED`.
2. Fresh mutation IDs submit the known corrected unselected year CREATE and both known ordinary term CREATEs through actual `cloud.applySyncV2Mutation`. All receive `applied`.
3. The actual `cloud.fetchRecords` owner-filtered, complete reads find zero rows (including tombstones) in the school-content tables read by the scenario. The corresponding local stores are empty. The saved raw Outbox is retained.
4. After that last emptiness read, an independent second Auth session for the same synthetic owner commits a valid section CREATE through the ordinary Sync RPC, using a distinct device/mutation ID. It receives HTTP200 / `applied`.
5. The first device submits its planned year-selection PATCH, with the known unchanged year base revision. The server accepts it as `applied`, despite the newly populated account.
6. Canonical readback contains both the selected year and that section. Raw local Outbox before/after is byte-equivalent. The shipped hold remains true.

Exact requests, acknowledgements, source/service identities, local and authoritative checkpoints are in `tests/n58-empty-recovery-race.json`. This is a deterministic interleaving, not a probabilistic timing test or an assertion from visible emptiness. The failure is the required **remote populated-account race must block the plan** gate. It is not an owner-isolation failure: both sessions intentionally belong to the same disposable owner.

The service serializes individual mutations with owner locks, but the fetch and later mutation are separate HTTP transactions. The row revision of the year does not change when another device creates a section. An extra client read merely moves the interleaving window to after that read; a local transaction or browser lock cannot constrain the other device. Reading back afterward can detect the population, but cannot prevent the already committed repair selection. Relabeling the repair successful, automatically deleting the other device's work or undoing academic state would violate this card.

## Actual check disposition

| Check | Result |
| --- | --- |
| native metadata-matched empty-account race counterexample | PASS: the counterexample above was observed with actual application cloud/store and official LOCAL services. This is proof of a blocker, not Product acceptance. |
| `n58_existing_empty_rejected_account_review` | NOT_RUN: no safe reviewed repair UI is implemented. Original actual rejection proof is retained/reused. |
| `n58_reviewed_academic_repair_actual_protocol` | NOT_RUN: ordinary request acceptance above is not an audit-bound confirmed repair/convergence proof. |
| `n58_repair_idempotent_lost_ack_and_owner` | NOT_RUN: no repair protocol is enabled; existing foundation evidence remains unchanged. |
| `n58_no_school_data_or_custom_history_repair` | FAIL: the required other-device population guard is not enforceable at the ordinary request boundary, as observed above. Custom-history repair remains unrun. |
| `n58_calendar_hold_and_old_failures_retained` | PASS for preservation only: hold=true, raw Outbox unchanged, all Product sources unchanged; original rejection artifact retained at immutable source. No resolved group is claimed. |
| syntax/resource cleanup | PASS: both new modules pass `node --check`; task-owned context/browser/server closed in finally. Four containers/network/volume closed with ownership checks, cleanup receipt records all six closed. Shared browser lease released. |

The 390/1280 recovery DOM, cancel/confirm/support, lost repair acknowledgements, restart, altered plan and custom-history cases are **NOT_RUN**. There is no handwritten UI or source-only rendered PASS. No repeated Preview, broad suite, private query, hosted pair or paid review worker was used.

## Exact retry condition

Preserve this evidence candidate and the preceding corrected source/session. A later scoped decision must provide a verified existing ordinary API capability that atomically checks owner-wide school-content/tombstone absence with each affected repair write (and preserves retry receipts), or explicitly authorize and certify that narrow server capability. No such capability may be invented by this worker, and this card authorizes no service change. Resume the repair implementation only after a material correction to this boundary; changing runId or adding another client preflight does not resolve it. Keep calendar switching HOLD=true, full N58 hosted gates and umbrella closure outstanding. The independent controller owns further dispatch and delivery.
