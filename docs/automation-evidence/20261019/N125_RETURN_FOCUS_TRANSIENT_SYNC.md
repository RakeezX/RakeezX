# N125 — foreground return Sync lifecycle

AI-authored, 2026-10-19. Task `continuous-n125-return-focus-transient-sync-20261019`, run `a4cffdb4-a229-4390-a948-7d6d37317a88`.

Base: `0b4e841ca9447373add29c0a62876494a81ecdb8`. The activated card and latest canonical Product row `[PO-20261019-1719]` authorize this new return regression only. N123 stays CLOSED; its completed startup proof was reused, not replayed. Read-only `git ls-remote origin refs/heads/main` observed `a27916ff77d8edccdd32b71e19a064f51fc21cc3`; the four affected source files have no difference between that revision and the assigned base. No ledger/queue edits, push, deployment or service mutation.

## Cause and bounded change

The already-open app independently responds to foreground visibility/pageshow and Settings' pending-email focus verification. `saveSession` replaced the session object even for field-identical `/user` verification, without notifying subscribers. A complete Sync read then rejected that replacement as `sync-context-changed`. Duplicate return notifications could also request another full pass. The baseline synthetic HTTP app reproduced red followed by recovery in two return sequences; see `tests/n125-actual-1719/baseline.json`.

Sync now owns one readiness phase per foreground lifecycle. Focus, pageshow and visible notifications coalesce until the next departure; online recovery uses the same prerequisite path. The existing app renewal runs before receiver refresh and a new capture. An already-active pass drains before renewal, and visible blur does not invalidate its capture. Current ownership is rechecked after preparation; a genuinely replaced valid workspace schedules through its current guards. No new debounce, retry deadline or cached ownership grant was added.

An identical complete Auth snapshot retains its previous session/user references. Nested metadata changes, tokens, owner changes and logout still use the existing invalidation/notification path. Preparation is neutral pending, without manual Sync competing with it. Established hard/durable errors retain precedence. ACK, revisions, tombstones, outbox and grade mechanisms are unchanged.

## Affected checks

- **PASS** `node tests/n125-actual-1719/returns.mjs` — `n125_two_return_lifecycles_true_context_error_preserved`. Actual application index, handlers, store, ownership guard and source CSS on task-owned loopback HTTP, fresh isolated 390px context. Two return sequences include hidden/visible, pagehide/pageshow, blur/focus and duplicate later wake notifications, with 600ms synthetic identity verification. Each return has zero record reads during preparation, one verification and one complete pass, no generated red, and no duplicate trailing pass. Healthy state follows the complete guarded read; no synthetic receipt is treated as a durable ACK.
- **PASS** same scenario: focus during a held real app read waits for that pass before renewal; a genuinely changed session during a subsequent read still produces `Sync ownership blocked: sync-context-changed` and unhealthy red. A persistent read failure stays red across another return with its support action. Foreign-owner manual UI Sync performs zero additional record reads. Synthetic grade 18 and empty outbox are preserved. Evidence: `tests/n125-actual-1719/result.json`.
- **PASS** `node --test tests/n125-actual-1719/auth-context.test.mjs tests/n64-bounded-verification.test.mjs` — two tests. Identical Auth verification preserves references without notification; nested identity and token changes remain observable. Existing bounded verification, timeout, stale-owner/token/logout guards pass. Output: `tests/n125-actual-1719/auth-checks.txt`.
- **PASS** `node --check` on all four edited source modules; `git diff --check`.
- **FAIL, pre-existing/non-gating** exploratory `node --test tests/n95-sync-status-severity.test.mjs`: 3 passed, 2 failed. One test pins scheduling source to `8e2d480...`, preceding existing N123/class-deletion changes; the other fixture fails `Score capability owner changed` before its expected transient transport failure (`error !== pending`). Both failures were separately confirmed using the assigned base through the bounded `base-loader.mjs`; see `n95-base-source-pin-failure.txt` and `n95-base-failure.txt`. Original assertions/guards were not changed or represented as PASS. The actual app N125 checks above cover the affected hard-error/owner behavior.

Test development failures remain recorded: a selector initially chose the hidden sidebar teacher trigger; the active-return harness initially accepted an intermediate asynchronous readiness observation. `selector-harness-failure.json`, `active-return-initial-failure.json` and `async-readiness-harness-failure.json` preserve those results. The corrected harness uses the visible topbar entry and awaits completed same-document checkpoints, including the actual renewal counter, before proceeding.

## Disposition

The canonical `withIsolatedLocalBrowser` helper validated the active synthetic card. No shared live-browser lease was needed for this authorized isolated phase. Fresh contexts block Service Workers and external requests; the owned browser/context and unique loopback server close in `finally` on success and failure. No live account, real record, hosted service, private profile or external message was used. No new startup dependency or offline-shell change.

Local candidate readiness only. Independent controller/publisher owns integration and Production evidence; PO acceptance remains separate. No full build or broad application matrix was run.
