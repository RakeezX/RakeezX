# N44 passive configuration read stability — AI implementation

Task: `continuous-n44-config-read-stability-20261026`
Run: `3f79b806-4902-4a96-b085-ead96b851234`
Base: `3ab03e8e29901bbda2f81a6d841f0904e364bf15`

## Bounded result

The actual runtime previously issued six configuration requests for an initial settled response followed by five stable event bursts. This reproduces for HTTP429, HTTP503, HTTP200-disabled, invalid shape and transport failure. The baseline FAIL receipts remain in `tests/n44-config-read-stability-20261026/red.json`. The red runner serves the immutable base runtime directly from Git over owned loopback HTTP, with the actual gateway, ownership/store guards and view modules; it does not copy a runtime implementation.

The repaired runtime retains one in-memory attempt per material owner/workspace/device/credential/session/consent/lease/permission/generation context. Stable store notifications, same-token cloud metadata, equivalent workspace metadata objects, storage/pageshow/focus and repaints preserve the finite result instead of starting another request. Workspace matching retains the current ownership guard and checks the material workspace ID and database rather than object allocation. Successful service expiry can select a new read. Changed in-flight contexts are fenced and their queued refresh is retained.

One normal readiness button is inside the existing closed Support disclosure. It performs a manual readiness check, never permission prompting, consent enablement, registration, source verification or send. A valid binding and pending Stop block the action. An unbound manual check can prepare fresh readiness, but never restores/registers or retires a saved subscription, performs a consent CAS or drains cleanup; existing saved binding state remains for its normal lifecycle. HTTP429 keeps its diagnostic and imposes at least 60 seconds from the failed response before another explicit gesture; there is no deadline retry, polling or timer. No reliable Retry-After is exposed by the unchanged gateway, so the conservative local interval is used. No new dependency or startup import was added.

## Affected evidence

All paths below are under `tests/n44-config-read-stability-20261026/`.

| Check | Actual result |
| --- | --- |
| `node check.mjs --red` | Expected Product FAIL: six actual runtime/gateway config requests for each settled 429/503/disabled/shape/transport case; immutable baseline SHA and served runtime hash recorded. |
| `node check.mjs` | PASS: one request per stable context; actual delegated manual action refuses before cooldown, one after, double gestures coalesce, no automatic deadline retry. |
| Same `check.mjs` | PASS: owner/device/token/verified lease/consent/permission select new contexts; credential mismatch and workspace without a valid lease send zero new requests. Late owner/token/device/lease/permission results discarded; changed contexts queued once. |
| Same `check.mjs` | PASS: actual runtime/client/gateway with reused synthetic browser ports preserves explicit opt-in from default permission to granted, valid binding, saved registration without manual restoration/mutation, same Auth-session token continuation without config, restored registration, failed Stop fence and explicit cleanup; expired context fails closed. All registrations/updates here are synthetic function-port responses only. |
| `node recovery.mjs` | PASS: adapted existing affected recovery harness exercises real DOM/delegation/store ownership, same-owner reset, identical markup recovery, private DOM clearing, owner/unmount and finite manual outcome/Stop fences. The outcome port in this reused view test is explicitly synthetic, not native arrival evidence. |
| `scoped-checks.json` | PASS: two source syntax checks, five existing affected client owner/cleanup/action tests, `git diff --check`. |
| `390-light.png`, `320-dark.png` | Actual source CSS/view inspected: one Support disclosure, readiness action hidden while closed, keyboard focus works when open, no horizontal overflow. Recovery captures also retained. |

`green.json` and `recovery-green.json` record normalized source hashes. Browser phases use only canonical `withIsolatedLocalBrowser`, fresh contexts, loopback HTTP, blocked real Service Workers/external requests and synthetic identities. Each runner closes its owned server in `finally`; the canonical helper closes owned contexts/browser. All runner processes exited. No shared live-browser lease was required under the isolated-local exception.

Harness corrections are not Product failures: a made-up lease renewal ID correctly blocked access, so the test now uses the real local lease renewal adapter; an invented workspace ID correctly has no valid lease and is asserted to send zero; stale synthetic consent from a prior case caused the existing disabled cleanup read, so fresh cases clear only their synthetic consent keys. The initial workspace assertion failure is preserved in `harness-workspace-lease-failure.json`. The recovery harness also now settles the genuinely new lease context before counting stable notifications; its prior mistaken expectation is retained in `harness-recovery-new-context-failure.json`. A real regression found during this change is retained in `manual-button-disabled-failure.json`: identical-markup region diffing left the imperatively disabled cooldown button stuck. The action now explicitly restores its disabled state after a refused gesture and fences unmount; the same actual handler test passes. The actual original live429 failure remains unchanged and was not retried.

## Preserved boundaries and continuation

Only `src/lib/notification-push-runtime.js` and `src/views/notification-settings.js` change public code. Native19/PG/transport/service/SW and prior layout proofs are reused for unchanged dependencies; no native rebuild or broad suite. Live limiting layer remains **NOT_ESTABLISHED**; OS arrival remains **NOT_PROVEN**. Current limits, policy, nonce/quota, service code, DB/Auth/security, native artifacts, browser custody and protected staging are untouched. No provider/account read, live registration, source operation, send, SQL or deletion ran. The original fourth scope remains unspent; no new authorization is claimed.

This is source-local readiness only. The independent sole publisher must build/integrate and verify the actual two served files before the original private session's already-authorized continuation after its natural rate interval. No push/deploy/provider verification or Product acceptance is claimed here.
