> Current N44 continuation: the concrete inactive Supabase Edge/Cloudflare Auth,
> context/event and private scheduler composition is implemented in
> [ACTIVATION.md](ACTIVATION.md). It supersedes future-port/host statements below.
> No hosted activation or browser/SW wiring occurred. The historical stage and its
> evidence remain below; the portable P256 validator is qualified separately.

# Inactive Node runtime gateway

This is a source-only server composition, unimported by the app and Service Worker.
No command here installs dependencies, creates hosted tables, configures origins,
reads credentials, requests notification permission or activates a sender.
Use a maintained Node runtime supporting `node:http`, `structuredClone`,
`AbortController`, `TextDecoder` and `server.closeAllConnections`. The gateway has
no driver dependency; the private crypto composition targets the existing Node
24.19+ engine and pins dependencies solely in this directory's lockfile.
Native HTTP is behind a separately
approved TLS ingress; this module does not terminate public TLS.

## Construction and dependency preflight

`createRuntime(config, ports)` returns `{preflight, handler, runDelivery,
runCleanup, close}`. Calling it with no arguments is inert. The checked-in
`runtime-config.example.json` is disabled and supplies no origins. `preflight`
returns exactly `{status:'disabled'|'configured', missing:[fixed dependency codes]}`.
`configured` means supplied capabilities/configuration, **not an audit, live
readiness, Product acceptance or deployment**. Every missing dependency is in one
result; there is no default connection, no in-memory repository and no fallback
Auth, protector or sender. To prevent partially configured live behavior, any
missing requirement disables HTTP and private work together, including an absent
sender or disabled delivery flag. Closing also disables every entry.

Required server-owned ports (never construct these from request JSON):

| Port | Exact responsibility |
| --- | --- |
| `acquire()` | Exclusive pg-compatible leased connection `{query(text,values),release(error?)}` to the exact already-applied schema; bounded pool acquisition/connection (at most 4s), per-query/transport timeout (at most 8s), finite pool and disposal on unsafe release. No SQL values/DETAIL logging. Repository transaction-local lock/statement timeouts and commit rules remain unchanged. |
| `verifySession(authorization,{signal})` | Independently contact trusted current-session authority, enforce expiry/revocation and derive `{ownerId,sessionId,sessionRevision,expiresAt}`. An opaque bearer alone, decoded JWT, editable metadata, browser verified flag or cached principal is insufficient. Honor signal and bounded transport; no bearer logging. |
| `protect(subscription,{signal})` | Concrete OpenSSL curve validation, independent endpoint/binding HMAC keys and authenticated versioned envelope are supplied by `subscription-protector.mjs`. Real server key custody/configuration remains a deployment input; abort denies. |
| `ingress.take({kind,key,limit,windowMs,signal})` | Atomic bounded distributed limiter returning exactly `true` to admit. Peer: 60/min/direct socket peer; verified owner: 30/min. Persist limits across processes; avoid unbounded key cardinality/retention and body logging. Exceptions/timeouts deny. |
| `authoritative.serializedWriters === true` | Explicit adopter assertion: every context/session/logout/switch/consent/preference/event writer participates in repository owner-clock serialization. This flag is a wiring requirement, never independent proof of adoption. |
| `authoritative.recompute(tx,registration,eventId,now,preferences)` | Pure synchronous authoritative minimal-event derivation inside the same SQL lock; use real current owned parent/child deletion dependencies, lifecycle, dates, stages and IANA timezone. Return minimal payload or null. No client cache or async resolver. |
| `schedule.batch({limit:100,signal})` | Private bounded authoritative candidate source, returns array of `{ownerId,registrationId,payload}`. Candidates confer no send authority: delivery re-derives all eligibility under lock. |
| `schedule.owners({limit:100,signal})` | Private bounded cleanup owner source. Runtime rejects arrays over 100; source must paginate durably so all owners are visited at least hourly under the separately approved retention policy. |
| `sender.send(permit,{signal,deadlineMs:10000})` | Audited existing Web Push encryption/VAPID and exact provider origin/path/curve policy, connection-time DNS/egress protection, no redirects, TTL bounded by immutable expiry and reviewed generic copy. Must stop transport on abort and never retry internally; certified definitive non-acceptance is the only retryable result. Supplied port is not evidence of audit. |
| `close()` | Close only owned pool/Auth/limiter/scheduler/crypto resources, honor a 5s shutdown deadline; no shared pool disposal or unknown-process termination. |

