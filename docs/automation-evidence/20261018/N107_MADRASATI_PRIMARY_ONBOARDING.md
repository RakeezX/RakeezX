# N107 — Madrasati primary onboarding (AI-authored)

Task: continuous-n107-madrasati-primary-onboarding-20261018
Run: 6e080d21-4b28-465c-9860-8d96990dbdb0
Base: 55bc032b49cea2a27e38c97170b870de64098b0a (HEAD, origin/main and observed remote main agreed before edits).

Latest canonical N107 row/activated card limits this follow-up to fresh-account Home and empty Classes. Prior accepted N107 scope remains accepted; no ledger lifecycle changes here.

Home uses the exact requested headline/body/kicker and primary «استيراد الفصول من مدرستي» to `#/classes/koshoof?new=1`, followed by quiet manual creation. Empty Classes uses the same actions, retains the actual current-term title and secondary demo location. Supporting Home guidance now accommodates imported classes. Existing populated toolbar is unchanged. The toolbar link styling excludes primary links from its neutral-background override, preserving existing primary tokens.

## Affected verification

PASS — `n107_fresh_home_and_classes_madrasati_primary_actual_ui`: `node tests/n107-madrasati-onboarding.mjs` exercises the actual app over task-owned `http://127.0.0.1:49807`, using canonical `withIsolatedLocalBrowser`, existing served-Demo readiness and N107/N73 fresh owned-account preparation/receipt/lease fixtures. Fresh contexts at 390×900 and 1280×900; actual source CSS, DOM, router and dispatch. Exact labels/hrefs/order, one primary per action group, rendered primary background, current-term empty copy and no horizontal overflow PASS. Both import links reach the same central hub with existing extension download and CSV/XLSX input. Home secondary reaches Classes; manual create opens the existing `#tch-form` and is cancelled without submission. Before/after database checkpoint including outbox is identical. No page errors.

Screenshots visually inspected: Home, empty Classes, existing import hub and manual form at both widths. Baseline Home was rendered before editing current main (not an old canonical checkout). Screenshots: `tests/fixtures/n107-madrasati-onboarding/`. Machine evidence: `tests/n107-madrasati-onboarding.json`; baseline: `tests/n107-madrasati-onboarding-baseline.json`. Final screenshot capture disables animations to avoid recording a sheet mid-transition.

PASS — `node --check src/views/home.js`, `node --check src/views/teachings.js`, `git diff --check`.

Canonical isolated-local phase applies: no shared live-browser lease reserved; helper closed owned contexts/browser in finally, and task-owned server closed in finally. No external requests, real accounts, source collection, student writes, build, SQL or Sync replay. Import engine/review/consent/save/owner guards and dependencies/router/Auth/SW remain unchanged; prior accepted data-guard evidence is reused. This result is local readiness only; controller/publisher owns integration and served Production proof.
