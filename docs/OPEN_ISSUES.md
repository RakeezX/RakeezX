# RAKEEZ X — Open Issues

Priority: `P0` data correctness/loss, `P1` runtime/sync/user-workflow defect, `P2` UX/product refinement, `P3` cleanup, `DEFERRED` intentionally postponed.

| ID | Title | Status | Evidence / observation | Affected area | Owner | Dependency | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STU-REC-01B | Destination Student Profile continuity | `DEFERRED` (P1) | PO reports X history looks empty after X → Y and reappears after return. Code/focused tests exist but are not proof of the real production path. | Student Profile, routing, PWA/runtime | Codex | Reproducible PO path/device/cache state | Reproduce on the real Production route before selecting a fix. |
| STU-REC-01C | Grade portability | `OPEN` (P1) | Scores/items remain teaching-scoped by design. | Grades, transfer semantics | Codex + PO | Product grading policy | Define portability semantics separately. |
| STU-HIST-01 | Historical roster/report truth | `OPEN` (P0) | Current historical reports must not reconstruct old class membership from current enrollment. | Attendance completeness, reports | Codex + PO | Historical-report product definition | Specify snapshots/projection rules before implementation. |
| RUNTIME-FOCUS-01 | Intermittent click/focus/repaint glitch | `OPEN` (P1) | Listed in supplied recovery state; no deterministic reproduction in the current checkout. | UI event lifecycle | Codex | Reproduction evidence | Capture route, device, timing, and console evidence. |
| SCHED-UX-01 | Schedule/timing profile redesign | `REDESIGN` / `DEFERRED` (P2) | Current profile behavior exists; visual/interaction direction is not settled. | Timing settings, indicators | Google + PO | Approved Google design | Produce reviewable Visual Lab proposal. |
| YEAR-TERM-01 | Academic-year and term management | `DEFERRED` (P2) | Future lifecycle workflow is not defined. | Years, terms, archival | PO + Codex | Product decisions | Write a dedicated ticket. |
| PWA-UX-01 | Install guidance deep-link and identity/boot refinement | `DEFERRED` (P2) | Install prompt works; guidance deep link, splash/boot, and app identity need approved UX direction. | PWA shell | Google + PO | Visual approval | Scope as visual ticket; retain offline behavior. |
| PRESENT-01 | Home/schedule/reports/classes refinement | `DEFERRED` (P2) | Listed recovery refinement; no approved consolidated design. | Primary views | Google + PO | Visual Lab approval | Prioritize a small approved visual ticket. |
| SYNC-UX-01 | Quiet automatic sync UX review | `DEFERRED` (P2) | Outbox/automatic sync semantics exist; user-facing status deserves review. | Sync status UI | Google + Codex | Do not alter sync semantics | Audit copy/states after PO decision. |
| ROSTER-UX-01 | Retire manual renumber button if redundant | `DEFERRED` (P3) | Automatic dual-roster renumber exists; `src/views/students.js` still exposes manual action. | Student roster | PO + Codex | Confirm remaining use cases | Observe real use and decide remove/retain. |