Both configured origin arrays must be nonempty exact HTTPS origins (no paths,
credentials, wildcard or inferred origin). Supplying origins is a separate real
configuration operation. Do not use the synthetic example.test fixtures live.
`requestDeadlineMs` is required, integer 20..15000. No environment is read.

The complete injectable entry is:

```js
import { createRuntime, listenRuntime } from './runtime-gateway.mjs';
const runtime = createRuntime(reviewedConfig, serverOwnedPorts);
// Review the fixed-code preflight before binding. Never print private ports/config.
if (runtime.preflight.status !== 'configured') {
  await runtime.close(); // publish only the fixed-code preflight to operator tooling
} else {
  const owned = await listenRuntime(runtime, { host: approvedBindHost, port: approvedPort });
  // Trusted platform timer/job wiring ONLY, not routes:
  // await runtime.runDelivery(); await runtime.runCleanup();
  // On shutdown: await owned.close(); report a cleanup rejection truthfully.
}
```

`listenRuntime` requires explicit bind host/port; port 0 is for owned loopback
tests. Bind/listen failure closes runtime. Listener owns only its own server;
`close()` closes its sockets, drains active operations (20s bound), and calls the
injected resource closer (5s bound, also attempted after a drain failure).
Runtime close is idempotent. Scheduler source reads have a 5s bound and lifetime
abort; overlap returns `busy`. No autonomous interval, public scheduler API,
public owner argument, credentials, service provisioning or publisher side effect
exists. Private entry reports `completed,count` for attempted boundary calls,
not delivered-device receipts. Sender has a 10s outer deadline; any unknown or
late outcome remains uncertain. Injected operations must also honor cancellation;
JavaScript cannot force an external transport/driver to comply.

## HTTP contract

Only exact POST `/n44/push/register` and POST `/n44/push/revoke` exist. Queries,
suffixes, GET, OPTIONS, delivery/cleanup/admin paths return 404 `rejected`.
No CORS headers or preflight authorization; same-origin application ingress is
required. All responses are JSON `{"status":"fixed_code"}`, no-store, nosniff,
connection-close. No owner, subscription, receipt, bearer, exception or SQL detail
is reflected. The module emits no logs. Platform/access/error tracing must also
suppress bodies, bind values, authorization, endpoints and exception content.

Ingress order is route, duplicate header rejection, exact Origin (required;
`Sec-Fetch-Site: cross-site` denies), exact `Content-Type: application/json`, no
content encoding, declared length <=12288, peer limiter, bearer syntax/current
session verification, owner limiter, bounded UTF-8 body, strict JSON, existing
registration boundary. Only the socket peer is trusted; `X-Forwarded-For` has no
authority. Public proxy must enforce its own per-client flood and slow-reader
limits before forwarding, reject ambiguous framing, terminate TLS and enforce
reviewed hosts. Runtime limits header bytes to 8192, headers to 32, one request
per socket, header timeout 5s, request/socket timeout 15s. Node's framing parser
errors produce fixed 400 `rejected` and close; no parser exception is logged.

Strict JSON rejects invalid UTF-8, trailing tokens, malformed numbers/strings,
depth over 12 and duplicate decoded keys at every nesting level (including
escaped aliases). Existing boundary exact-field validation is unchanged:

```json
{
  "registrationId": "client-generated-original-v4-uuid",
  "workspaceId": "current-workspace",
  "deviceId": "current-device",
  "sessionRevision": "current-server-session-revision",
  "consent": { "revision": "current-consent-revision", "push": true },
  "subscription": { "endpoint": "approved-provider-https-endpoint", "keys": { "p256dh": "canonical-unpadded-base64url", "auth": "canonical-unpadded-base64url" } }
}
```

