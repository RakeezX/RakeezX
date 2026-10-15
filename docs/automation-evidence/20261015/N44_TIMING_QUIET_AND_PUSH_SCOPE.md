# N44 — timing, quiet center, local category preferences

Task: `continuous-n44-timing-quiet-preferences-20261015`  
Run: `178cc117-c6e5-4dfc-9178-5f4f1427d16b`  
Base: `6d553bfd562bd52199b2c839187fbfa94bc905b3` (HEAD and observed `git ls-remote origin refs/heads/main` matched before implementation).

## Bounded result

Owned eligible lessons appear from exactly start minus 15 minutes until end (exclusive). Owned eligible subitems have one stable identity per due date and local reminder day, at offsets 3, 2, 1 and 0. Each daily stage expires at the next local midnight. Observation replaces events with today's eligible stages; it never queues missed days. Re-rendering deduplicates IDs; existing bounded private read/dismiss storage survives reload and backward clock movement. The existing startDate, teaching/term, archive, holiday, cancellation and ownership guards remain.

Empty center contains only “لا توجد إشعارات حاليًا” and “كل شيء تمام حتى الآن”; populated cards retain read/dismiss/actions and notes. Existing source CSS handles small screens and focus return.

Settings exposes two default-on in-app category switches. Only lesson/due flags persist under an owner/workspace/device key, separately from private read/dismiss records. Settings revalidates the mounted verified owner and rendered scope at action time. Storage failure is reported without claiming a saved preference. Optional filtering bypasses critical events and unknown categories. Existing mandatory offline lease/data-protection banners remain independent and visible; no invented protection event was added.

Category functions live in the existing `notification-state.js`, already in the offline shell. No startup module or shell path was added.

## Affected verification

- `node --test tests/n44-reminder-timing.test.mjs tests/n44-preferences.test.mjs`: 9/9 PASS. Reuses actual synthetic account/store/ownership fixture and prior N44 regression cases with updated four-event expectations. Covers exact 15-minute/end boundaries, four day IDs, daily expiry/no catchup, forward/backward days, reload, owner/workspace/device isolation, read/dismiss, deleted child/parent deep links, storage errors, critical bypass and unchanged outbox.
- `N44_RUN_ID=178cc117-c6e5-4dfc-9178-5f4f1427d16b node tests/n44-quiet-ui.mjs`: PASS. Actual unbundled app over task-owned loopback HTTP, disposable Chromium account context, no live transport. Shared browser lease acquired/released because this includes real Service Worker/offline checks. Actual DOM/handlers/source CSS at 320/390/1280; settings category suppression/reload; exact empty copy; focus restoration; negative ownership guard; stale deleted child navigation; A/B isolation/logout; unchanged outbox; mandatory limited-lease banner; actual offline reload with owner/database/receipt checked together in the reloaded document. Detail: `tests/n44-quiet-ui.json`.
- Initial harness failures preserved: layout recorder property was still named `screenshots` (TypeError at line 42); next run retained old unread count 1 while new expected count is 2 (assertion at line 115). Corrected recorder name, four-event expectations and exact stale-child selector. Neither was a service/tool rejection or live proof phase. Both runs released their owned browser lease in finally; final run passed.
- Browser and HTTP server closed by owned finally cleanup. No live subscriptions, account mutations, schema, sender, push permission prompt, scheduling, push send, push/deploy or queue edits.
- Syntax checks and `git diff --check` run before candidate commit. No broad Vite build needed; publisher owns deterministic build and pinned-tail parity/served Production checks.

## App-closed Push: feasible future work, not activated

Current `sw.js` provides offline caching but has no `push`, `notificationclick` or `showNotification` handler. Existing Supabase `support-notification-worker` is N34-specific, not a teacher Web Push sender. These observations are source inspection, not service deployment/readback certification.

Standard Web Push is feasible: obtain an explicit user-gesture opt-in on supported HTTPS browsers; create a per-device PushSubscription on the active Service Worker; deliver from a server using its endpoint/encryption keys, then handle `push` with `showNotification` and owner-safe `notificationclick`. The endpoint is sensitive and must remain private. This can receive while the web app is not loaded, but browser/OS/network restrictions preclude an exact-time guarantee. See [Mozilla Push API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

Proposed RAKEEZ architecture (inference, not implemented): use Supabase for owner-bound subscription storage with separately approved RLS/schema, a server-only VAPID private key and standard Web Push sender in an Edge Function, plus a scheduler that revalidates current ownership, category consent, event eligibility, timezone, cancellation and expiry before delivery. Supabase documents [scheduled Edge Functions via pg_cron/pg_net and Vault](https://supabase.com/docs/guides/functions/schedule-functions). Its [Push example](https://supabase.com/docs/guides/functions/examples/push-notifications) uses Expo, so it is not a drop-in browser Web Push implementation.

Operational prerequisites: separately scoped service/data authority; supported browser/device UX; secure endpoint/key storage and rotation; per-device consent/revocation/logout cleanup; dedupe/idempotency across scheduled retries; expired-subscription removal (404/410); rate limits, failure monitoring and retention; privacy-safe lock-screen payloads; secure link/owner revalidation; synthetic then authorized real-device app-closed testing. No existing cached Service Worker or local timer alone delivers a notification while the app is closed. Push/admin remain outstanding N44 scope; this result does not close N44 or claim Production/PO acceptance.

## Concrete remaining blocker — inactive-card scope repair required

After the new affected checks passed, ran the original `node --test tests/n44-inapp.test.mjs`: **3 PASS, 2 FAIL**. Original failure at line 22 expected `[n44-session,n44-due,n44-soon]`, but the approved day-minus-three behavior adds `n44-too-far`. Original line 52 expected unread 3; actual 4. Its later unread expectation at line 56 likewise needs 1 → 2. These are obsolete timing/count assertions, not owner/expiry failures. The original file is part of `test:sync` (`tests/*.test.mjs`), so leaving it contradictory prevents honest local readiness. No original assertion was disabled or rewritten.

Missing permitted path: **`tests/n44-inapp.test.mjs`**. Necessary bounded repair: admit that existing file on this same inactive card/session, update only its event list/count expectations to the new 3-day contract (the exact passing expectations are already exercised by `tests/n44-reminder-timing.test.mjs`), and rerun that affected original test. Preserve all owner/expiry/deep-link/storage/outbox checks. No Product source repair or repeat browser/offline proof is needed if source remains unchanged. The controller/approved maintenance helper owns the scope correction and resumption; this worker does not edit queue state or create a helper. State remains BLOCKED until this material correction, with candidate and run identity preserved. Production release, pinned-tail parity and PO acceptance have not run.
