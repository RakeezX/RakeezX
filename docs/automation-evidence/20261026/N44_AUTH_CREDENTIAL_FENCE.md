# N44 client credential race — AI-authored bounded candidate

- Task: `continuous-n44-auth-credential-fence-20261026`
- Run: `38e1e544-bef7-4a90-bf74-e3b0abff34c4`
- Base: `31db4997640f2b1c69e500c6ba0b188dcca9c5ce`
- Scope: `src/lib/cloud.js` and this task's synthetic tests/evidence only.
- Outcome: source-local readiness; no push, integration, deployment or served-asset verification performed by this worker.

## Reproduction and repair

Two independently imported instances of the actual cloud module have independent
session memory and share one synthetic localStorage implementation. Actor B uses
the actual refresh/sign-in/sign-out handlers to replace or remove shared state.
Actor A then attempts a stale refresh, or receives a delayed refresh/user/data
response. Only fetch responses are fabricated. No refresh implementation is
mocked, and no live Auth or Data API traffic occurs.

Before the source edit, the first 14 tests produced **11 FAIL / 3 PASS**:
preflight sent stale credentials, late old responses erased or overwrote the
same-owner winner, and old user/data responses survived shared replacement.
The unchanged failure output remains in `tests/n44-auth-credential-fence-20261026/red.txt`.
No baseline fixture error was encountered. The later added tests were not part
of that baseline run.
The first staged whitespace check flagged spaces on blank lines emitted by the
Node failure reporter in `red.txt`; those trailing spaces alone were normalized.
All failure messages and original results are retained. The final candidate
whitespace check passes.

The client now compares the persisted owner/access-token/refresh-token tuple
before refresh and captures that tuple plus in-memory generation for its
post-await commit/clear checks. A peer replacement, logout or changed memory
retires the response with `AUTH_CONTEXT_CHANGED`. Data requests check shared
credentials before dispatch and after awaits; terminal 401 also checks the
actual attempted tuple. User verification uses the same exact credential fence
before either committing identity or clearing a denied session. An explicit new
sign-in/OTP session advances generation even for the same owner, retiring old
requests rather than treating owner equality as session continuity.

Reconciliation deliberately **stops safely** on a shared credential mismatch;
it does not automatically adopt stored identity or replay a write. The stale
client's memory can remain old until the existing initialization/verified flow
is used. The winning persisted credentials remain intact. No cached metadata,
JWT claims or stored identity gains owner/workspace/role/offline-write authority.
Current unchanged terminal Auth denial still clears; transient failures retain
credentials. Existing in-tab singleflight and bounded cancellation remain.

## Actual checks

All commands ran locally in the isolated task worktree:

| Check | Result | Evidence |
| --- | --- | --- |
| `node --test tests/n44-auth-credential-fence-20261026/credential.test.mjs` | 25/25 PASS | `green.txt` in the same test directory |
| `node --test tests/permission403-session-20261024/session.test.mjs tests/permission403-session-20261024/owned-store.test.mjs tests/n125-actual-1719/auth-context.test.mjs` | 26/26 PASS | `regression.txt` in the task test directory |
| `node --test tests/n64-bounded-verification.test.mjs` | 1/1 PASS | `bounded-regression.txt` in the task test directory |
| `node --check src/lib/cloud.js` | PASS | Syntax check exit 0 |
| `git diff --check` | PASS | No whitespace errors |

New cases include stale preflight without POST, late 200/400/401/403 refresh,
rotation during response-body parsing, late user 200/401/403 and Data API 200/401,
logout/new owner/new session/memory changes, unchanged terminal user denial,
network/429/500/503, shared refresh deadline/abort with an ignored late body,
same-owner new-login generation, and no data dispatch after peer logout/owner change.
Existing checks exercise the real authenticated store with ownership and offline
lease guards: the exact queued mutation ID, patch, owner, locked envelope,
attempt receipt, UNKNOWN receipt and student/local record survive denied 403
without refresh or write replay. Foreign-owner and expired-lease negatives pass.
Existing verification reference stability, current terminal refresh denial,
singleflight, caller cancellation and workspace/access fences also pass.

These are actual-module/store checks, not rendered UI evidence. No DOM/layout
change is included, and no UI PASS is claimed. No browser/server was launched,
so no browser phase lease or process cleanup was needed. No new dependency or
startup module was introduced; offline shell paths are unchanged.

## Sources and remaining delivery boundary

Reviewed the official [Supabase sessions documentation](https://supabase.com/docs/guides/auth/sessions)
and [lockless coordination guidance](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md).
They describe single-use refresh tokens and snapshot-based discard of refresh
results replaced by concurrent credentials. This custom client keeps its existing
architecture; no SDK migration, cross-tab semaphore, provider setting or lock was added.
The changelog Markdown URL was attempted through the web reader, which reported
unsupported `text/markdown`; this does not affect the local test result.

The independent publisher still owns integration/build/Production and **served
cloud.js proof**. That check has not run here. This candidate does not establish
the HTTP cause of original signout `9453d5ba`, Source4 canonical ACK, or OS arrival;
those remain UNKNOWN/NOT PROVEN. N44 is not closed. No old SourceSave, live pair,
registration/send/window, archive, approval/delivery policy or private custodian
operation was retried or changed. Existing fixture retirements, original source
intent and service archives retain their prior disposition.
