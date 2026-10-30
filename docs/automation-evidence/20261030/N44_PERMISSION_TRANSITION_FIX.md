# N44 permission transition repair — 2026-10-30

Task: `continuous-n44-permission-grant-race-20261030`  
Run: `ebcb0f1c-abd3-4ecd-9d08-d496cfb44066`  
Base: `2ef68e981839db16450ad7927a0e9e8dd7a540c4`

The mounted application reproduced the first-opt-in race before correction. The
real settings button invoked the real runtime/client/browser/gateway. A fake
Permissions API emitted default → granted while native subscribe was deferred.
The unconditional listener invalidated the runtime and synchronously revoked the
client epoch. Resolving the subscription then returned `stale_context`, with
register **0** and unsubscribe **1**. This is a mounted-runtime reproduction,
not the earlier standalone client experiment.

The listener now invalidates immediately for non-granted permission, then uses
the existing refresh path. Granted permission preserves a valid current binding
and pending gesture. Refresh still checks owner/workspace/session/token, lease,
consent and expiry; the client and gateway retain their stale-response fences.
No new lifecycle state, startup dependency or client/service contract was added.

## Affected verification

Commands executed successfully:

```text
node tests/n44-permission-transition-20261030.test.mjs --reproduce
node tests/n44-permission-transition-20261030.test.mjs
node --check src/lib/notification-push-runtime.js
node --check tests/n44-permission-transition-20261030.test.mjs
node --check sw.js
git diff --check
```

The optional reproduction mode serves the immutable base runtime at its normal
HTTP module URL. The corrected run serves the actual worktree source. Both use
the actual app DOM, settings handler and CSS, existing served-demo readiness,
N44 verified-account/ownership fixture and synthetic native ports. No ownership
guard is replaced. The only runtime wrapper observes the real opt-in return.

| Required check | Result and observation |
| --- | --- |
| `n44_first_permission_grant_preserves_optin` | PASS: pending grant and idle grant both finish subscribed, register 1, unsubscribe 0; grant adds no consent clear. Idle grant itself performs no native subscribe. |
| `n44_non_granted_permission_revokes_and_cleans` | PASS: pending denied/default both return stale_context, register 0, unsubscribe 1. After successful subscription, denied/default each revoke once, unsubscribe once and clear worker binding without another register. |
| `n44_permission_event_preserves_owner_session_guards` | PASS: owner change, different session token and lease loss before grant each return stale_context, register 0, unsubscribe 1. |

Nine corrected scenarios pass. The original causal control remains an expected
failure of Product behavior, not a claimed acceptance PASS for the old source.

The SW header requires a cache version change for application updates. Version
v99 → v100 is the only SW change. An exact normalized comparison against base
passed after substituting that single version string: every cached asset and all
worker logic are preserved, including N143 direct-import assets. This is a
source preservation check, not offline-cache or real Service Worker certification.

Read-only `git ls-remote origin refs/heads/main` observed the exact base above;
no already-present main blocks were copied. The final candidate is identified
by the runner result and its AI-identified Git commit.

## Resources and acceptance limits

Canonical `withIsolatedLocalBrowser` validated the active local non-live card and
owned fresh contexts; external requests and Service Workers were blocked. The
loopback server used an OS-assigned unique port. Runtime disposal/context closure,
helper browser cleanup and server closure completed in finally blocks. This
approved isolated phase does not reserve the shared live-browser lease.

All API responses, account identities and subscriptions were synthetic/local.
Real subscriptions, live tokens, service/backend/SQL operations, trial activation,
provider sends, push/deploy and queue mutations: **0**. Delivery and scheduler
configuration remain false. ExistingClickOnly restoration and projection UNKNOWN
reconciliation are unchanged and outside this repair.

LOCAL_READY applies only to this frontend lifecycle repair. Publisher build,
integration and served-asset verification are NOT_RUN here and remain with the
original controller/publisher. N44 remains unaccepted; physical-phone delivery,
the finite trial and umbrella acceptance are unproven by these checks.
