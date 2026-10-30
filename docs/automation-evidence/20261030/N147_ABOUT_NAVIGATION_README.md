# N147 — About navigation and public README

AI implementation. Task `continuous-n147-about-navigation-readme-20261030`, run `df93f67e-94bf-42a5-bfe0-6d27f04383d5`.
Base: `571fc483d711780af666be4926c80ab00eeaba91`.

- About now uses the existing cloud/workspace readiness resolution before choosing a standalone public page. Ready Demo/account workspaces use the normal shell; unavailable storage still permits public About without opening protected routes. Existing ownership/restore/provisioning guards remain in place.
- Four semantic in-page buttons preserve `#/about`, move focus and scroll to their sections. Existing visual styling and keyboard focus outline are retained.
- Removed the duplicate rights FAQ and technical telemetry block/provider details. Retained concise measurement disclosure, data purposes/rights, processing outside Saudi Arabia, Mumbai India, retention/backups and independent-app/review responsibility.
- README is a 42-line Arabic product guide with the requested features, install qualification, local/offline/sync distinction and public support/About links. No internal operations references.

## Affected verification — 2026-10-30

Actual Vite-served application at `http://127.0.0.1:53147`, production-style DEV=false, canonical `withIsolatedLocalBrowser`, fresh disposable Chromium contexts, blocked external requests and Service Workers. Existing N145 Demo readiness helper reused. Account fixture uses the real registry, owner-bound provisioning receipt, normal boot resolver and store; no live account or service writes.

1. `node --test tests/n147-about-navigation.test.mjs`: public no-workspace About/reload/return/protected guard passed at 320/360/1280. Demo and synthetic account About entry, all four sections (Enter/Space), reload, return to Settings, shell and no horizontal overflow passed at each width. Desktop sidebar visibility passed. Account checkpoints read current document owner/database/receipt after reload. No pageerrors in these contexts.
2. That first run ended FAIL in the additional changed-owner negative fixture: changing localStorage followed by same-document hash navigation did not reboot the cloud identity. The test incorrectly expected boot resolution without a reload. Product source was unchanged; corrected the fixture to reload before checking that guard.
3. `$env:N147_REMAINING_ONLY='1'; node --test tests/n147-about-navigation.test.mjs`: PASS (1 test, 0 failures, 12.8 s). Reused successful width coverage above; reran only account1280 setup/reload/return needed for the corrected negative and then storage-failure remainder. Changed owner could not inherit the existing account shell; public About remained accessible. With synthetic IndexedDB failure, About rendered publicly and `/classes` displayed the storage error without a shell.
4. `node --check src/app.js`, `node --check src/views/about.js`, test syntax checks and `git diff --check`: PASS. Existing N145 assertion now requires human-readable Mumbai wording and button semantics; its historical task-bound browser runner was not rerun.
5. Inspected actual full-page captures in `%TEMP%/n147-demo-320.png` and `%TEMP%/n147-account-1280.png`; readable wrapped RTL content, styled section controls and shell navigation. Captures also exist for all six workspace/width combinations. Automated overflow checks cover 320/360/1280; these are viewport emulations, not physical-device proof.

Expected isolated-fixture console warnings: Service Worker registration blocked; cloud Sync fetches blocked; explicit synthetic storage error in the failure scenario. No Sync/offline-cache/live-service certification is claimed. Browser contexts/browser and owned Vite server closed in finally; no listener remained on 53147. No shared browser lease is needed for the approved isolated local phase.

No startup dependency, router rewrite, real data mutation, push or deployment. Production asset verification remains with the independent publisher. Candidate commit contains only the seven scoped files listed by Git; this report is one of them.
