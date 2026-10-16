# N88 exact public hash entry — local candidate

Task: `continuous-n88-guest-hash-entry-20261017`

Run: `01344bf4-1b58-4920-a310-ca7f888c4d89`
Base: `296839c0ee4cc1a33b3b2126565a231b07255b58`

The previously shared URL is `https://rakeezx.com/#/n88-invite-lab`. This candidate replaces only the root HTML module script with an exact-hash branch. The public branch imports a standalone illustration with its own markup, scoped styles and event handlers. Every other hash imports the existing `app-update.js`. Leaving the guest hash reloads the document so the normal application bootstrap runs, including from the import-failure fallback.

The public module has no imports, account/workspace/DB access, storage, credential handling or network calls. All names, activities, progress and grades are fabricated. The fixed `DEMO-ONLY` input is compared in memory and never persisted or transmitted. The unchanged root head still reads `rakeezx-theme` once; browser instrumentation explicitly distinguishes this inherited theme read from private-data access. The original gated internal route and its guard remain unchanged. The new startup module is precached and required by the existing Service Worker install alongside the other startup dependencies.

## Affected evidence

- `node --test tests/n88-guest-hash-entry.test.mjs tests/n88-student-invite-lab.test.mjs`: **6 passed**. Includes exact index-only replacement against the immutable base (therefore CSP and surrounding HTML unchanged), restricted standalone capabilities, actual worker offline shell/module responses and failed-install behavior when the new required module is unavailable. The logged background revalidation failure is the deliberately unavailable synthetic network.
- `node tests/n88-guest-hash-entry-browser.mjs`: fresh canonical isolated Chromium contexts over a task-owned loopback HTTP server serving actual application source and CSS. Guest checks passed at **320/390/768/1280**, light/dark, RTL, no horizontal overflow, keyboard activation, focus restoration, one-click invitation, invalid and valid manual input, fabricated progress, visible title/notice and back navigation. No app-update/app/store/private module requests, external requests or private calls were observed in the guest document; only the inherited head theme read occurred.
- Aborted guest-module loading showed the safe visible failure text and working back link. Normal visitor and actual login form rendered at `#/`, `#/classes`, and nonmatching `#/n88-invite-lab?extra=1` / `#/n88-invite-lab/`.
- Existing `openReadyServedDemo` helper confirmed Demo readiness on `#/classes`: **8 teachings / 184 synthetic students**. Reload retained the Demo workspace, readiness and students.
- Targeted account fixture confirmed full actual application bootstrap on `#/`, with the real ownership guard intact. One post-reload document checkpoint read ready account workspace, synthetic owner `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, selected database `rakeezx`, matching device claim, synthetic teacher profile and rendered `.layout`. Synthetic remote endpoint responses were fulfilled in memory; no live service/account was used.
- `$env:N88_CHECK='visual'; node tests/n88-guest-hash-entry-browser.mjs`: **zero axe violations** within the guest UI at 320/light and 1280/dark. Both actual rendered screenshots were visually inspected: readable RTL layout, intact controls, notice and back link. Temporary screenshots were removed after inspection.
- `node --check` passed for the new view, browser harness and `sw.js`; `git diff --check` passed. Raw browser results are in `tests/n88-guest-hash-entry-browser.json`. Every isolated phase closed its owned contexts/browser; each server closed in `finally`. No shared browser lease was used under the explicit isolated-local exemption; no shared/live browser or user profile was accessed.

## Preserved harness failures and correction

The first offline-worker test failed with `504 !== 200` because its synthetic fetch event omitted `waitUntil`. Adding that actual event primitive corrected the fixture; the actual worker then returned cached shell and modules with network unavailable.

The first account assertion timed out after 30000 ms waiting for `.layout`; an expanded synthetic-response fixture still timed out after 15000 ms and showed the visitor landing. The concrete cause was a fragment-only `goto` after preparing the synthetic identity: it retained the already-running signed-out document. The correction performs an actual reload before the owner-bound checkpoint. Only the corrected account scenario was rerun (`N88_CHECK=account`); unchanged guest/Demo evidence was retained. No Product guard or account code was changed.

## Delivery boundary

No push, deployment, provider request or Production acceptance check ran here. Local browser navigation used the exact original hash on loopback, not the live domain. Service Workers were blocked in browser contexts; worker offline behavior was checked separately with the actual worker source. This does not certify a live account, installed PWA or offline browser cache. The sole publisher must verify source index/JS/SW bytes and immutable served main at the real URL. CSP and Cloudflare normalization code were not changed.

The earlier static-public HTML attempt (`e5ddd52…`, wrong `/n88-invite-preview.html` mapping / 404 and provider HTML transforms) remains a failed delivery attempt. This candidate does not republish or claim acceptance of that page. **N88 remains OPEN** for real student access, identity, Auth and security architecture.