Revoke body contains **only** `registrationId,workspaceId,deviceId`, using original
values and original independently authenticated session. Body owner/metadata
fields reject. Auth is snapshotted from the trusted server verifier for this
request and expiry is checked again against effective DB time. Current context,
consent and delivery state come from actual repository snapshots after owner lock.

| Failure | HTTP/status |
| --- | --- |
| Disabled/incomplete construction or closed runtime | 503 `disabled` |
| Wrong route/method | 404 `rejected` |
| Duplicate header, content type/encoding/size/JSON/body validation | 400 `rejected` |
| Missing/foreign origin or cross-site | 403 `rejected` |
| Missing/malformed bearer or unverified/expired current session | 401 `rejected` |
| Boundary ownership/context/consent/binding denial | 400 `rejected` |
| Peer/owner limiter or existing device/mutation budget | 429 `limited` |
| Port exception, commit ambiguity/failure, request deadline | 503 `unavailable` |
| Acknowledged registration/revoke | 200 `registered` / `revoked` |

The monotonic request deadline starts at handler entry. Auth/limiter/protector
timeouts, disconnection and elapsed deadlines fail before registration mutation;
late Auth/protect completion cannot start SQL. A queued repository callback
checks deadline again after obtaining its actual snapshot. A timeout/disconnect
**after** work enters writeback/COMMIT cannot safely prove rollback: response is
unavailable, never success, and the original UUID must reconcile on retry. Do not
cancel/retry an ambiguous commit as though it did not happen. No delivery result
is sent publicly. Existing committed-permit, original-registration, terminal
receipt and uncertain/crash fences are unchanged.

## Actual client and authoritative mapping still required before activation

`src/lib/notification-push-client.js` expects boolean
`gateway.register(snapshot,subscription)` and `gateway.remove(originalSnapshot,
originalSubscription)`, with original cleanup retained across auth/context races;
`authorizeEvent` is a separate click-time ownership check. A future approved
browser adapter must durably allocate the original UUID **before** register HTTP,
retain it through ambiguous responses/reloads, supply the server-issued session
and consent revisions (do not equate `authRevision` by assumption), map only 200
registered/revoked to true, and never revoke under a newly selected identity.
No browser adapter or permission prompt is activated by this server artifact.

The actual `notification-events.js` `currentNotificationContext` checks the
mounted claimed account DB, cloud session and `runtimeSyncOwnershipGuard`;
`currentNotificationEvents` reads mounted local teaching/term/year/section/subject/
session/item/subitem rows. `notification-state.js` stores timing/categories in
localStorage. These are **browser-local contracts**, not authoritative server
tables or a server consent/session writer. No existing server Push context mapper
or cooperating canonical writer was found in the affected sources. Importing
them into a server to read a fake/local cached store would violate freshness and
ownership. Consequently this composition requires the authoritative port and
fails preflight without it; it supplies no fabricated production mapper.

Concrete remaining operations, all **NOT_RUN** and outside this source-only card:

1. Separately approve and implement the current-session server verifier and real
   authoritative session/context/consent/preference/event mapping; adopt owner-lock
   serialization in *all* relevant writers. Verify actual app ownership-guard entry,
   negative owner and deletion dependencies. `repository.writeContexts` is the
   existing trusted hook, not a public teacher write API.
2. Separately authorize exact hosted migration/role/service wiring and read back
   applied identities before enabling runtime. Existing SQL proposal/qualification
   does not authorize hosted application. Generic frontend publisher cannot do this.
3. Bind the now-implemented protector and `web-push` sender using
   `createPrivateRuntime` from `private-runtime.mjs`; supply real key custody and
   explicitly reviewed origins only under a later activation. Follow the exact
   [key/configuration and existing-host plan](CRYPTO_SENDER.md). No placeholder
   protector/sender implementation remains; all checked-in configuration is disabled.
4. Supply distributed ingress limits, private paginated schedule/cleanup sources,
   reviewed TLS bind/proxy/log policy, shutdown integration, retention/backup/cost
   decisions and kill switch. Then separately qualify app/SW/client original-UUID
   storage and real device lifecycle under the approved pilot authority.

Only the original publisher may integrate this inactive source. N44 remains open;
local HTTP/SQL/fake sender evidence does not establish real Push delivery.
