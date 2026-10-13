# N100 — target record preservation, local candidate

Task `continuous-n100-preserve-target-marks-20261013`; run `ae569547-8bd4-434b-9c1a-c19baa442ce0`.
Base `c5608e44bdc7a30ff3e8655399cd1605a0dbbd93`. Isolated worktree `.worktrees/continuous-n100-preserve-target-marks-20261013`.
Authority: activated N100 card and PO label-only preservation decision recorded in Product ledger N100. The runner result identifies the exact candidate commit.

## Result

The existing copy sheet has exactly two choices: **نسخ التوزيع فقط** (default on every opening) and **نسخ مع حفظ سجلات الفصل الهدف**. Review includes copied names, planned start/due dates, regular/late points, preserved score/completion counts and per-target exclusion reasons. Existing additional target definitions remain. Preservation does not offer removals. Confirmation describes metadata changes without claiming that stored marks change. New definitions are explicitly unmarked; success reports accepted class and changed-item counts.

Accounts continue through `requireDistributionAccount`, the existing pull eligibility guard, N49 lease, clean outbox requirement, server review and exact owner-bound durable `score:distribution_apply` dispatch. Mode is included in the remembered review key and checked against the server response. No client score rewrite is used for accounts. The synthetic/Demo counterpart lives in the new bounded module; the existing foundation engine is unchanged.

Preservation requires unique normalized main names, matching recording representation/max/configuration, and equal child count, unambiguous order and regular/late weights. It prefers an unambiguous origin identity; otherwise it pairs children by ordinal position. Child names are not equality conditions. Conflicting origin, duplicate name/order, incompatible type/max/weight/count or reused identity excludes the entire affected target with no operations for it. Existing target scores, manual additions, completion IDs/states and historical child `createdAt` are untouched. Dates do not recalculate a stored late/regular choice. Missing target definitions get new unmarked identities and actual creation time.

## One additive migration, certified locally

Prepared `20261013101500_n100_preserve_target_marks.sql` only; **not applied to the provider**. Existing migration files are unchanged. The user's final delivery instruction leaves integration, service application/readback and Production verification with the independent controller/publisher.

The source read used the authorized Supabase connector under this worker's owned service phase lease. `tests/n100-provider-source.json` contains the exact five function definitions, signatures, body MD5s, ACLs and security/search-path configuration observed in project `xlrubcwjqktzzunrvuns`; no teacher/student rows or credentials were queried. The lease was then released. The migration is generated from these definitions, and its initial transactional guard rejects changed source/ACL/security configuration or a replay.

Two compatible overloads of **existing** builder/planner names accept `p_mode`; no new routine names, tables, Auth/RLS policy, restore protocol, backfill or mutable student metadata. Existing signatures/default calls remain. The legacy four-argument planner keeps definitions-only state tokens, and an actual review created before the migration successfully applies afterward. The capability adds `targetPreservationVersion: 1`; preservation fails closed against an older service.

Preservation stores the optional mode in existing request JSON and binds the current full owner-scoped state, saved request and server-calculated definition operations into its token. Apply rebuilds and verifies those operations under the existing locks before any mutation. Existing private-helper ACLs, public RPC authentication, owner checks, idempotent receipt envelope and atomic rollback are retained. Receipt scope contains accepted TARGET records only. Current server field mappings remain identical.

## Affected verification

- `node tests/n100-native.mjs`: **4 required server gates PASS**, on disposable native PostgreSQL 17, loading the ACTUAL observed provider functions and exact additive migration. Target regular 5 (manual 2), late 2 (manual 1), NULL/unmarked, completion identities/states and historical creation timestamps survive changed labels/dates. Source student grade 9 deliberately differs. Exact command retry returns the identical receipt; a fresh repeated plan is a no-op. Stale grade/date/completion/origin rejects every selected target. A forced final-target exception rolls back earlier target writes. Foreign authenticated owner cannot read plans or apply/review another owner's definitions. Count/order/regular/late weight/max/recording-mode/normalized duplicate cases exclude the target with zero operations. An old pre-migration review remains valid; attempted local migration replay fails its source guard and changes no function. Artifacts: `test-results/n100-native/result.json`, `server.log` (expected negative-case SQL errors retained).
- `node tests/n100-account-browser.mjs`: **15 PASS**, real application DOM, handlers, source CSS, IndexedDB, claimed account store, real ownership/lease guards and durable Sync, over task-owned loopback HTTP with bounded synthetic auth/transport. No ownership-success mock. 390px selects two targets; 1280px selects one. Both preserve 5/2/NULL and manual marks, source 9/19, child IDs/date/history and extras, with clean outbox. Negative contexts cover auth/workspace mismatch, expired lease, pending outbox, ownerless/foreign dispatch, mode mismatch and old capability. Ambiguous review disables Apply; stale apply is rejected; lost receipt retries the identical envelope with one commit. Both V5 backup → JSON roundtrip → integrity/invariant → current restore review checkpoints preserve every field and produce zero restore operations against unchanged owner state.
- Screenshots `test-results/n100-account/{390,1280}-{review,impact}.png` and `ambiguous.png` visually inspected: actual copy choices/impact, readable isolated ISO dates, zero horizontal overflow. No lookalike UI, file navigation, personal browser/profile, Service Worker, real Auth account or live class operation.
- `node --test tests/n100-preservation.test.mjs`: **3 PASS**. Real Demo write transaction, persistent reload, historical/new creation time, default-mode compatibility, ambiguous shape and stale metadata refusal across targets.
- `node --test tests/n73-d119.test.mjs tests/n73-sync.test.mjs`: **14 PASS**. Reused after unchanged relevant data paths: existing clamp/default copy, owner/subject/year/grade/term safeguards, tombstones, exact retry and canonical/backup field serialization.
- `node --check` for all four changed Product JS files and `git diff --check`: **PASS**. No full build or remote Preview required.

