# N88/N44 — permission 403 preserves Auth (source candidate)

AI-authored, 2026-10-24. Task `continuous-n88-n44-permission403-session-preservation-20261024`, run `4d2590c2-e592-4ca4-bab6-c2e05475cbd8`.

## Exact source and scope

- Worktree/base: `ef96b507a2cc283d01c35ea03acc8d8848119750`.
- Read-only `git ls-remote origin refs/heads/main` observed `8d9cd07b8b740d982b18f3ae87cba996f6f23a17` during this run. `origin/main` matched it. No fetch/push/integration/deployment was performed.
- The affected `src/lib/cloud.js` Git blob was identical at base and observed current main: `00f309c0d1c7d8873f2b2b9f295c7b4cd496266b`. `git diff origin/main -- src/lib/cloud.js` was empty before implementation. The original module, not an Auth mirror, was exercised before editing.
- Fixed source Git blob: `90bc69c6d3f51d2ab7ec6ba37850e1f7fc490610`. The candidate commit containing this record supplies the exact candidate SHA in the runner result. Only cloud.js changes Product runtime behavior; remaining changes are scoped tests/evidence.
- Canonical operating contract, activated queue card/activation and current canonical N88/N44 rows were read. Latest N88 note explicitly authorizes this new shared source dependency. No queue/ledger/status changes.

## RED — observed before the fix

Command in PowerShell on the unchanged actual module:

```powershell
$env:PERMISSION403_RED='1'
node --test tests/permission403-session-20261024/session.test.mjs
Remove-Item Env:PERMISSION403_RED
```

Observed: `RED: unchanged actual cloud.js refreshes/replays permission denial and clears Auth` passed its explicit buggy-behavior assertions (1/1, 0 failures). Fetch sequence was data 403/42501 -> successful fabricated Auth refresh -> replayed data 403/42501. The public request rejected as AUTH_REQUIRED; session became null, persisted Auth was removed, authStatus became auth_required. This is a deterministic source-level reproduction, not a failed production experiment. The RED mode remains reproducible against the recorded original blob; it deliberately expects the old defect and is not part of the fixed-source green command.

## Fix and GREEN

Data API 403 now follows the ordinary failed-response path, retaining its original status/code/message/details/hint. It does not trigger reactive refresh, replay, or session invalidation. A 403 after a genuine 401 refresh similarly retains the refreshed valid session. Auth endpoint refresh rejection semantics (400/401/403) remain unchanged. Genuine 401 retains refresh and same-context singleflight, with terminal authentication failure still invalidating Auth.

The affected request path rechecks caller access, cancellation, owner/context generation and persisted owner before/after asynchronous boundaries. Terminal 401 may invalidate only the token actually attempted, preventing a late old request from clearing a newer valid same-owner token. Refresh keeps its existing independent owner/token/persisted-context checks. No ownership, lease, RLS/grants or service guard was disabled.

Executed final command:

```powershell
node --test tests/permission403-session-20261024/session.test.mjs tests/permission403-session-20261024/owned-store.test.mjs
node --check src/lib/cloud.js
git diff --check
```

25/25 tests PASS, no skipped/cancelled tests; syntax and diff checks PASS. Raw final output: `tests/permission403-session-20261024/green-output.txt`.

Covered affected gates:

- `permission403_preserves_session_without_refresh_or_replay`: one denied request, original permission failure, session/user reference and stored Auth preserved; actual module reopened via init without refresh.
- `true401_refresh_and_invalid_auth_clear`: 401 -> refresh -> success; 401 -> refresh -> 403 preserves new Auth; repeated 401 invalidates; invalid Auth refresh 400/401/403 still invalidates; transient refresh503 retains Auth; concurrent 401 requests share one refresh; a late401 reuses an already refreshed same-owner token.
- `owner_switch_cancellation_and_refresh_fences`: owner change, cancellation and cross-tab persisted-owner change during request, refresh, replay and terminal failure-body parsing; newer token during replay; caller assertAccess remains authoritative.
- `pending_sync_permission_failure_and_reopen_auth`: actual account store.save -> owner-bound command -> actual Sync engine -> actual cloud.applySyncV2Mutation -> stubbed 403, using existing synthetic-workspace and authenticated lease helpers. Exactly one RPC, no acknowledgement; exact mutation ID/patch/owner and locked envelope retained with original 403/42501. Local subject and separate UNKNOWN receipt retained after database/workspace reopen. Actual foreign-owner and invalid-lease calls fail before fetch. Additional direct-module checks retain a pendingSync student and UNKNOWN outbox unchanged.

Only fabricated sessions/users/tokens, in-memory localStorage, fake-indexeddb and stubbed fetch were used. No real Supabase/account/SQL/Auth/provider requests, student/teacher mutation, cookies/OTP capture, messages or denied operation. No server/browser was started, so no browser/server phase lease or process cleanup was required. These are real-module/store checks; no rendered-UI or browser acceptance is claimed. No new startup dependency or offline-shell change; no full build or unrelated suite.

## Meaning and delivery limits

Official semantics checked against [Supabase Database API 42501 errors](https://supabase.com/kb/troubleshooting/database-api-42501-errors): inadequate privileges and RLS denial can produce 42501/403. The card also supplies [PostgREST error mapping](https://docs.postgrest.org/en/v14/references/errors.html); that page's browser fetch returned cache miss in this run. The public changelog fetch returned unsupported markdown content type. No SDK/API feature or version change was made.

Served asset verification, integration, build and Production delivery are **NOT_RUN by this worker**, owned by the independent sole publisher/controller. Local readiness is for this exact source fix only. No claim that N88 issue-missing committed, student login works, N44 push arrived or real-account retention passed. Whole N88/N44 stay OPEN. The source proves a possible false-signout mechanism; attributing every historical logout to it remains inference. Original N44 cleanup UNKNOWN/reservations and new durable-trial issue-missing UNKNOWN are untouched; no replay, owner rebinding or counter reset.
