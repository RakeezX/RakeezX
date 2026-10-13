# N94 scoped implementation and evidence

Task `continuous-n94-subitem-late-scoring-20261012`; run
`5d423f2e-0d7a-4af4-8f75-7a8bfe3f6edf`. The saved diagnostic candidate
`7503cfcfef06f9bd96ad1bbe14bf96111381085d` remains in history. Work resumed by
merging the then-current controller main `61a6e1498c5ef985cb4e947c72e56eb18581797d`
into that history (original card base `b5e83107222833f5e74530a73355734d8477bd03`).
The Product implementation is `7bb671564c6468a84adc910e250fd6e11030a50c`;
subsequent harness/evidence-only changes do not change its Product bytes.

## Behavior

Ordinary points remain `value`; no competing maximum was introduced. Optional
start/due dates and late points are normalized and validated in the Product
model, editor, configuration command and SQL. Blank start means immediate start;
blank late points follows ordinary points. Existing creation history is retained,
not accepted as an editable configuration field. New definitions have automatic
creation timestamps; canonical decode carries the server timestamp. Legacy
checked completions remain regular; unchecked remain unrecorded, without backfill.

Only deliberate taps choose a state. After the local-calendar due day they cycle
unrecorded → late → regular/accepted excuse → unrecorded; otherwise they toggle
regular/unrecorded. The persisted state, not time of entry, controls points. No
submittedAt or health/excuse detail is fabricated. Rapid taps use monotonic
debounce and pending-action protection. Saved states survive changed dates,
clock changes, reload and canonical refresh. Equal ordinary and late points keep
the same numeric grade but retain distinct teacher-selected labels/symbols.

## Affected checks

- `subitem_dates_and_points`: native model/configuration/date/points cases and
  actual served editor validation, including creation-history preservation.
- `completion_tap_cycle`: actual account-capable local command/outbox → native
  SQL → receipt/reconciliation, three-state and pre-due/no-due cycles, rapid
  events, lost-response retry, reload and clock/due edits. Actual Product DOM
  three-tap handlers and reload are also exercised.
- `scoring_preservation`: native late/regular/equal/manual clamp cases and
  unchanged pre-migration row/grade snapshots; `n94-scoring-preservation` 2/2
  exercises the real N84 Quick Log command, rapid-event idempotency, durability,
  student/owner/parent bounds, manual grades and attendance scoring.
- `owner_sync_backup`: native A/B roles and owner guard, generic-write denial,
  immutable creation guard, legacy receipt replay, definition copy, Product
  Sync encoders/decoders and actual V5 stage/finalize with rollback/retry;
  Product restore planner and initial-restore score invariant retain new state
  and old defaults. Exact deployed component identity is recorded below.
- `product_ui_release_scope`: real HTTPS Product app, editor sheets, Gradebook
  delegates and source CSS at 390/320 RTL in light/dark. Gray/amber/green text
  and symbols, actual points, equal-points labels, touch bounds, >=4.5 state-text
  contrast, persisted reload and N84 control placement all pass. Four editor
  layout screenshots and twelve Gradebook state screenshots are retained in the
  ignored per-run `test-results/n94/` directory. No hand-built page or mock RPC
  success is used as UI evidence. Native component evidence is not a live user
  A/B end-user-session claim.

`node tests/n94/native-check.mjs`: 7/7 PASS on disposable native PostgreSQL 17.6.
`node --test tests/n94-scoring-preservation.test.mjs tests/n94-server-contract-blocker.test.mjs`:
6/6 PASS (three of these intentionally retain the historical immutable-baseline
diagnostic probes; they are not feature acceptance). Scoped syntax/diff checks
pass. No full historical suite or local Vite build was run.

## Service and Preview identity

The Supabase CLI created exactly one file:
`20261012234116_n94_subitem_dates_late_scoring.sql`, SHA-256
`a08ead00360b9cfa4144467751dfa0c4fb620d47e6f303f0b9ca9a1392fdc595`.
It was certified locally, applied once to project `xlrubcwjqktzzunrvuns` through
the authorized `apply_migration` connector (success receipt), and recorded by
the provider as version `20261012235209`, name `n94_subitem_dates_late_scoring`.
The provider assigns its history timestamp independently of the CLI filename;
both identities and the exact source hash are retained in `deployment.json`.
No blind retry, second migration, previous-migration rewrite or live data
backfill/recalculation occurred.

All ten affected deployed function source hashes match native certification.
All old callable signatures and ACLs remain; the one new RPC grants EXECUTE
only to authenticated plus its owner, not PUBLIC/anon. Existing table ACLs,
RLS, trigger bindings, columns and constraints are unchanged except the four
named nullable N94 columns and three constraints. The N58 finalize wrapper
remains source-identical. The N71 map branches and fallback are retained.
`n94SubitemVersion=1` is read back alongside all existing capability keys.
Live metadata only: zero Auth IDs created, zero Product fixtures, no row contents
read. `deployment.json` records read-back/catalog evidence and comparisons.

Rendered UI/source evidence is bound to the successful Cloudflare check at
`7bb671564c6468a84adc910e250fd6e11030a50c`, immutable Preview
`https://d6040109.rakeezx.pages.dev`. The source hashes in
`product-ui-result.json` are exact Git-object hashes (Windows CRLF is not an
implementation difference). Further commits only correct the harness/save its
evidence; reuse rendered evidence while those Product bytes remain identical.
Only the authorized immutable Preview branches were pushed. Main/Production
integration and served Production verification belong to the publisher; this
record does not claim Product CLOSED or Production delivery.

## Harness corrections and owned resources

The native Windows runner was corrected to await pg_ctl exit without inherited
output handles. Fixtures explicitly use the existing N49 synthetic lease helper
and remove their own initialization outbox noise. Timestamp preservation compares
native timestamp text without JS millisecond truncation. Generic-write tests
assert the actual 42501 denial and separately exercise the trigger guard.
No Product safeguards were weakened to fix a test.

The browser harness waits for rendered save completion and selected-tab state,
and reuses the existing application readiness helper. Its Demo preparation
request is made once: the generic context helper intentionally resets Demo on
every load and therefore cannot test persistence. Failures from these harness
issues were corrected, not counted as rendered PASS.

All owned browsers/native PostgreSQL servers are stopped and phase leases are
released. One attempted recursive removal of the owned stopped cluster was
rejected by the command tool with `rejected: blocked by policy`. No alternate
deletion surface, ACL/configuration change or policy bypass was used. Stopped
synthetic clusters/logs remain in the ignored per-run test-results directory;
`native-result.json` records that cleanup limitation. Shared binaries, user work,
controller/maintenance locks, queue/status and unrelated processes were untouched.
