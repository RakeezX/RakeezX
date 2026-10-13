# N73 account distribution eligibility correction

Task: `continuous-n73-owner-preflight-20261013`  
Run: `901fe1a1-686e-400a-bf92-4be9504dfb41`  
Base: `cfe7c2144a8269adad617aeca37ea652fda53e01`  
Authority: activated local-only card, PO 2026-10-13 N73 diagnosis, D-119; independent publisher owns integration and Production verification.

## Reproduction before the source change — PASS

`node tests/n73-account-flow-browser.mjs --reproduce` ran against the unchanged base store. A fresh disposable browser loaded the actual application over task-owned loopback HTTP, using the existing `openReadyServedDemo` helper before activating an isolated synthetic account through the public store API. Matching UUID auth and claimed workspace, `syncEligible: true`, a valid runtime N49 lease and an empty outbox were asserted.

Actual `reviewScoreDistributionCopy` returned its existing Promise and rejected with `تعذّر التحقق من ملكية مساحة العمل.`. The unmodified runtime guard reported `command-owner-missing` for the commandless dispatch eligibility call. The actual copy sheet displayed that error and kept Apply disabled. No synthetic plan or apply HTTP request occurred. Artifacts: `test-results/n73-owner-preflight/reproduction.json`, `before.png`.

## Correction and affected flow

Only Product change: `requireDistributionAccount` uses existing `cloudAccess({operation: 'pull', authenticatedUserId})` for non-mutating account eligibility, matching the guard's existing read contract. It retains restore/claim recovery, readiness, lease, authenticated account/workspace, capability and pending-outbox checks. Neither return type nor async contract changes.

Review still calls the server planner, validates its protocol/identity and remembers the exact plan. Apply repeats eligibility and verifies that remembered token and confirmation, then calls `applyReviewedCommand`. Actual `createSyncV2Engine.queueCommand` binds and durably stores the command owner; `dispatchPending` and receipt reconciliation continue validating `dispatch` with the exact command. The ownership guard, cloud wrapper, engine, UI, scoring rules and server migrations are unchanged.

## Actual account regression — PASS

`node tests/n73-account-flow-browser.mjs` passed 19 affected checks. The browser executes actual application DOM, handlers, source CSS, store, IndexedDB, runtime ownership guard, N49 lease and Sync engine. Only account/session and bounded HTTP service responses use the existing public fixture interfaces; no ownership or eligibility result is overridden. The HTTP fixture uses the existing distribution planner and canonical field encoder, and asserts a matching owner-bound durable command at the transport boundary.

- 390px: select two fifth-grade target classes; 1280px: select one. No default targets or removals; effect details initially collapsed; no horizontal overflow. Actual review → confirmation → store → durable dispatch → canonical receipt completes, with success toast and clean outbox.
- Preserve matched parent identity, valid target grade 18, extra item/grade 4, source grade 19; persistently clamp 23/25 to 20/20. Missing target parent is created without source grades. Screenshots `390-review.png` and `1280-review.png` visually inspected.
- Both public review and apply reject auth mismatch, workspace mismatch, unauthenticated or unknown context, sync-ineligible workspace, pending claim recovery, cloud restore, expired or missing/read-only lease, and pending outbox. Ownerless and foreign-owner durable commands fail real dispatch validation. All 12 negative contexts produce zero server mutation attempts/commits.
- Planner failure is displayed with Apply disabled. A stale second review produces the existing distinct re-review message without confirmation or dispatch. HTTP409/PT409 stale apply produces the rejection message and a rejected durable command, with no server commit.
- A lost receipt after an accepted apply displays the saved-for-retry message. Actual engine retry sends the identical mutation/device/plan/token envelope, adopts canonical data, clears outbox, creates no duplicate parent, and leaves the synthetic service at exactly one commit.

The final run is recorded in `test-results/n73-owner-preflight/result.json`, bound to these SHA256 file bytes (the recorded HEAD is the pre-commit base; these hashes identify tested changes):

| Path | SHA256 |
| --- | --- |
| `src/store.js` | `ee815c5482d9aa7d5c39465edf794c324334dbc570f8940cea44d8306841adc6` |
| `src/views/items.js` | `cf0d0de864746e8d6497c3f05a10b62a92ba2fb558873e1761e57f1507aaa887` |
| `src/lib/sync-ownership.js` | `e4793eae5c7512a193282cf9129561397cabe8a00f18421ac52810c7c43f3ff7` |
| `tests/n73-account-flow-browser.mjs` | `16cb3b8358f2ba787eacf521d2b443d389b40ea879e4881251885359afa19432` |
| `tests/n73-account-flow-fixture.mjs` | `8ae9edde970ae4d697cf88421cf03abf346bc3983a4524b8612e5558c51fd4d2` |

Future authorized local runner executions can supply `N73_TASK_FILE` / `N73_RUN_ID`; the canonical helper still requires a matching active, non-live local/synthetic card and activation. `--reproduce` is specifically for the unfixed base, not an expectation on the corrected candidate.

## Affected existing checks and reused evidence

`node --test tests/n73-d119.test.mjs tests/n73-sync.test.mjs tests/score-foundation-local.test.mjs`: **23/23 PASS**, covering grade clamps and identity, explicit extra removal, ambiguous mappings, owner/year/grade/term/subject boundaries, subitem/completion preservation, auto projection, parent metadata rename, repeated application, exact durable retry and foreign/wrong-plan receipt refusal.

`node --check` on the changed store and both new test modules: PASS. `git diff --check`: PASS. No full build or repeated Preview was needed for this eligibility correction.

Reused prior exact native SQL and authenticated A/B proof from `artifacts/ops-supervisor-v4/results/continuous-n73-real-distribution-20261012.json`, run `13662211-def7-4f81-ab9e-7c25aca9c3d7`, candidate `c0948e7917f8a1689f188428b97dd983d5eea503`: native protocol binding, owner isolation, stale refusal, atomic accepted/repeated apply and device convergence. A targeted Git comparison from that candidate to the current base produced **no diff** for `src/lib/cloud.js`, `src/lib/sync-v2.js`, `src/lib/score-foundation.js` and the three named N73 migrations (`20261012120000`, `20261013083000`, `20261013090000`). No SQL, Auth, RLS, DDL, live fixture, secret or private-account access was performed for this correction. Existing N77/N98 paths are unchanged.

## Resource disposition and delivery boundary

Canonical `withIsolatedLocalBrowser` owns fresh contexts/engine, blocks Service Workers and all non-loopback requests, and closes its owned resources in `finally`. This approved local/synthetic phase needs no shared live-browser lease. The unique ephemeral loopback server also closes connections and listener in its own `finally`; both browser runs completed and exited. No personal browser/profile, external account, shared lock, queue status, push or deployment was used or changed.

Result: local candidate ready for the independent controller/publisher's authorized integration and served Production checks. No claim of deployment, PO acceptance or Product CLOSED.
