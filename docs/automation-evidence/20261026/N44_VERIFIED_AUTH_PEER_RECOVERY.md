# N44 verified peer Auth recovery — local candidate

AI-authored, 2026-10-26. Task `continuous-n44-verified-auth-peer-recovery-20261026`,
run `e31fea98-4dca-4a8d-b872-b6b70f1f9acf`.

## Exact source and prior evidence

Base and freshly observed remote `main`:
`31db4997640f2b1c69e500c6ba0b188dcca9c5ce`.
Pinned prior local candidate:
`b319ee789ab87c9cc291eaee392e50dc4bd3919e`.
Its cloud blob is `be96ca287f68119a40394ed52641b6c3067b340c`.
The isolated worktree started clean at the base. Only the seven declared files
from that delta were restored, before the bounded cloud recovery extension.
The prior credential comparison guards remain unchanged. Its document and four
historical logs retain their exact Git blob identities. Its test changes only
the one stage-specific zero-HTTP expectation described below.

The previous publisher stopped at `VERIFICATION_ASSET_MISSING` for the incorrectly
declared `src/lib/runtime-sync-ownership-guard.js`. The actual existing import is
`./sync-ownership.js`. Read-only verification of the current activated card
confirms public `verificationPaths` contains **only `src/lib/cloud.js`**. No card,
queue/status, integration, provider or publication operation was performed here.
Neither b319 nor prior cf05d188 is claimed integrated or published.

## Functional result and security boundaries

Before this extension, three successive normal requests from an independent old
actual cloud module all failed with `AUTH_CONTEXT_CHANGED` after the peer's
actual refresh rotated shared synthetic credentials. The persisted winner stayed
intact, but normal flow never recovered. This genuine RED is retained in
`tests/n44-verified-auth-peer-recovery-20261026/red.txt`.

Recovery now treats the persisted tuple only as a candidate. A dedicated bounded
Auth GET to the existing `/auth/v1/user` endpoint uses that exact candidate bearer;
the ordinary request primitive would overwrite it with memory's old bearer.
After transport and body parsing, the deadline, original memory reference/tuple,
owner, generation and exact persisted credential tuple must still match. Only a
server-returned user with the expected ID is committed; cached user metadata is
replaced. No Product Data API call precedes this verification.

Singleflight is per candidate/current context. A narrow storage listener reads
actual storage, ignoring event payload authority and unchanged credential events.
A failed attempt is remembered so metadata/spoofed events do not start an automatic
retry loop. A later normal operation may retry a transient verification failure.
Normal request, identity verification and refresh entry points can reconcile;
there is no reload, polling loop, SDK migration or automatic replay of old writes.

Session continuity retains prior capabilities only when the original in-memory
access token was already server-verified and the verified candidate has the same
session ID. Claims alone cannot establish continuity or grant authority. Missing,
unverified or different session identity conservatively retires the old lease and
score capabilities. A verified different session advances Auth generation and
rejects the initiating old operation; subsequent access uses the normal verified
workspace/lease entry. No recovery itself grants or renews a lease.

Logout, missing storage and another owner retire old memory without erasing the
peer's winning store. Late refresh/data/verification replies remain inert even
after a successful same-session handoff. Current exact-candidate Auth 401/403
still clears only itself; transient network/429/5xx preserves the candidate and
never falls back to the consumed old refresh token. Explicit password/OTP login
still advances the prior new-session generation fence.

## Affected verification

All transport responses and credentials were synthetic. Tests load actual cloud
modules independently over one shared fabricated store; no refresh logic is
mocked. The account-entry case also uses the actual account store, ownership
guard, offline lease and pending mutation envelope.

| Check | Actual result | Evidence under `tests/n44-verified-auth-peer-recovery-20261026/` |
| --- | --- | --- |
| Baseline repeated normal operations | RED, 1 failing case / three permanent stops | `red.txt` |
| Focused actual-module peer recovery and fences | 42/42 PASS | `green.txt`, `check.mjs` |
| Prior credential-fence, unchanged Auth context/403/owned-store and bounded lifecycle | 52/52 PASS | `regression.txt` |
| Exact port, preserved guards/history, untouched 26-case regression sources, actual remote base and publication declaration | PASS | `preflight.txt` |
| `node --check src/lib/cloud.js` and scoped Git whitespace check | PASS | Worker command results |

Focused coverage includes normal successive recovery with one candidate Auth
read and no stale refresh POST; automatic event/singleflight; unchanged/spoofed
metadata events including after transient failure; wrong/malformed user/JSON;
headers/body deadline and late body; candidate/owner/logout/new-login changes
mid-verification; current and late terminal denials; transient retry; old pending
data and refresh after recovery; different-session retirement and normal renewal.

The real guarded account-entry case preserves the queued mutation ID, patch,
owner and unsent local subject through same-session recovery. It explicitly
initiates one synthetic guarded RPC after verification, without acknowledging or
replaying the outbox. A different session invalidates the captured context and
lease, blocks another mutation, and requires normal verified renewal. The
unchanged 26 existing cases retain permission403/no-replay, UNKNOWN receipt,
foreign-owner, cancellation and offline-lease negatives.

Historical `N44_AUTH_CREDENTIAL_FENCE.md` and its 52-case evidence describe the
previous safe-stop stage, not the final recovery behavior. The first extension
regression run was 51/52: the old zero-HTTP assertion failed because a legitimate
candidate Auth GET now occurs. That failure remains in `initial-regression.txt`.
The refined test explicitly requires candidate Auth GET, no stale POST/no Product
REST and candidate retention on 503; no negative test was removed. The original
historical PASS/RED files remain intact. Initial preflight comparison failed only
on working-tree CRLF versus Git LF (`preflight-initial.txt`); normalizing EOL for
the comparison proves the unchanged guards without modifying their source.

No browser/server was started, so no phase lease or owned process remains. No
visual/UI PASS is claimed or needed for this cloud-only change. No new import,
startup dependency or offline-shell asset was added. No full Vite/native suite
was repeated; deterministic build and served asset verification belong to the
independent publisher.

The Auth verification approach follows the official
[Supabase getUser documentation](https://supabase.com/docs/reference/javascript/auth-getuser),
which describes a server request authenticating the returned user. The changelog
Markdown request was attempted; the web reader rejected its `text/markdown`
content type. No provider or Auth service request was used for these checks.

## Remaining boundary

This is local source readiness only. The controller/publisher must integrate,
build and verify the actual served cloud JavaScript. Production verification and
PO acceptance have not run here. There was no push or deployment.

Original 9453d5ba signout HTTP cause remains **UNKNOWN / NOT ESTABLISHED**. N44 OS
arrival remains **NOT PROVEN**, and N44 is not CLOSED. Original native 9e/f1a,
OFF/NULL state, consumed Source4/window, UNKNOWN source disposition and protected
staging deletion retry 0 remain untouched. No live Auth/login, account/OTP, SQL,
provider setting, source-save/cleanup, registration/send, native operation or
service-worker trial was performed or renewed. The externally requested login
remains the same original account; this work requests no new trial or identity.

Only reporter-generated trailing spaces on blank lines of the new RED and initial
regression logs were normalized for Git whitespace hygiene; failures remain intact.
