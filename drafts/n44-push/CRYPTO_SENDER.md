> Current N44 continuation: the concrete inactive Supabase Edge/Cloudflare Auth,
> context/event and private scheduler composition is implemented in
> [ACTIVATION.md](ACTIVATION.md). It supersedes future-port/host statements below.
> No hosted activation or browser/SW wiring occurred. The historical stage and its
> evidence remain below; the portable P256 validator is qualified separately.

# Private subscription protection and Web Push transport â€” inactive

The two previously missing local ports are implemented. `private-runtime.mjs`
provides the exact next composition entry; it neither listens nor schedules.
The checked-in `runtime-config.example.json` keeps both runtime flags false and
both origin lists empty. No app, SW, hosted function or publisher imports these
modules. This stage authorizes no real configuration, key provisioning or send.

## Dependencies and reviewed protocol

Inventory found no existing `web-push`, `http_ece` or `ipaddr.js` dependency in
the root manifest/lock or installed root package names. Only this private package
now pins **web-push 3.6.7** and **ipaddr.js 2.5.0**; its npm v3 lock pins all
transitives and integrity hashes (including **http_ece 1.2.0**). Installed with
`npm install --ignore-scripts --no-fund --no-audit` here, never at root/global.
`node_modules/` is covered by the existing Git ignore. Reproduce with
`npm --prefix drafts/n44-push ci --ignore-scripts --no-fund --no-audit`.
Observed engine: existing **Node v24.19.0**. No new runtime/hosting was installed.

Reviewed current primary sources on 18 October 2026, changelogs first:

