# WA-SCHEDULE-0429 — approved Schedule Work

| Field | Contract |
| --- | --- |
| WORK_APPROVAL_ID / tickets | `WA-SCHEDULE-0429` / N22 and N57 |
| Work package | `D:\Abdullah Projects\RakeezX-Work-Schedule-0429` |
| Handoff/source | `HANDOFF-0425.md`, `HANDOFF-0429.md`; `schedule.html`, `schedule.js`, `candidate.css` and `surface.html`, `surfaces.js`, `surfaces.css`; final `evidence/0429/` and relevant Option A captures |
| PO decision / checkpoint | N22 **Option A — Global Dynamic Equal Height** and N57 Schedule-owned visual outcome including 0429 Timing Profile action polish; approved after the 0429 handoff and recorded in 0445. Its older N57 “PO FINAL POLISH REVIEW PENDING” line is superseded by this PO decision. |
| WORK_APPROVAL / SOURCE_STATE | `APPROVED` / `VERIFIED` at registry creation; recheck [manifest](WA-SCHEDULE-0429.manifest.json) |
| Implementation authorization / state | No new Product implementation ticket authorized by 0445 / `NOT_AUTHORIZED` |
| Codex / Preview / Production | No completed port, Preview or Production approval recorded for this Work contract. |
| Risk / device gate | MEDIUM visual/responsive; preserve HIGH-risk timetable identity. Chromium/WebKit width/light/dark evidence exists; no physical-device test claimed. |

## Accepted surfaces and responsive behavior

- **N22:** Option A applies **global dynamic equal height** to the relevant Schedule period/day presentation. Maintain legible content across mixed/long states instead of clipping or permanently fixed heights. Option B, period-row equal height, is not the selected model. Preserve Schedule chronology, card structure and RTL.
- **N57:** carry the approved calm RAKEEZ identity across `#/schedule`, `#/schedule/times`, headers/context, weekday/session and timing-profile cards, effective/base/seasonal timing, Schedule-owned add/edit/export sheets, timing profile validity/generation, recess, timing models, period/time editors and confirmations. Do not silently omit a sub-surface or redesign the global sheet system.
- **0429 Timing Profiles action row:** exact rename/validity copy **`تعديل الاسم وفترة سريان التوقيت`** remains on one line at 1440/1024/768/390/320 in Chromium/WebKit light/dark. Delete is a compact **18×18 SVG trash icon** inside a **44×44** target, accessible `title`/`aria-label` **`حذف ملف التوقيت`**, restrained destructive color and visible focus ring. In RTL, rename flexes on the right; a fixed 44px delete track sits left/end. Base or otherwise non-deletable profiles show no delete control and give rename the full row. No overlap or horizontal overflow.

Interaction sequence: open Schedule/timing profiles → review/edit eligible profile → rename/validity action or existing deletion action only when eligible → existing Product save/delete behavior. The 0429 polish changes action presentation, not deletion eligibility. Preserve immutable `slot.id`, historical dated sessions/attendance, timing resolution, existing base/non-deletable profile rules, remote Calendar timing and Sync/data semantics. No new stored timing type.

Rejected/superseded: N22 Option B; old side-by-side large text delete action in the 0425 Timing Profile row; using Work's `identity=current` comparison as final. Demo parity applies to logically shared Schedule visuals without Auth/cloud/private data. Before coding, verify the manifest and create the required parity matrix; zero `GAP` and zero `RUNTIME-CONFLICT` before Preview. Evidence includes `HANDOFF-0429.md`, `evidence/0429/results.json` (105/105 focused checks), screenshots and 0425/0429 source, with later PO decision recorded in 0445.
