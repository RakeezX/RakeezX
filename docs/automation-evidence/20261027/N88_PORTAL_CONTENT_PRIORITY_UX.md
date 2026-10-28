# N88 portal content priority — AI-authored local evidence

Task: `continuous-n88-content-priority-after-n130-20261027`
Run: `87b53fe5-2574-46b3-86e5-35363518d70b`
Base: `6696d03518111134cbf855544c090d92496e3126`

The canonical predecessor card `continuous-n130-sync-context-after-qualified-sw-20261027` was read as `awaiting_po`, with the verified published revision equal to this base. `origin/main` also pointed to this base when checked. Shared SW changes are therefore serialized after that release. No queue, service, real account, Auth/RLS/schema or publisher operations were performed.

## Result

Teacher: compact class heading and confirmed total/active counts; one primary create-missing action with count; direct labeled buttons above the roster open and focus the guidance/publication and visibility editors. Existing code/copy/share and guarded rotate/revoke remain. Confirmation cancel returns focus to the originating row after the authoritative reread. Guidance summary focus survives its asynchronous redraw.

Student: compact identity/actions, then required work, scheduled work, published grades and completed work in the same DOM and visual order. Execution/delivery instructions, dates and status are visible in task articles. Completed work retains one secondary disclosure, preserved on a changed-data refresh. Empty work sections are omitted, with one minimal overall empty state where appropriate. Support remains secondary. Current projection, escaping, session retirement, timeouts and API contracts are retained. No new persisted data or date input.

SW generation changes once, v91 → v92; its other bytes and private network-only exclusions are unchanged.

## Checks and artifacts

All paths below are under `tests/n88-portal-content-priority-20261027/` unless stated otherwise.

- `node browser.mjs` (from the repository: `node tests/n88-portal-content-priority-20261027/browser.mjs`): PASS. `result.json` records 24 actual teacher shell/route/client/owner-guard cases, 1/30/50 synthetic roster sizes at 320/390/768/1280 in light/dark; eight actual student view/client/CSS cases. No horizontal overflow; visible controls at least 44px; direct editor keyboard navigation; actual instructions/start/due/status; DOM order equals visual order. Synthetic values only; code fields masked in screenshots.
- `N88_GUARDS_ONLY=1 node tests/n88-portal-content-priority-20261027/browser.mjs`: PASS, `guards-result.json`. Actual copy/share, confirmed rotate/revoke, cancel focus, editable guidance/visibility handlers, failed mutation privacy and no replay on review, owner-change denial and delayed response discard, student session retirement, omitted grades and minimal empty/pagehide wipe.
- `node tests/n88-portal-content-priority-20261027/pwa.mjs`: PASS, `pwa-result.json`. Fresh leased synthetic Chromium, actual v92 SW installed and controlling; teacher view (existing synthetic mount seam only) and exact CSS served offline; actual mounted editors usable offline at 390px; private student API unavailable offline. This is not a live account/Sync or cold offline account boot certificate.
- `node --test tests/n88-portal-content-priority-20261027/cache.test.mjs tests/n88-student-projection.test.mjs`: 28/28 PASS. Source SW installation/offline current view+CSS bytes, exact generation-only diff, private request exclusion; existing published/omitted fields, all 64 visibility combinations, membership/owner isolation and scoring equivalence.
- `node --check` for both affected views, SW and browser harness, plus `git diff --check`: PASS.
- Inspected actual student mobile dark and teacher desktop editor/mobile dark roster screenshots. Source digests are in `source-hashes.json`.

The reused teacher fixture needed a task-local server copy with `application/json` MIME for current JSON-module imports; the prior helper returned octet-stream and Chromium correctly refused it. The failed attempts are retained as `failure-*.json`. A subsequent keyboard test exposed summary focus loss and led to the scoped Product fix. The first PWA comparison failed because it compared the existing synthetic mount seam to unmodified source; the corrected comparison explicitly permits only that exact seam, and the separate VM cache check compares unmodified source bytes. `pwa-failure-*.json` preserves the original failure. No security refusal was bypassed.

All owned contexts/browsers/servers closed in finally; integration/browser phase leases released. The isolated visual phase used the canonical helper and no shared browser lease; the actual SW phase acquired the shared browser lease. No push or deployment occurred. Sole controller/publisher still owns integration, deterministic build and Production/served-PWA proof. N88 remains open pending PO acceptance.
