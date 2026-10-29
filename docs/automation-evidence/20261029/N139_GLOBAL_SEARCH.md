# N139 — universal command search (AI implementation)

- Task: `continuous-n139-universal-quick-search-20261029`
- Run: `e0fd27f6-cd7c-4e73-98ce-5673b618b4c6`
- Base: `d9c16530d5645b23992fa027de0a7819989c6691`; observed `git ls-remote origin refs/heads/main` matched this base before implementation.
- Scope: `src/app.js`, `src/lib/global-command-search.js`, `src/styles/components.css`, `sw.js`, focused test and this evidence. No Auth/Sync/scoring/N44/N88 source changes, backend calls or persistent feature writes.

The mounted application topbar exposes an accessible 44px search button, Ctrl+K/Cmd+K and a shared application sheet with existing Escape, overlay dismissal and focus trapping. Shortcut handling yields to existing modals, editable controls and consumed events. Installation is idempotent. Closing restores focus even when a repaint replaced the opener.

An explicit router whitelist covers navigation, schedule, settings, archive, reports, teaching grades/attendance/quicklog/item distribution and selected tools. Class/service queries match section plus subject; ambiguous class/subject combinations yield no guessed destination. Links are ordinary anchors with durable IDs and existing router teaching-key encoding.

Student matching and aggregation reuse the unchanged N39 `currentStudentSearchResults` helper over `store.teachings()` / `store.students()`. Account results require ready claimed workspace, matching current/persisted identity, selected DB and the actual runtime ownership guard. Parent rows, students and enrollments reject explicit foreign owners; only active current-year/current-term, non-archived/non-closed contexts participate. Account/workspace changes remove the open sheet. No index or search persistence was added.

## Affected verification

Final command: `$env:N139_BROWSER='1'; node --test tests/n139-global-command-search.test.mjs` — **3 passed, 0 failed, 0 skipped** (6.28s).

1. `n139_command_routes_reuse_existing_pages_and_context`: real router matching for every whitelisted page/service; Arabic digits; exact section number; missing/ambiguous section and subject rejection; precise teaching attendance route and durable student links.
2. `n139_owner_scoped_student_search_and_no_private_data_outside_verified_workspace`: actual ownership-guard implementation; ordered N39 name tokens and distinct same-name IDs; former/foreign students, foreign enrollment/parent, historical/closed term, identity/storage/database/guard mismatch and unready rejection. Actual app UI also exercised a synthetic local claimed context through store activation/runtime guard, then logout invalidation. This is a read-only entry regression, not account provisioning or live-owner certification.
3. `n139_keyboard_mobile_open_close_and_offline_shell`: fresh installed Chrome contexts on task-owned `http://127.0.0.1:5139`, actual app DOM/handlers/source CSS; desktop Ctrl+K/Cmd+K, Tab/Enter navigation, Escape/focus restoration, existing modal exclusion, repeated installer/routing without duplicate action, 320px tap/overflow/44px targets and overlay dismissal. Separate fresh SW-enabled context cached `rakeezx-v97`, verified the new module cache entry, went offline, reloaded the real application, reopened search and navigated to exact attendance. External requests blocked. No page errors.

`node --check` passed for app, command module and SW; `git diff --check` passed. No broad suite/build or repeated N39 certification: unchanged N39 evidence remains its CLOSED Product row (Production `1d2003322f6c46b667f26b6f7315aa59dc348007`, deployment `4fde0ded-14ac-432a-a9f0-c731182d8d92`).

Initial failures preserved: default Playwright headless engine was absent (used installed Chrome); local static harness omitted JSON MIME (corrected); negative logout harness incorrectly tried clicking an action after the existing account gate removed it (corrected assertion); actual repaint-related focus loss was fixed in the feature. The final materially corrected scenario passed all three checks.

Each SW/browser phase acquired/released the canonical browser lease using this run token. Tests close only owned fresh contexts/browser and loopback server in `finally`; port 5139 had no remaining listener afterward. SW is both shell-listed and required during installation for the genuine new startup dependency.

Local candidate only. Independent publisher still owns integration/build and verification of changed Production-served app/module/CSS/SW; no push, deployment, live mutation or PO closure claimed.
