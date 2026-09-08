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
| CLASS-RULES-01 | Classroom Rules | `PLANNED` | Class tools card after Quick Log / `الرصد السريع`: `القوانين الصفية`, with view/manage and icon-plus-text add/edit rules. | Class page tools | Google + PO + Codex | Google Visual Lab approval | Review the visual/UX before Production implementation. |
| SCHEDULE-EXPORT-01 | Schedule Export | `PLANNED` | Export schedule as image or PDF. | Schedule | Google + PO + Codex | Export visual/design review | Define exact export layout and behavior. |
| SUPPORT-FEEDBACK-01 | Support / Feedback / Problem Report | `PLANNED` | Structured technical problem, suggestion, and inquiry support; any diagnostics must be privacy-safe. | Support | PO + Codex | Product/Production delivery design | Define storage/delivery and diagnostic consent; never auto-attach student content, credentials, tokens, or secrets. |
| SCHEDULE-MOBILE-TODAY-01 | Mobile Current-Day Navigation | `PLANNED` | During a school week on mobile, open Schedule at the current day; no forced current-day navigation on weekend/non-school days. | Mobile Schedule | Google + PO + Codex | Google Visual Lab approval | Define exact interaction. |
| HOME-ONBOARDING-01 | New User Getting Started | `PLANNED` | Restrained Home empty state for users with no classes: create class, add students, configure lessons/schedule. | Home | Google + PO + Codex | Google Visual Lab approval | Define final empty-state UX without a heavy tutorial. |

## Closed sync guard

`SYNC-V2` is CLOSED after Product Owner Production verification and is intentionally absent from the active issues above. `SYNC-UX-02` is also CLOSED: the Teacher Control Center retained a stale `badge--warn` visual modifier after the authoritative state had already become synced; the fix reconciles that UI class in place and did not change Sync V2 engine/data behavior. Future sync-affecting or sync-indicator changes must run focused release/Auth, Sync V2 runtime, and applicable Mini Hub state-transition regressions. Realtime is not required for correctness: the verified automatic cross-device propagation can take approximately one minute, while any perceived-speed improvement should be separately scoped.

`SESSION-AUTO-01B` is deployed on Production main `725c28c` and remains in `PRODUCTION REVIEW` pending Product Owner verification; it is not an open issue or a closed ticket.
