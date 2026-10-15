# N58 calendar-switch prevention — bounded release candidate

Task `continuous-n58-calendar-switch-prevention-finish-20261014`; run `fa5e0b7c-2b36-49be-8c28-ba15cf905f1f`.
Base/observed origin/main: `a31778a81cc257aa6ca4bb76d5a28ff7fec5b40e`.

The existing preset-selection UI/store path is enabled in this candidate after its actual LOCAL application/protocol checks passed. The only Product delta is `CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD=false` and its explanatory comment. First-use queuing, stable academic identities, detached official date projection, selection serialization, owner guard and immutable recorded context are unchanged. No recovery feature, migration, Auth/RLS/schema operation, new dependency or date-input policy was introduced.

The latest PO instruction abandons both damaged dummy accounts. Neither account was opened, repaired, replayed, cleared or deleted. Their data and historical failed evidence remain untouched. This candidate prepares the specifically authorized prevention release; it does not close N58 or assert that those accounts recovered.

## Actual affected evidence

`tests/n58-switch-prevention-ui.json` records the current app served by Vite over task-owned loopback HTTP. Only the cloud endpoint/key are redirected to the official disposable LOCAL GoTrue/PostgREST/PostgreSQL harness. Product store, views, handlers, source CSS and protocol are used directly, with no test transform of the switch or substitute acceptance transport. The browser phase used the canonical shared lease, fresh contexts, blocked Service Workers/external requests and no personal profile. Passwords and tokens are not recorded.

| Required check | Result |
| --- | --- |
| `n58_current_ui_empty_account_switch_roundtrip` | PASS: two real LOCAL profile-only accounts, actual Initial Restore/ownership/store initialization; Calendar → إعدادات التقويم والمنطقة → التقويم المعتمد pointer double-clicks Western → General → Western before first protocol acknowledgement and after initial Sync. Actual enabled region cards and source CSS exercised. |
| `n58_switch_no_legacy_materialized_mutations` | PASS: each case settles with the original single year and two term IDs; one immutable year CREATE command without selection, exactly two immutable term CREATE commands, dependent selection PATCH. Concurrent/retried requests retain identical mutation IDs, envelopes and native receipts. Zero official calendar/day mutations, zero deletes, zero final Outbox entries and no rejected chain. |
| `n58_switch_ack_reload_owner_and_history` | PASS: each lost selection response replays the identical immutable mutation and native receipt. After initial Sync, a General acknowledgement is held pending while the user selects Western; pending work remains non-rejected and the final local/remote selection is Western. Double-clicks create no duplicate academic identities. Wrong-owner dispatch with pending work attempts zero requests and is blocked. Recorded acknowledged session context/rows remain unchanged through switching/reload; independent fresh-context sign-in/restore preserves context and academic IDs. Reload/second-context checkpoints read owner, active database, Initial Restore receipt and relevant rows together in the current document. |
| `n58_switch_existing_service_and_release_binding` | PASS: fresh LOCAL protocol routine bodies match all three existing operator metadata digests; exact source hashes and the dependency's verified source receipt are bound in `tests/n58-switch-prevention-binding.json`. No hosted service call or change. |

Commands: `node tests/n58-switch-prevention-ui.mjs`; `node tests/n58-switch-prevention-binding.mjs`; `node --test tests/n58-fresh-account-read-guards.test.mjs` (3/3); syntax checks for store/test modules; `git diff --check`.

The three affected native read guards also confirm incomplete calendar reads remain inspectable with an honest detached warning while date edits/session creation stay strict, and recorded/unrecorded provenance is not rewritten. The unchanged actual malformed-account DOM, retained 65-envelope history, first-use/native owner/grade/import/restore and offline/update evidence is reused from the foundation/first-use release receipts. Binding proves the Product code differs from current base only in the hold flag/comment. No old nine-protocol/60-contract suite, repeated Preview or broad audit was run.

Original harness failures remain separate JSON artifacts: initial fixture sign-in did not boot the app router until a normal document reload; a wrong-owner probe initially ran after Outbox drained, yielding no pending blocked operation; the second fresh context likewise needed its own authenticated document boot. These are preserved as original failures, not relabeled PASS. Corrected fixtures reload normally, checkpoint the new document and probe actual pending owned commands. No Product guard was weakened.

An added receipt-only assertion initially counted HTTP requests as commands (`2 !== 1` for year CREATE). The recorded requests are identical replays of the same mutation, including the native receipt. The corrected binding counts distinct mutation IDs and verifies every repeated envelope/receipt is identical; it does not suppress duplicate identities or rerun the unchanged browser proof.

## Existing service and release boundary

The canonical read-only operator record is `C:/Users/Abody/Projects/RakeezX/docs/automation-evidence/20261014/N58_CURRENT_SERVICE_AND_RELEASE_SCOPE_1925.md`. Its CRLF→LF routine body identities match the fresh local definitions:

- `apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)`: `a6284ed21c86f1cafcac2d4d84a5fadc`.
- `n58_guard_calendar_contract()`: `6fc9fcdf35f78d0ae295fe61a833f70d`.
- `provision_account_workspace(jsonb)`: `a641c556c736f72b63d1e0cb203e1e1e`.

Equality establishes existing capability identity, not hosted account testing. The read-only dependency receipt reports first-use candidate `29b812c00f8d417ddc31e432229cdf40b3e03d9d` contained at published source `a31778a81cc257aa6ca4bb76d5a28ff7fec5b40e`, Production source evidence passed at `2026-10-15T03:24:34.603Z`, provider deployment `6e51654f-a337-4d05-a93c-3005175756a0`. This is reused controller evidence for the prerequisite; this worker did not execute that publication or a new publication.

The independent publisher owns this candidate's integration, provider checks and served-source verification. The PO's promised fresh-account Production trial remains pending, as does full N58 acceptance. Historical hosted A-session/A2-restore **FAIL**, hosted context rejection **NOT_RUN**, B owner isolation **NOT_RUN**, and hosted preset-context preservation **NOT_RUN** remain unchanged. The retired pair is not reactivated. Latest card authority permits this bounded existing-behavior correction independently of whole-ticket acceptance; no new live proof pair or recovery authority is inferred.

All four owned containers, owned network and volume were removed with label ownership verification (`tests/n58-switch-prevention-cleanup-fa5e0b7c.json`). Browser contexts/browser and unique local server closed in finally; the owned browser lease was released. No push, deploy, queue/status mutation or real data operation occurred.
