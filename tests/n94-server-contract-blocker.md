# N94 bounded dependency evidence

Historical diagnostic result from run 47c4d463-384f-4785-b8b4-93c8b627959d.
Superseded by the explicitly expanded server authority in run
5d423f2e-0d7a-4af4-8f75-7a8bfe3f6edf. The candidate history remains preserved;
current component/deployment evidence is in `tests/n94/`. The first diagnostic
test now verifies that the current Product normalizers resolve the original
loss; its remaining SQL tests intentionally exercise the old immutable baseline.

Task: continuous-n94-subitem-late-scoring-20261012

Run: 47c4d463-384f-4785-b8b4-93c8b627959d

Base: b5e83107222833f5e74530a73355734d8477bd03

Result: **BLOCKED — SUPABASE_SCHEMA_AND_DEPLOY_SCOPE**. This candidate contains
diagnostic evidence only. It does not implement N94, enable local-only scoring,
claim rendered UI validation, or authorize deployment. No Product source,
schema, RLS, Auth, queue, real records or global configuration was changed.

## Concrete dependency

The existing immutable `0033_score_subitem_foundation.sql` contract has
`score_subitems.value` and automatic `created_at`, but no `start_date`,
`due_date` or `late_points`. `score_subitem_completions` stores only boolean
`checked`, with no persisted teacher-selected late/regular distinction.
`apply_score_configuration_command` reads/inserts only identity, name, value,
order and distribution version; extra N94 properties are silently omitted from
the stored row and canonical receipt. `apply_score_subitem_command` accepts
`p_checked boolean`, not a selected completion state. `recompute_subitem_score`
sums ordinary definition values for checked completions. Equal ordinary/late
points would still lose the required distinct teacher label.

The client cannot safely solve these server operations within this card.
Its `preparationAuthority` and `liveAuthorizationRef` are null; new server
schema/RPC/scoring/restore work is explicitly excluded. The diagnostic executes
the immutable SQL in isolated in-memory PGlite, following the existing
`score-foundation-server.test.mjs` bootstrap through 0034. It establishes the
checked-in contract limitation, not the deployed service state. Targeted search
of subsequent checked-in migrations found no replacement N94 columns or score
command signatures. No service probing or server mutation was performed.

## Actual Product-path trace

- `src/models.js`: subitem/completion constructors preserve supplied object
  properties locally, but supply no N94 validation or state semantics.
- `src/lib/db.js`: existing IndexedDB stores accept records; local storage alone
  is insufficient evidence of cloud persistence.
- `src/store.js`: `commitScoreFoundation` requires a claimed account and existing
  version-1 capability; `setScoreSubitemCompletion` accepts a boolean and queues
  `score:set_completion` with only `checked`. Configuration builds definitions
  and outbox payloads without N94 fields. Copy constructs the ordinary definition.
- `src/lib/cloud.js`: real completion RPC serializes `p_checked` and manual value,
  with no late-state argument.
- `src/lib/sync-v2.js`: schemas omit all N94 fields; `encodeSyncV2Patch` and
  `decodeSyncV2Canonical` omit them, including subitem `createdAt`. Command receipt
  adoption uses that decoder; full score-domain reconciliation and score refresh
  use the ordinary-only shared projection.
- `src/lib/sync.js`: scoring provenance stores stay on the protected score-domain
  path; generic writes are not an authorized escape route.
- `src/lib/backup-v2.js`: V5 owner-bound restore planning uses the actual Sync
  encoder, dropping dates, late points and teacher state even from a locally
  richer backup. Existing subitem modifications still require explicit review.
- `src/lib/export.js`: V5 validation delegates score consistency to
  `assertScoreSnapshotInvariant` in `src/lib/initial-restore.js`; its current
  ordinary-only projection rejects a materialized lower late score. Initial
  canonical restore uses the same Sync decoder.
- `src/lib/demo-workspace.js`: synthetic definitions/completions use the same
  constructors and ordinary projection. A Demo-only feature cannot satisfy N94.
- `src/views/items.js` / `src/views/grades.js`: existing editor collects ordinary
  name/value; Gradebook sends boolean checkbox selection. No N94 rendered UI
  acceptance was attempted because the persisted Product behavior is blocked.

## Executed check

`node --test tests/n94-server-contract-blocker.test.mjs`: **4/4 diagnostic PASS**.
This is evidence of failure to meet `owner_sync_backup`, not an N94 acceptance
PASS. It exercises actual Product Sync encoders/decoders, V5 restore planner,
initial-restore invariant, SQL configuration and completion commands, replay
receipt and synthetic A/B server owner boundary. No success mock is used.

The first run had 3 PASS / 1 diagnostic assertion failure because PGlite's
parameter serializer rejected a string before SQL execution. The final test
uses an SQL literal so PostgreSQL itself rejects the late value as non-boolean;
the rerun passes all four diagnostics. No acceptance criterion was weakened.

The five required N94 acceptance checks remain unestablished; UI/browser checks
were not run, and no browser/server process or phase lease was acquired.

Retry only after a separately authorized, implemented and verified immutable
server contract supports N94 dates, bounded late points, persisted teacher
state, owner-bound atomic scoring/replay, copy, canonical Sync and Backup/Restore,
and its deployed availability can be established. Then resume Product
implementation from this exact candidate on the controller-selected current base.
