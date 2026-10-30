# N44 stale HTTP400 projection recovery — local candidate

AI-authored implementation and evidence, 2026-10-31.

- Task: `continuous-n44-stale-projection-http-20261031`
- Run: `9b8abb69-a965-46d4-b2ef-b2a0cb3d8a1b`
- Base: `bea7b8b9b9766bd3ee45e5ad75d465b191b737bf`
- Scope: gateway transport, one new focused test file, this receipt.

## Cause and bounded correction

Before editing, an actual `createPushGateway().project()` call with a real
`Response(400)` containing `{status:'stale',sourceStamp:A}`, followed by an
available updated response, produced exactly
`{"calls":1,"httpStatus":400,"disposition":"rejected"}`. The existing CAS
retry branch never received the pre-mutation stale rejection. The backend
compares the original expected stamp before delete/insert; web-entry maps stale
to400. No service behavior was changed.

The gateway now reads only the owned `events/update` JSON400 exception using
the existing config-reader stream/cancel/deadline pattern, with a2048-byte cap
and fatal UTF-8 decoding. It accepts exactly the two fields `status:'stale'`
and `sourceStamp:null|lowercase64hex`. It rechecks current context and the
original abort signal after the asynchronous body read. All other errors retain
their existing rejection/UNKNOWN treatment. The original `project()` branch
still performs at most one corrected CAS request; its source/scope and initial
expected-stamp comparison are preserved.

## Actual affected checks

`node --test tests/n44-stale-projection-http-20261031.test.mjs` passed4/4,
zero failures/skips, in19.30s:

- `n44_http400_stale_single_cas_recovery`: real first400 stale(A or null),
  then200 updated(B); exactly two calls, original source/workspace/device,
  original expected stamp first and returned stamp second. Second stale rejects
  after two requests. Credential/header/redirect/cache semantics preserved.
- `n44_stale_response_boundaries_and_context_fence`: malformed/extra fields,
  missing or invalid stamps, wrong/missing content type, invalid JSON, oversized
  and never-ending oversized streams rejected without retry. Owned reader
  cancellation verified. Context/credential validity lost during body reading
  prevents the corrected request.401/403/429 and another action remain refused.
- Transport failure,503, lost response body, and the real15s deadline while
  reading a400 body each produce one UNKNOWN attempt, with no replay. Timeout
  cancels the owned reader.
- `n44_mounted_projection_ack_and_unknown_replay_guard`: actual application
  DOM, delegated opt-in handler, runtime, gateway and source CSS over an owned
  loopback HTTP server in fresh contexts. Reused the confirmed-projection
  native/engine and served-demo helpers, including valid parent/child fixtures,
  actual account store and ownership guard. Successful due-source400→200 CAS
  takes exactly two calls, clears pending markers and avoids
  `projection_rejected`. Unchanged refresh/snapshot/render adds no requests.
  The503 control retains the due-source UNKNOWN marker and an explicit later
  projection checkpoint cannot replay it. Foreign-owner checkpoints produce no
  requests, and the stored grade remains4.

`node --check` passed for the gateway and new test. `git diff --check` passed.
The canonical isolated-local-browser helper owned and closed fresh browser
contexts/engine; the test closed its unique ephemeral loopback server and owned
connections in `finally`. No shared/live browser was used, and no global
browser lease was needed under the isolated-local phase policy.

## Delivery limits

LOCAL_READY only. No push, deploy, provider proof, live account/data/service
mutation, notification send, registration-policy change or live trial occurred.
No runtime bookkeeping, scheduler, capability, startup dependency or `sw.js`
change. Offline rollout remains pending the separate dependent
`continuous-n44-n88-offline-fix-release-20261031` finalizer after both candidates
publish. The delivered permission-grant fix `350ffc7` and existing both-phone
acceptance blockers remain intact. The independent publisher owns integration
and served-gateway verification; N44 Product acceptance remains open.
