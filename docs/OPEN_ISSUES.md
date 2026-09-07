# RAKEEZ X — Open Issues

Priority: `P0` data correctness/loss, `P1` runtime/sync/user-workflow defect, `P2` UX/product refinement, `P3` cleanup, `DEFERRED` intentionally postponed.

| ID | Title | Status | Evidence / observation | Affected area | Owner | Dependency | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STU-REC-01B | Destination Student Profile continuity | `DEFERRED` (P1) | PO reports X history looks empty after X → Y and reappears after return. Code/focused tests exist but are not proof of the real production path. | Student Profile, routing, PWA/runtime | Codex | Reproducible PO path/device/cache state | Reproduce on the real Production route before selecting a fix. |
| RUNTIME-FOCUS-01 | Intermittent click/focus/repaint glitch | `CONDITIONAL / REPRO REQUIRED` | No deterministic Production reproduction is currently recorded. | UI event lifecycle | Codex | Reproducible Production path | Capture route, device, timing, and console evidence before classifying implementation work. |
| YEAR-TERM-01 | Academic-year and term management | `DEFERRED` (P2) | Future lifecycle workflow is not defined. | Years, terms, archival | PO + Codex | Product decisions | Write a dedicated ticket. |
| PWA-UX-01 | Install guidance deep-link and identity/boot refinement | `DEFERRED` (P2) | Install prompt works; guidance deep link, splash/boot, and app identity need approved UX direction. | PWA shell | Google + PO | Visual approval | Scope as visual ticket; retain offline behavior. |
| PRESENT-01 | Home/schedule/reports/classes refinement | `DEFERRED` (P2) | Listed recovery refinement; no approved consolidated design. | Primary views | Google + PO | Visual Lab approval | Prioritize a small approved visual ticket. |
| ROSTER-UX-01 | Retire manual renumber button if redundant | `DEFERRED` (P3) | Automatic dual-roster renumber exists; `src/views/students.js` still exposes manual action. | Student roster | PO + Codex | Confirm remaining use cases | Observe real use and decide remove/retain. |
| DOC-COMMENT-01 | Correct stale notes UI comment | `OPEN` (P3) | `src/lib/db.js` describes notes as having no UI, while `src/views/student.js` provides dated Student Profile notes. | Source comments / documentation | Codex | Documentation-only cleanup ticket | Update the stale comment without changing note behavior. |

## Closed sync guard

`SYNC-V2` is CLOSED after Product Owner Production verification and is intentionally absent from the active issues above. Future sync-affecting changes must run focused release/Auth and Sync V2 runtime regressions appropriate to the changed path. Realtime is not required for correctness: the verified automatic cross-device propagation can take approximately one minute, while any perceived-speed improvement should be separately scoped.
