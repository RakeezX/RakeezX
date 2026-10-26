# N44 — actual browser provider-to-Rakeez-ServiceWorker verification (2026-10-26)

**Status:** two independent direct Web Push deliveries PASS on Windows browsers, plus the actual Rakeez audited sender PASS on Edge/WNS; Chrome audited sender remains UNCONFIRMED and Firefox test subscription FAILED. **N44 Product remains OPEN**. PR #6 review-only. This does not constitute production account registration or approval to activate a sender.

## Test architecture and scope
- Locally served the **actual current Rakeez `sw.js`** from the PR worktree over secure-context loopback.
- Used real installed Google Chrome and Microsoft Edge in separate **ephemeral headed browser profiles**. No reuse of an owner's Chrome profile, Rakeez account/session, Supabase function, production push configuration, school/student data, or existing test Source6.
- Generated temporary VAPID keys and subscriptions from a real user gesture in each browser, verified the endpoint using the Rakeez exact-provider checks, and set a synthetic short-lived `n44-consent-bind` on the local worker through its real MessageChannel route.
- Closed the original page **before** making a single encrypted provider request. Reopened the local application origin and read actual `getNotifications()` and the worker's `n44-device-outcome`. Finally unsubscribed and cleared local consent/notifications. The provider accepted the push and the worker accepted display; nobody visually inspected the OS notification shade or the mobile lock screen.
- No token, raw endpoint path, private signing key, credentials, PII, or student data should be copied into tickets. All public evidence logs must redact opaque subscription tokens.

## Actual positive evidence
| Platform | Real provider ACK | Rakeez original worker | After original tab closed | Cleanup |
|---|---|---|---|---|
| Microsoft Edge, Windows | Microsoft WNS HTTP 201, `X-WNS-NotificationStatus=received` | `display-accepted` | `getNotifications=1`, `present=true` | unsubscribed true; consent cleared true |
| Google Chrome, Windows | Google FCM HTTP 201 | `display-accepted` | `getNotifications=1`, `present=true` | unsubscribed true; consent cleared true |

Both used the reviewed standard `web-push@3.6.7` VAPID/AES128GCM sender and a real external push service, but the **temporary test sender is separate from N44 Supabase authenticated backend**, deliberately isolating browser/provider delivery.

## Firefox and Safari limitation
- Playwright Firefox (headed on Windows) installed the actual Rakeez worker, but `PushManager.subscribe` returned `AbortError`. No provider request. This does not attribute fault to Rakeez; native Firefox production installation and provider transport must be verified separately.
- Playwright Chromium headless returned notification permission `denied` despite grant; a temporary **headed persistent** Edge browser permitted notifications. The owned temporary browser profiles were closed and deleted.
- WebKit engine and native-gesture mocked tests passed earlier, but no **physical** Mac Safari / iOS Home Screen PWA / Android hardware test or visual OS receipt is claimed.

## Actual Rakeez audited sender trials
- **Edge/WNS: PASS.** Used the actual `createSubscriptionProtector`, `issueCommittedPermit` and `createAuditedSender`, with ephemeral signing/crypto keys and one real WNS provider send. The capability/commit proof was **synthetic in the disposable test**; no real authenticated PostgreSQL transaction or production owner authorization was exercised. The sender returned `accepted`; the original Rakeez worker recorded `display-accepted`, `present=true`, and one notification after the page closed. The temporary subscription was revoked and consent cleared. This proves the source sender + source worker for Windows Edge, but not the hosted Supabase pipeline.
- **Chrome/FCM: NOT YET STABLE.** In one bounded audited-sender trial the provider returned `accepted`, but the worker did not show a received/display outcome during a short 7-second observation. A subsequent changed observation trial did **not** reach the sender: the temporary Chrome subscription timed out even before any provider request (20-second observation configured but not entered). The latter made 0 provider sends. Neither trial justifies a source code change without more attributed evidence, nor a Product-ready claim. The earlier **direct sender** Chrome/FCM run *did* deliver through the original worker, so do not conflate this with proof that Chrome push is unsupported.
- **Firefox/Playwright: NOT RUN TO DELIVERY.** Headed Windows Firefox started the original worker but `PushManager.subscribe` failed with `AbortError`, before any send; a source/browser/provider cause has not been established. This remains a test limitation, not a proven product failure.
- Every provider experiment used a new temporary browser-owned subscription and at most one send; none reused historical N44 live budgets or mutated a teacher account. All test output explicitly redacts opaque endpoint tokens. Manual external-send script requires `N44_RUN_EXTERNAL_PUSH=YES`; only the operator should set this.

## Important normalisation finding
- Native `PushSubscription.toJSON()` includes `expirationTime`. An initial standalone probe passed that *raw* object to `trustedSubscription` and was rejected. That is a **test-harness shape error**, not an N44 Product failure: the actual `notification-push-gateway.js` already constructs `{endpoint: wire.endpoint, keys: wire.keys}` before registration. With the canonical actual form, real WNS delivery passed. **Do not loosen the registration input contract** for this.

## Opt-in diagnostic script
`tests/n44-original-sw-real-webpush-20261026.mjs` is **not an automatic CI test** and requires `N44_RUN_EXTERNAL_PUSH=YES`; without it the script emits explicit SKIPPED. An operator can set `N44_TEST_BROWSER=edge|chrome|firefox` for a single separate transient profile, one provider send maximum, with local consent revocation and unsubscribe. Do not run this against any production browser profile or teacher account.

## Remaining requirements for N44 acceptance
1. Original Source6: read-only correlation found a single saved parent rev2 and one child rev1 on the exact save interval; owner roster=6, score rows=0, completion rows=0. Must still perform **original-context exact reconciliation and canonical app cleanup**, not direct SQL delete or time-only inference.
2. Supabase `n44-notifications` remains **ACTIVE v154** with old provider policy. PR code not merged into main nor installed into the service; Push delivery generally OFF, registration has no active owner device in latest database aggregate. A successful local Push cannot upgrade this silently.
3. Need `registered` ACK with actual owner/device consent, one authorized send through Supabase, verified OS-visible notification with Rakeez app closed, secure navigation, revocation, no student/score writes, and final send OFF.
4. Complete/record actual device/platform evidence for Windows Chrome/Edge/Firefox, Android supported browsers, macOS Safari, and iOS/iPadOS installed Home Screen PWA. Distinguish support of the Web Push standard from tested N44 Product acceptance.
5. Preserve all historical send counters, previous unknown outcomes, protections, and sole-publisher release path. Do not turn PR into Product CLOSED on test-only evidence.

**No Rakeez Production, hosted function, schema, user account, student record or cloud sender was modified in these external-provider tests.**
