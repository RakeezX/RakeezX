# N124 — compact contextual attendance action

- Task: `continuous-n124-compact-attendance-action-20261019`
- Run: `b2f31236-ac91-45fc-9d63-152b8dc0e3f4`
- Base / observed origin/main: `258fbbd57740a14fa75cff31a7e243dcafa4acff`.
- Contract: canonical Product ledger N124 row dated 2026-10-19, PO 16:21 visual followup; accepted N121 routing remains in force.

Changed only home presentation and its existing component CSS. Contextual links use رصد الحضور / استكمال الحضور / مراجعة الحضور according to existing completeness, preserve excluded-session status, remove redundant completed focus link and verbose pending copy. The action has no underline, a visible keyboard focus ring and a 44px target. At mobile widths the existing session grid keeps the action alongside the class instead of creating a separate action row. Existing class and exact-session hrefs remain intact; no store/session generation/report/grade changes.

## Affected verification

PASS: `node --check src/views/home.js`.

PASS: `N124_RUN_ID=b2f31236-ac91-45fc-9d63-152b8dc0e3f4 node tests/n124-priority-1621/compact-attendance.mjs`.

The existing served Demo readiness helper and canonical isolated-local-browser helper exercised actual application DOM, router and source CSS over task-owned loopback HTTP in a fresh context. Both 390px and 1440px geometry inspections show the pending session and attention actions with no underline, one text line, 44px height and overlap with their main content row; no horizontal document overflow. Screenshots were visually inspected. Pointer and Enter navigation select the exact current/past session among two sessions of one teaching; clicking rendered class text opens the class. Keyboard focus remains visible. Partial/completed labels are checked through the actual presentation function without writing attendance. No attendance writes were performed; navigation preserves attendance, scores and pupils; no page errors.

Evidence: `tests/n124-priority-1621/result.json`, `home-390.png`, `home-1440.png`. Reused unchanged broader N121 routing proof: `tests/n121-1019-navigation.json` (current/past/completed, pointer/keyboard). No blanket suite or repeated Preview.

The isolated local phase needs no shared browser lease under the approved exception. Browser/contexts and the ephemeral loopback server were closed in their respective finally blocks. No live account, external service, queue or ledger mutations; no push or deployment. Controller publication, served official asset verification and PO review remain pending.