Original harness failures are preserved here: first account comparison included Sync's newly adopted `canonicalId`/`serverCanonical` rather than comparing Product and owner fields; corrected comparison retains all marks, IDs, states, owner/revision and deletion checks. The added backup checkpoint rejected the original synthetic fixture with `سجل سحابي بلا خط أساس`; the fixture now carries canonical baselines through the existing encoder/decoder, as actual pull/restore does. The added legacy native fixture initially collided with `years_hijri_uniq` at 1450; its separate synthetic year is now 1448. These were fixture/comparison corrections; no Product guard or acceptance requirement was weakened.

Prior real N73 A/B evidence is reused from `artifacts/ops-supervisor-v4/results/continuous-n73-real-distribution-20261012.json`, run `13662211-def7-4f81-ab9e-7c25aca9c3d7`, candidate `c0948e7917f8a1689f188428b97dd983d5eea503`, as referenced by [N73 owner preflight evidence](N73_OWNER_PREFLIGHT_FIX.md). This supports unchanged Auth/ownership/protocol behavior; it is not a claim that N100 was live-tested. No new accounts, capabilities or live pair were provisioned. `origin/main` observed at `215ab756b5d1f5ea0e2e21c9ba52a6b70300c75a` had no diff from this base for the affected Product source/dependencies, including the existing N71 restore paths.

## Tested file-byte binding and resource disposition

| File | SHA256 |
| --- | --- |
| `src/store.js` | `9aaa188c62df918a15704aee71bf868e20d4c1944c4f24e6113024f09d22b985` |
| `src/views/items.js` | `7a9b2bd991b9413343b2210aea7e861bf944e32e119156e21a99a27730c35040` |
| `src/lib/cloud.js` | `8e0d60e94016c82c593c1d681ba043fec8cf6c2636b9d1c877f8574e11eb22ad` |
| `src/lib/score-distribution-copy.js` | `324174e3378246a25998b1de5d7d3d8d87f7b0e8f990b3fc57bfc2bedf898f88` |
| Additive migration | `a682af80aa8d12e34601ab2113c0ffaaf3b849b8eddff2ac63612679d8b4540f` |
| `tests/n100-native.mjs` | `8f3836593b6f324b343fa5adae7c26d06e3fc05682fec37644b7ddc78588154d` |
| `tests/n100-account-browser.mjs` | `56d8b71bbed2e0ce800dc1af5782c6e48161615ed54e9056b2fcf679564fd010` |
| `tests/n100-account-fixture.mjs` | `7c8fe449255f2e7944f003ce30d10d9a66795aec5fd07f1499a9a2ff56c62e82` |

The card's liveAuthorizationRef excludes the non-shared browser helper, so the actual synthetic account browser phase used the canonical **shared browser lease**, fresh disposable contexts and an explicit loopback-only request route, with Service Workers blocked and a bounded browser deadline. The owned browser/listener closed in finally and that worker lease was released. The native PG listener stopped and its owned cluster was removed. Both browser and service leases were observed FREE afterward. No other owner's resources, controller/maintenance files, queue status, main, push or deployment were changed.

Local candidate only. Controller/publisher must integrate the candidate, apply and read back the guarded migration once under the activated authority, verify provider source/ACL/history and served Production behavior, then record the genuine delivery result. This evidence does not claim Production, PO acceptance or Product CLOSED.
