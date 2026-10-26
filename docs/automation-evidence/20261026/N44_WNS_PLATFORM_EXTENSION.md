# N44 — Windows Edge WNS WebPush source qualification, 2026-10-26

Source base: PR #6 HEAD 0c7148c3e408d12bfda5f8f21127cd5e6cb15a42. AI-authored by independent reviewer. Changes remain isolated / not merged or service-deployed. Never interpret these tests as device delivery.

## Material issue
The existing sender recognized FCM, Mozilla, and Apple only. Edge on Windows may return an opaque `https://wns2-*.notify.windows.com/?token=...` subscription. It requires `X-WNS-Type: wns/raw`, returns HTTP 200 on accepted delivery, and must receive the full opaque query in the HTTPS request path. Previous registration validation, provider policy and sender dropped this route; the previous sender also omitted query and treated HTTP 200 as uncertain.

## Bounded code changes
- `shared.mjs`: vendor config marker `https://*.notify.windows.com` is a symbolic configuration value, NOT an accepted network URL. Actual hostname must match `wns2-[a-z0-9-]{1,70}.notify.windows.com` with exact HTTPS, canonical `/` path, opaque query, strict size, no credentials/fragment/port and no encoded control bytes.
- `registration.mjs`: WNS subscriptions admitted only when the marker is explicitly in the trusted provider origins; other hosts remain exact-authority.
- `provider-policy.mjs`: same provider admission before P-256 public-key validation.
- `audited-sender.mjs`: on confirmed WNS only, preserve path+query, include required `X-WNS-Type: wns/raw` and `application/octet-stream`, and recognize HTTP 200 as accepted. Other providers still require 201/202.
- `tests/fixtures/n44-crypto-sender/fixture.mjs`: update synthetic transport assertions for path query and required WNS header; normal existing fixture remains unchanged.
- No general wildcard origin allowance, redirects, retries, token exports, DB/Auth/RLS changes, host deployment or permission prompts.

## Test evidence
- `node --test tests/n44-wns-webpush-20261026.test.mjs`: PASS 3/3, synthetic encrypted signed Web Push over mocked DNS/TLS, no network. Includes WNS HTTP200, FCM HTTP200 rejection, blocked spoofed hosts, malformed URLs, encoded-control characters, wrong schemes, invalid port, forbidden path and no permission.
- `node --test` across eight selected N44 suites: PASS 40/40.
- `node tests/n44-crypto-sender.mjs`: PASS all 19 cases; `networkAttempts=0`.
- `npm run build`: PASS Vite production build, isolated only.
- Browser activation probe `node tests/n44-real-browser-support-20261026.mjs`: Chromium/Firefox/WebKit/**actual Microsoft Edge** all reported `navigator.userActivation.isActive=true` inside real click and Notification/PushManager/ServiceWorker exposed on localhost. This proves API presence, NOT real Push delivery.
- Localhost Service Worker check: Chromium registration ready and no missing assets. Firefox session did not complete in a bounded practical window; owned test process was stopped. NO Firefox service-worker PASS claimed; no browser-profile data touched.
- A separate disposable Playwright Edge localhost PushSubscription attempt used a temporary generated VAPID key and a real click and returned `AbortError`. It revealed NO endpoint and caused NO send or account operation; headless provider availability is unproved. Do NOT call this a functioning or failed live Rakeez subscription; physical Edge qualification remains necessary.

## Open acceptance
- The original Source6 from the test account has a confirmed canonical save but incomplete same-owner roster-impact/canonical cleanup. Never delete without direct owner/ancestry/zero-grade proof. No repeated Save/registration/window/send or resetting old markers.
- Physical browser PushSubscription endpoints and WNS header acceptance require a real approved test. Do not assume every Edge build uses WNS or every WNS endpoint follows this narrow observed pattern. Unexpected endpoints remain blocked until separately documented and tested.
- Hosted Supabase `n44-notifications` v154 is not rebuilt/deployed with these changes. Runtime `N44_PROVIDER_ORIGINS_JSON` must be reviewed/opted in separately before WNS can work; do not alter existing 47 provider keys casually.
- No `registered` plus delivered closed-page OS-visible receipt, nor Android physical / iPhone Home Screen physical proof. N44 remains OPEN. No changes to Production, SQL, Auth, user data, OS permissions or provider sends.

## References
- Microsoft Edge PWA Web Push: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push
- WNS request headers: https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/push-request-response-headers
- WNS endpoint family (CloudServiceDNS): https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config
