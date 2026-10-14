# N100 invalid distribution mode — bounded recovery

Task `continuous-n100-invalid-mode-recovery-20261014`, run `f3be1729-da20-46d5-8373-a4c5d1c8a412`.
Base `4bca911dd3c9ebdb53cdd5524854659f7552108e`. Candidate is identified by the runner result.
Worktree `C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n100-invalid-mode-recovery-20261014`.

## Diagnosis and limits

The exact reported text is reproduced with the actual application UI, CSS, store and prior Service Worker, rather than a replacement UI. The fixture installs the actual `cd8a5e0` v56 release shell and its two-mode copy engine, boots that release, then serves the current UI/store with a selective transport failure for the unqualified engine URL. The old worker's genuine network-first fallback supplies the byte-identical prior cached engine. The actual copy handler passes `automatic-safe`; `reviewScoreDistributionCopy` rejects it at `DISTRIBUTION_MODES.includes(mode)` before capability lookup, plan RPC or Sync dispatch. The synthetic owner database remains unchanged. This identifies a reproducible failing layer/input; it does not claim access to the PO's browser cache or prove its precise outage history.

Other boundaries were inspected: current store accepts the automatic mode; cloud serialization sends `p_mode: automatic-safe`; durable `score:distribution_apply` sends the reviewed plan/token rather than an independent mode; SQL planner/builder accept the three modes and apply rebuilds from the saved request. Legacy definitions still omit `p_mode`; preservation still sends it. Unknown and explicit null modes reject before transport, without falling back to definitions.

Fresh public GETs from `https://rakeezx.com` returned HTTP 200 and exact local SHA256 matches for the affected graph at diagnosis:

| Module | Observed SHA256 |
| --- | --- |
| src/store.js | 1da3bc9378c036fe6e5e252859428fbab05607f2bb00a27b7a501eba1b4469f4 |
| src/views/items.js | 0c5bce4646a47d48f5150faf4f23efdc90fc7acbb4fe231d14fcc741a47d078e |
| src/lib/cloud.js | 6c1c561c8fba45cefc9168b5bde0d07e86ee113a47e424506d8cf04042e31111 |
| src/lib/score-distribution-copy.js | db4848eb9d021c541188b29d9ac269e187e657bbd90df1eb5c78f14c1a3b865b |
| sw.js (v59) | 95a11bd837ab327d359ebdeacdba1f3431ca06d4e3f0f2fbcd15b87ca9a93a4c |

No current served-source mismatch was observed. These reads diagnose the prior release and are not candidate deployment evidence.

## Correction

The store now binds its copy engine import to `?n100=automatic-safe-v1`, preventing the old unqualified HTTP/Cache Storage response from satisfying this protocol dependency. It retains the canonical store module identity; no duplicate store or relaxed mode guard is introduced. Service Worker v60 precaches this exact URL as a required dependency before installation can succeed, and offline executable fallback reads its own generation cache rather than an arbitrary cache namespace. The unqualified engine remains in the shell for existing imports/tests. No IndexedDB, local work, outbox or unrelated caches are deleted by this correction. The normal app reload uses the new dependency; an already loaded old JavaScript document is not silently replaced in memory.

Cloud's public planner entry additionally rejects invalid explicit modes before either mock or real transport. Existing definitions/preservation signatures and the automatic no-selector UI remain intact. No score transformation, schema, Auth, live fixture, service write, migration replay or source grade transfer was added.

## Service metadata only

Fresh approved Supabase metadata reads on project `xlrubcwjqktzzunrvuns` inspected only named routine definitions/hashes/ACL/security settings, with no teacher/student or schema queries. `score_distribution_capability` still advertises automaticSafeCopyVersion 1, targetPreservationVersion 1, distributionApplyVersion 2 and N73_D119_V2. All seven `md5(prosrc)` identities exactly match `tests/n100-automatic-service-readback.json`:

| Routine | body MD5 |
| --- | --- |
| apply_score_distribution_plan (5 args) | b25642ed07bc4d2369862a6953cd6c71 |
| n73_build_distribution (4 args) | 479be8729717e19a48317c644c142cb6 |
| n73_build_distribution (3 args) | 8f56076d22eb24ec4b6e483ab47f6496 |
| n73_distribution_state | b6acbc0a1e59ae6ac54d0832723446dd |
| plan_score_distribution (5 args) | 9b41682160a7e1e809f519e889a35e1b |
| plan_score_distribution (4 args) | 2bc9107e2958a80fa0a5a843e4ca690b |
| score_distribution_capability | 8aabdab42d2f871a59fb0ebae1f34b52 |

Builder ACL remains postgres-only; planner/apply/capability remain postgres/authenticated; all remain SECURITY DEFINER with empty search_path. Initial `md5(pg_get_functiondef)` values differed because that hashes the entire declaration, whereas the prior evidence hashes `prosrc`; the corrected same-definition comparison matches every identity. There is no applied routine mismatch. Migration `20261014001558` was not reapplied. Unchanged native SQL certification and prior service readback are reused, not claimed as new live behavior tests.

## Affected verification

- `node tests/n100-invalid-mode-browser.mjs`: actual old shell → mixed-version error at store → v60 update → actual new document → recorded and empty target review/apply through real cloud JSON serialization and owner-bound durable Sync, locally fulfilled RPC only. Legacy modes compatible; unknown/null reject before transport. Existing TARGET marks, manual/NULL/late decisions, child identity and createdAt persist; no SOURCE marks copied. Upgraded app also boots offline, then explicitly reopens the expected synthetic owner database in that live document and observes identical saved rows and pending outbox.
- `node tests/n100-automatic-account-browser.mjs`: 17 affected account/UI/guard gates PASS at 390/1280px, including auth/workspace/lease/ownerless/foreign dispatch, mode/capability mismatch, stale-plan atomic no-write, exact lost-receipt retry, authoritative conflict and gained zero after review. Real app DOM/handlers/CSS; synthetic local HTTP service, not live acceptance.
- `node --test tests/n100-automatic.test.mjs tests/n100-preservation.test.mjs tests/n73-d119.test.mjs tests/n73-sync.test.mjs`: 23/23 PASS; existing owner/stale/preservation/zero and legacy semantics retained.
- Changed JavaScript syntax and `git diff --check`: PASS. No new full build, SQL replay or Preview was needed.

Machine results/screenshots: `test-results/n100-invalid-mode/result.json`, `original-boundary.png`, `upgraded-review.png`; existing actual-account output under `test-results/n100-automatic-account/`. Results record affected hashes and owned cleanup. No handwritten HTML fixture or file navigation.

Original harness failures retained: hash navigation left the original document/modal loaded; the harness now explicitly reloads after SW upgrade. A ready-only synthetic Demo flag allowed a subsequent landing render during account setup; the established preparing flag fixes the fresh boot. Canonical adoption normalizes absent deleted to false; assertions now compare the same semantic deleted flag while retaining every mark/identity/owner field, as the existing account harness does. No Product negative was weakened.

Browser/HTTP phases use the canonical shared browser lease because the test includes Service Worker and account ownership. Owned disposable contexts and loopback server close in finally with a bounded deadline; no personal profile, real credentials, live data or external RPC reaches the network. Lease release is recorded by the worker. No queue edits, push, integration, deployment, Production verification, PO acceptance or Product CLOSED claim.
