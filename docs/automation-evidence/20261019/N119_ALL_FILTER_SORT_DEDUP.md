# N119 — all-filter sort deduplication, PO19October 18:37

AI-authored scoped implementation and evidence.

- Task: `continuous-n119-all-filter-sort-dedup-close-20261019`
- Run: `483179a4-5613-4143-b281-f8009d070277`
- Base: `a0490e3e54b11498406bad71c70ab5485920f26e`; HEAD, origin/main and observed `git ls-remote origin refs/heads/main` matched before editing.
- Authority: current canonical N119 ledger row `[PO-CURRENT-1837]`; existing N120 layout remains accepted and unchanged.

## Exact touched filters

| Filter | Result |
| --- | --- |
| Gradebook | One default alphabetic/current-display-number option; highest/lowest grade retained. |
| Class reports: students | One default alphabetic/current-display-number option. |
| Class reports: grades | Same consolidated default; highest/lowest grade retained. |
| Class reports: attendance | One alphabetic default; most absent retained. Explicit roll remains only when former members' saved numbers produce a different order. |
| Class reports: support | Urgency default retained; one alphabetic/current-number choice replaces name/roll duplication; highest/lowest grade and most absent retained. |
| Historical reports | Saved default, alphabetical and saved roll choices preserved; no renumbering. |

Inventory of current option definitions found student sort menus only in `grades.js` and `reports.js`. Class roster, attendance entry, cross-class reports, execution report, teaching hub, former students and global student-search UI have no equivalent sort options to remove. A narrow scan of view option definitions confirmed no additional default/name/roll menu. The listed `src/lib/report-filters.js` does not exist at this source revision.

Old `name`/`roll` handler values retain their ordering: live gradebook and ordinary live reports alias the consolidated default; live support roll aliases name; genuinely different attendance and historical roll orders still execute. No CSS, identities, stored numbering, history, grades, ownership, Sync or service code changed.

## Affected verification

PASS `node tests/n119-1837/options.mjs`: actual application DOM, source CSS and handlers served by task-owned Vite at `http://127.0.0.1:5197`, using canonical `withIsolatedLocalBrowser` and existing `openReadyServedDemo`. Fresh disposable Demo context; external requests and Service Workers blocked. Browser/context and server closed in finally. No shared live browser or live account used. Exact observed options and handler evidence: `tests/n119-1837/evidence.json`.

The test covers the five live menus, both old values, opposite grade ordering, support urgency versus alphabetic order, historical saved roll versus name, and live attendance with a former member whose saved number differs. It compares student/enrollment/score/session/attendance records before and after sort operations. Historical/former fixtures are disposable local in-memory facts built from the actual app's snapshot implementation, without hosted service or close operations.

Harness corrections retained here: initial check incorrectly expected CSS `display:block` (actual `inline-block`); changed to visible display. Two initial reads raced scheduled repaint (old grade/historical options); changed to awaited exact option values and handler results. Final run passed without Product-code changes after those harness failures. The expected Service Worker-blocked warnings are part of isolation, not offline/Sync certification.

PASS `node --check` for both changed views and scoped test; PASS `git diff --check`. No full build, geometry matrix or repeated Preview required for these option semantics.

This is local candidate evidence only. Independent controller/publisher integration, Production asset verification and conditional N119 closure remain outstanding; no deployment or Product acceptance is claimed.
