# N44 — isolated cross-browser source qualification (2026-10-26)

Status: **SOURCE QUALIFIED ONLY; N44 OPEN.** This review does not claim a completed physical-device notification or grant new delivery authority.

## Isolation and starting evidence
- Reviewed from exact Git commit `e7b5fdc1b5fa50b38775b79272785e478e2266e8` in a new independent checkout outside the active RakeezX controller worktree.
- The original `artifacts/ops-supervisor-v4/STOP` was confirmed present, controller `paused=true`, and all active workers drained to zero before this change. STOP is retained.
- Last original N44 attempt `18a2be47-366d-4ba8-b338-a0de28c85b96` was inspected from its immutable result after STOP: `Source6` **was actually saved** (canonical parent/child revisions 2/1, Sync GREEN) before the Chrome tab returned on an unexpected *editable* Student Portal page. The Source6 current-roster impact assessment and cleanup were NOT_RUN, and Source6 must be reconciled safely before any deletion. No fourth provider send/reg9/window7/Native activation occurred; terminal readback OFF/NULL and all 47 existing provider config entries unchanged. The prior `Source4/5` fixes do not establish that Source6 is cleaned. No bypass, tab automation, provider send or login attempted by this review.
- Hosted Supabase `n44-notifications` function was read-only listed as ACTIVE version 154, `ezbr_sha256=4ff97fce2fe078ef1d9308d784cb135d6aa3dbe581e21cc1ebe7fbdecdbe019a`. No hosted configuration or source change.

## Concrete source findings and improvements
1. The current sender already uses pinned `web-push@3.6.7` for AES128GCM/VAPID. No crypto replacement needed.
2. `provider-policy.mjs` accepted only FCM. Extend its **recognized** (not automatically enabled) fixed HTTPS policy to Mozilla `updates.push.services.mozilla.com/wpush/v1|v2/<token>` and Apple `web.push.apple.com/<token>`. It continues to require each origin in explicit runtime configuration. Existing private/link-local DNS, pinned TLS, canonical key checks, no redirects and one-send fencing remain unchanged.
3. Provide one new provider-boundary test against FCM/Mozilla/Apple, cross-domain lookalikes, malformed URLs, search/fragments, insecure transport and unauthorized domains.
4. Extend the existing audited sender's fake DNS/TLS fixture to prove real encryption, decrypted payload, signed VAPID audience, connection pinning and no egress for Mozilla and Apple as well as FCM.
5. The October 17 inactive-only import/wiring assertions are outdated: a reviewed N44 Edge entry is intentionally active in source. Replace with focused checks that permit only the original `supabase/functions/n44-notifications/index.ts` private module graph and the known development bundler, while forbidding private imports in public app/SW/unreviewed scripts.
6. Improve unsupported-browser text with iPhone/iPad installed-home-screen requirement. No auto-permission prompt or subscription on load.

## Evidence and limits
- Red-before-green: FCM PASS, Mozilla v1/v2 and Apple FAIL under prior single-provider policy. After narrow policy change: **6/6 provider contract tests PASS**.
- Existing affected suites: **36/36 PASS** (including owner, consent, dedupe, expiry, revocation and delivery race checks); prior 2 failures arose from historical inactive-only test assumptions, replaced with scoped guards.
- `node tests/n44-crypto-sender.mjs`: all cases PASS, including new Mozilla/Apple audited VAPID/encryption case; `networkAttempts=0` using fake DNS/TLS transport.
- Built the actual Supabase Edge entry in memory with the existing pinned esbuild 0.28.1: FCM, Mozilla, Apple policies and audited sender present. This did not deploy or overwrite any existing historical bundle.
- `npm run build`: PASS (Vite production build isolated only).
- Three older UI tests requiring the original controller's active approved local-browser task were **NOT RUN to completion**: the original isolation gate rejected this independent STOP-paused context. The gate was retained; no Chrome user profile or synthetic 'PASS' invented.
- Real endpoint acceptance, real provider reception and **physical Windows/Android/iOS OS notification arrival remain NOT_PROVEN**. Apple requires an installed Home Screen web app on iOS 16.4+ and immediate user gesture. Edge/Windows may use WNS alternate-channel provider; exact endpoint/headers must be qualified from a real subscription before widening policy. The provider list here deliberately does not include speculative WNS patterns.
- Source policy changes are **not** the compiled deployed Edge function. Service publication, configuration opt-in and live sends require a new legitimate guarded, current authority and functional proof, not reusing spent attempts or disabling the existing safety gates.

## Next engineering actions to reach actual Product acceptance
1. Keep current STOP until ownership and isolation are settled. First reconcile the single saved Source6 on the original verified owner/account context, confirm complete roster and zero grade impact, then use a normal exact canonical cleanup with receipts only if allowed. Preserve all historical N44 receipts/budget and prior Source4/Source5 cleanup; never duplicate Source6 save, replay fourth send, delete while another browser document is editable, or assume an unknown operation succeeded.
2. Use an independent disposable browser + fake gateway to qualify the user click, registration ACK, SW push event, close/reopen and disable sequence; actual physical OS arrival requires a real provider send in a separately authorized window.
3. Inspect exact newly delivered browser `PushSubscription.endpoint` for Edge/Windows and configure its provider only after a verified Web Push contract and bounded negative endpoint tests. Do not accept any untrusted arbitrary origin.
4. Rebuild and verify the Supabase service from the reviewed current native source with the existing sole-publisher procedure; never overwrite v154 or its pins with an unreviewed stale bundle.
5. Demonstrate `registered`, one allowed send, closed-page device notification actually visible, safe click/login routing, revocation and final delivery OFF using the existing authorized test account. Then separately qualify Android and installed iOS PWA.
6. Only close N44 in Product after its accepted category/schedule/quiet/multi-device scope is genuinely proved and signed off, or explicitly split the remaining requirements into separately accepted tickets.

No user account, real student/score rows, hosted Auth, RLS, SQL, credentials, provider configuration, sender, scheduler or Production application assets were changed in this isolated work.