- [Web Push releases](https://github.com/web-push-libs/web-push/releases), then
  [official 3.6.7 manifest](https://raw.githubusercontent.com/web-push-libs/web-push/v3.6.7/package.json),
  [API](https://github.com/web-push-libs/web-push/tree/v3.6.7#api-reference) and
  installed request/encryption/VAPID source. The release page displayed 3.6.5;
  the official 3.6.7 tag and registry manifest agree with the installed package.
  `generateRequestDetails` supplies RFC encryption and ES256 VAPID without network
  access. We do not call `sendNotification`, whose default transport does not
  provide this package's connection pinning/absolute deadline policy.
- [Supabase changelog](https://supabase.com/changelog) (14 October telemetry;
  12 October forthcoming TLS cipher removal), followed by
  [Edge limits](https://supabase.com/docs/guides/functions/limits).
  This code is Node-specific; Edge/Deno compatibility or a Supabase service
  deployment is not established. No Supabase SDK, schema, grants or Auth changed.
- [Chromium's official endpoint transition](https://chromium.googlesource.com/chromium/src/+/40644b8cf2b03be542976e7d1192c653e389c14e%5E%21/)
  and [Google Web Push server documentation](https://web.dev/articles/codelab-notifications-push-server)
  establish exact `https://fcm.googleapis.com/wp/<token>` and earlier
  `/fcm/send/<token>` paths. The policy recognizes only those production paths,
  rejects staging, queries, percent escapes and arbitrary token punctuation, and
  still requires explicit server origin approval. Other providers remain denied;
  no wildcard, guessed Mozilla/Apple host or `.test` promotion is supplied.
- [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html),
  [HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html),
  [ipaddr source](https://github.com/whitequark/ipaddr.js/blob/main/lib/ipaddr.js),
  [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030.html), and
  [Azure's special host IP](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16).

These are established library/OpenSSL primitives and a scoped source review,
not a claim that RAKEEZ commissioned an independent cryptographic audit.
`npm audit --omit=dev --ignore-scripts --json` reported zero known advisories for
the 18 installed packages on this run; that is not a security certification.

## Envelope, binding and key rotation

`createSubscriptionProtector(material)` returns private `{protect,open,close}`.
Protect validates canonical subscription shape and actual uncompressed P-256
curve membership with OpenSSL `ECDH.convertKey`. It uses Node AES-256-GCM,
a fresh 96-bit random nonce and 128-bit tag. No AES, ECDH, HKDF or signature
algorithm is implemented in Product code. Stored canonical JSON contains
`v:1,kid,hkid,vapidKeyId,fingerprint,bindingFingerprint,iv,ciphertext,tag`.
The namespace, version, three IDs and both fingerprints are authenticated AAD.
Unknown version/key ID, bad tag, invalid encoding/point, fingerprint mismatch,
extra/duplicate fields and abort all deny with one private fixed exception.

Endpoint and binding use **independent 256-bit server HMAC-SHA256 keys**, also
independent of every sealing key. Domain separators distinguish their roles.
Endpoint HMAC covers the exact canonical endpoint for the global claim.
Binding HMAC covers the VAPID key ID, endpoint, p256dh and auth tuple, rejecting
same-endpoint key replacement under an original registration UUID. Raw secrets
never enter a fingerprint or diagnostic. Both hashes are recomputed after
authenticated decryption and compared with the committed row's fingerprints.

Rings have at most eight named keys. New sealing writes use `activeKeyId`; old
read keys remain addressable by their authenticated `kid`. Rotating a seal key
does not change either fingerprint. Do not overwrite an existing key ID with
different bytes. Unknown/retired keys fail closed, never try all keys. There is
no online database re-encryption operation in this authority or implementation.

The VAPID key ID is authenticated per subscription. The sender looks up that
exact signing pair, validates its curve/private-public relationship, and never
substitutes the newest key. Rotation retains old signers for old subscriptions;
new registrations use the new `activeVapidKeyId` and its matching published
`applicationServerKey`. A changed ID changes binding HMAC and rejects replay
under the old UUID. Re-subscribing requires original cleanup and a new explicit
gesture/consent, not silent renewal. Unknown/retired signing IDs cause no DNS or
request. Sender closure aborts its owned requests and drops its signing ring.

Keep `fingerprintKeyId` and both HMAC keys stable while any endpoint claims are
live. Multiple write epochs would defeat global endpoint uniqueness. HMAC
rotation therefore requires disabling ingress/delivery, draining/revoking all
old registrations/claims under separately authorized service controls, verifying
that disposition, then changing the paired epoch and requiring new opt-in.
Old paired read IDs are supported, but concurrent old/new write epochs are not
an activation option. Do not invent a live rehash migration or bypass immutable
registration guards here.

Existing executable revoke/dead/expiry/context cleanup immediately nulls sealed
data and both hashes and releases only the original endpoint claim. Registration
expiry is capped by session expiry and 30 days; tombstone/receipt cleanup uses
the existing additional one-day retention. Cleanup deletes expired jobs before
registration rows in the existing SQL repository's writeback order. A real
private paginated scheduler must visit every owner at least hourly; no autonomous
sweep was started. Keep old seal/signing keys until no active rows need them;
backup retention/cryptographic erasure needs an approved finite backup policy.
Source cannot certify deletion from hosted storage/backups. Close zeros copied
symmetric key buffers; JS/OpenSSL strings/internal allocations are not a promise
of complete memory erasure. Host must disable core dumps, key logs and secret
tracing; ECE_KEYLOG=1 and Node TLS-keylog modes explicitly deny sender creation.

## Committed sender and connection policy

After `repository.atomic` resolves its committed `sending` reservation, delivery
immediately issues one frozen in-process permit carrying sealed data, immutable
payload and both row fingerprints. Only that object can be consumed once by the
concrete sender. JSON copies, structural lookalikes and replays never decrypt.
`issueCommittedPermit` is a private trusted-server function, not an HTTP or
cryptographically signed client capability. Existing transaction/receipt fencing
still owns cross-process/crash idempotency; the WeakSet is an additional local
capability guard. Commit failure creates no issued permit and no crypto/network
call. Never reconstruct a permit from a queued request or persisted `sending`.

After opening, sender revalidates origin/path, point, auth length and immutable
payload. Library AES128GCM encrypts exactly `{id,kind,expiresAt,actionPath}` and
adds per-request VAPID; no globals, GCM API key, proxy or sender retry is used.
This is the existing privacy-minimal app consumer contract: no names, lesson
titles, grades, display body/title, subscription material or bearer. Actual
consumer action handling is exercised with the decrypted fixture, current
authorization denial and expiry. Future SW must use static generic lock-screen
copy and reauthorize navigation; current SW has no Push handler and remains off.
TTL is rounded down from immutable expiry after DNS and again after encryption.
Receiver expiry remains mandatory because transit/OS queueing cannot be recalled.

Resolve all addresses once, reject empty/over-16/mixed/nonpublic answers,
ipaddr reserved ranges, IPv4-mapped IPv6, scoped/transition/unallocated IPv6 and
metadata/platform IPs including 169.254.169.254 and 168.63.129.16. Pin one
validated answer in the actual `https.request` lookup callback, with no second
resolution/fallback. Original hostname/SNI, normal hostname/certificate checking,
`rejectUnauthorized:true`, TLS 1.2 minimum, no shared agent, no redirects and
remote-address validation are retained. The checked options execute in tests;
actual DNS, TLS certificates and real provider acceptance remain unverified.

The absolute monotonic deadline is at most ten seconds, also bounded by expiry;
it includes DNS, crypto and request. Abort/close destroys owned requests;
uncancellable system DNS may finish later but cannot dispatch a request. There
is exactly one request per permit, no internal replay and no response-body/log
retention. Response headers are capped at 8192 bytes; Location is ignored.

| Observed outcome | Sender result / existing boundary behavior |
| --- | --- |
| 201 / 202 service acceptance headers | `accepted` / `sent` (not device receipt) |
| 404 / 410 | same numeric result / `dead`, erase original secrets |
| 429 definitive rate rejection | `not_accepted_retryable` / bounded durable backoff, eligibility checked again |
| Timeout, abort, DNS/policy/crypto failure, error, redirect, other status or late completion | `uncertain`, no internal/durable automatic resend |

## Exact existing-host binding inputs

Import `createPrivateRuntime` from `private-runtime.mjs` on an already approved
server-owned Node host; pass the existing disabled config, trusted gateway ports
and **injected material**, never a request body or discovered `.env`:

```js
const runtime = createPrivateRuntime(reviewedRuntimeConfig, existingHostPorts, {
  activeKeyId, sealingKeys, fingerprintKeyId, endpointHmacKeys, bindingHmacKeys,
  activeVapidKeyId, vapidKeys,
});
// Stop here unless runtime.preflight.status === 'configured' AND the separate
// service/current-context/ingress/scheduler/device activation gates are proven.
// Existing approved host lifecycle alone binds listenRuntime and private timers.
```

`sealingKeys`, `endpointHmacKeys` and `bindingHmacKeys` are `Map<id,Buffer(32)>`.
`vapidKeys` is `Map<id,{subject,publicKey,privateKey}>`, unpadded canonical
base64url P-256 point/scalar. Origin approval comes only from runtime config;
material cannot widen it. `createPrivatePushPorts` is also available for exact
private port composition and closes owned keys if sender construction fails.
Defaults construct disabled ports without keys. Composition validates active
VAPID ID lookup and preserves gateway dependency preflight/owned resource close.

Suggested named server inputs, to be supplied by the approved existing secret
binding layer only: `N44_SEAL_ACTIVE_KEY_ID`, `N44_SEAL_KEY_RING`,
`N44_FINGERPRINT_KEY_ID`, `N44_ENDPOINT_HMAC_KEY_RING`,
`N44_BINDING_HMAC_KEY_RING`, `N44_VAPID_ACTIVE_KEY_ID`, `N44_VAPID_KEY_RING`,
and nonsecret `N44_PROVIDER_ORIGINS` / `N44_APPLICATION_ORIGINS`. This module
does not read, generate, export or log any of them. No real values were located.

The existing local PC's Node engine is a qualified synthetic execution host,
not an established public production service. Current static Cloudflare hosting
does not establish a Node listener, nor does existing Supabase establish this
native HTTPS/DNS runtime. No new Node hosting, subscription, account or paid API
is assumed. Before live use, the original delivery path must name and authorize
an **existing** suitable host/ingress, bind the exact schema/applied identity and
least-privilege connection, independent current-session verifier, distributed
ingress limiter, authoritative all-writer context/event mapping and private
paginated delivery/cleanup schedule. Those are actual environment/service/data
bindings; protector/sender implementation is no longer a future supplied port.
If existing infrastructure cannot provide this runtime, report that actual
hosting boundary instead of pretending a frontend deployment provisions it.

App gesture/registration receipt/owner-guard integration, current event click
authorization, offline-shell/SW wiring, reviewed static display copy, provider
coverage and real device/service/Production verification retain their separate
authority. No frontend startup dependency was added, so this card does not change
the existing offline shell. Only the original controller/publisher may integrate
the inactive candidate; this worker neither pushes nor deploys nor closes N44.
