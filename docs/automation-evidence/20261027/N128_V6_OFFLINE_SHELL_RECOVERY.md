# N128 V6 offline shell recovery (AI)

Date: 2026-10-27 Asia/Riyadh. Local candidate ready; no push, deployment, service operation or Product acceptance claimed.

- Task: `continuous-n128-v6-offline-cache-completion-20261027`
- Run: `bbd9f56f-a332-45ee-a9f1-e9f7c51428b4`
- Base: `bcf7353cc3b55b5030174a4139cfbebd6a9cd225`
- Candidate: the AI commit containing this report; full SHA is returned in the worker result.
- Original candidate: `4db42308ddd42f3cde6b88436c0cfaae24f1105c`; original session: `01a17a50-d144-70f1-99db-78a91625c23c`.

## Exact reuse and preserved history

Seven executable/test files were extracted with `git show 4db42308:path`, with byte-for-byte buffer equality and Git blob checks. The eighth original file is historical evidence, not executable source: `4db42308:docs/automation-evidence/20261027/N128_V6_SUBJECT_CATALOG_REFERENCE_DELIVERY.md`. It remains intact in that immutable commit rather than being copied over this card's differently named report.

| File | Reused Git blob |
| --- | --- |
| src/views/teachings.js | 72ea6541cf211dfc56ca0d001e84884d2e8d44c3 |
| src/lib/subject-catalog.js | e4cdc954566858644b3c8fb057e2ce3b4c0ffa97 |
| src/lib/official-v6-subject-data.js | 7974564e6a7b1b782c9c4d01d87bc1098fde3e87 |
| src/lib/stage-subject-options.js | a53f0153c8096eca12ce6bcdd4782a499ffc258c |
| tests/stage-subject-options-v6.test.mjs | 84363f76687e591831ec179af53edc2a833e72d3 |
| tests/stage-subject-chooser-v6.e2e.mjs | e484ee58fdbaa401230cfe49d922bc3ea2aabc53 |
| tests/stage-subject-v6-persistence.e2e.mjs | 9efc813177aa6fbbc3f8d2d8064d595797d94db9 |

The canonical parent result `artifacts/ops-supervisor-v4/attempts/continuous-n128-v6-subject-picker-reference-20261027/a6c6e450-5c9d-41c0-a800-2c0f0eacac7d/result.json` remains BLOCKED, with its actual-app offline FAIL (v87 missing both modules, teachings import 504). Its original report also retains the failed route-graph result and historical subject-flexibility 4 PASS / 2 OFFLINE_LEASE_LIMITED failures. None were rewritten or labeled green.

Reused unchanged evidence: **22/22 V6 unit tests**, **5/5 chooser plus 2/2 strengthened selection-clearing browser cases**, **3/3 persistence cases**, including actual class-settings add-another-subject entry, stable section/subject IDs, nonempty shared rosters, unchanged student count and distinct default-item IDs after reload. No duplicate run of these unchanged suites was made. The base's teachings/catalog and owner/persistence dependencies match the original candidate's base. Fresh assertions confirmed unchanged code from `let demoBusy = false` onward, including submit/create validation, and unchanged store, DB, models, offline-lease, sync and remote-sync dependencies.

Fresh data assertion: **1,211 rows**, JSON SHA256 `99408a3e2ea0345d103c6f2421a50d4eefacfc87f40e04625cd7d972b9f24aac`. Guide edition SIX remains optional reference names, not universal year-1448 certification. No curriculum V2 context, historical subject renaming or grade/attendance rewrite is introduced.

## Bounded new change and checks

At the pre-edit canonical queue snapshot this was the only running/delivery card; no concurrent N44 SW owner was observed. The full normalized SW source was asserted equal to base plus exactly these substitutions:

1. `rakeezx-v89` → `rakeezx-v90`, once.
2. Add `./src/lib/stage-subject-options.js` and `./src/lib/official-v6-subject-data.js` immediately after subject-catalog in SHELL.

All N44 push/click code, event hooks, activate/fetch logic, private-route exclusions and cache-generation cleanup remain byte-equivalent to base. No Auth, schema, SQL, migration, Sync, Restore, storage-engine or notification implementation file changed.

| Fresh check | Actual result |
| --- | --- |
| Exact saved-file buffers / blobs and 1,211 rows digest | PASS |
| Full SW equality to the three authorized substitutions; unchanged submit/create and owner dependencies | PASS |
| `node --test tests/offline-route-graph.test.mjs tests/sync-outbox-owner-guard.test.mjs` | 8/8 PASS: complete route graph and seven owner/dispatch/Demo isolation checks |
| `node --check` for SW plus seven copied JS/MJS files | 8/8 PASS |
| `git diff --check` | PASS |
| Actual app fresh SW install → offline reload → reference picker | PASS, details below |

## Actual offline app proof

Used the shared browser phase lease with this run's owner token, a fresh disposable Chromium context, and a task-owned static HTTP server at `http://127.0.0.1:5208`. Files were served unmodified from this worktree with correct JSON/module/CSS MIME types and no-store headers. The existing `openReadyServedDemo` helper booted synthetic Demo. Service Workers were allowed; the non-shared isolated helper was deliberately not used because it blocks them. No credentials, personal browser profile, real owner or cloud operation was used; browser-page requests outside the loopback origin were aborted.

After SW control and installation, Cache Storage contained only `rakeezx-v90`, **202 entries**, including both new modules. The context was switched offline and the actual server was closed before reloading `/#/classes`. A bounded Node polling loop awaited each async page evaluation and read readiness, database, workspace and relevant counts together in the same current-document checkpoint:

```json
{"workspace":"demo","database":"rakeezx-demo","ready":true,"teachings":8,"students":184,"controller":true,"rows":1211,"demoSession":"active","classCards":8}
```

Actual DOM/handlers then opened Add Class, selected grade 5 and Tahfiz, searched and selected `التجويد`, and verified the existing custom token/name fields. Eight actual application stylesheets were present and the dialog was visible. **Zero server requests after closure, zero page errors, zero console errors.** This checks an offline fresh document after first installation, not a warm module-only navigation. Existing two-subject persistence evidence is reused separately; this run did not submit a new class or mutate any real data.

Harness corrections retained as limitations of earlier attempts, not Product PASS: the first attempt failed before browser launch because a Windows Node import needed `pathToFileURL`; early async `waitForFunction` predicates returned before complete readiness and were replaced with awaited `page.evaluate` polling; an in-flight initial server request invalidated a zero-request assertion, so the final proof closes the server before measuring/reloading. The final complete corrected scenario passed; no Product guard or acceptance assertion was weakened.

Context, browser and server closed in finally. Canonical lease release returned `RELEASED browser`; no listener remained on port 5208. No build was repeated, as source copy/syntax checks suffice here; deterministic build and immutable served Production verification remain with the independent publisher.
