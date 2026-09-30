# WA-CALENDAR-0417 — approved Calendar Work

| Field | Contract |
| --- | --- |
| WORK_APPROVAL_ID | `WA-CALENDAR-0417` |
| Product tickets | N50, N51, N55; N50 Bug #04 and N50 suspension / 0446 are separately CLOSED subsets. Overall N50, N51 and N55 remain OPEN. |
| Work package | `D:\Abdullah Projects\RakeezX-Work-Calendar-0417` |
| Handoff/source | `HANDOFF-0417.md`; final `index.html`, `calendar-page.js`, `calendar-page-0416.js`, `calendar-page.css`, `calendar-proportion.css`, companion Calendar CSS/JS and `captures/` / `evidence/`; lineage 0409 → 0410 → 0412 → 0415 → 0416 → 0417 |
| PO decision | N50/N51/N55 final Work outcome approved **after** the 0417 handoff; recorded in 0445. The handoff's earlier “PO REVIEW PENDING” is historical, not current status. |
| WORK_APPROVAL / SOURCE_STATE | `APPROVED` / `VERIFIED` at registry creation; recheck [manifest](WA-CALENDAR-0417.manifest.json) before use |
| Implementation authorization / state | Suspension / 0446 shipped separately and is CLOSED; remaining WA-CALENDAR-0417 Product scope is `NOT_AUTHORIZED`. Overall N50/N51/N55 remain OPEN. |
| Codex / Preview / Production | N50 Bug #04 range lifecycle shipped separately at `6d1d255aa4dfa51f44f95b841a5d88541e7a87be` and PO-verified CLOSED. Distinct suspension foundation shipped separately at `0700d55331f1f66678ec236f5de8bad776a6d933` and PO-verified CLOSED. Full 0417 visual contract and N51/N55: no completed Codex port, Preview or Production approval recorded. |
| Risk / device gate | N50 data correctness and suspension: HIGH; full Calendar cross-surface fidelity: MEDIUM/HIGH. Chromium/WebKit desktop/tablet/mobile evidence exists; no physical-device result claimed in 0417. Use a real device when later interaction scope requires it. |

## Exact accepted surfaces and behavior

- **Calendar-owned whole experience:** calm identity/header; “أين نحن الآن؟”; current term/date context; start → current marker → end timeline; elapsed/remaining/progress metrics; a separate next milestone; terms, Holidays, settings, year/term/exception add/edit, affected-session and deletion/source/accreditation surfaces. Do not port only the top cards or Holidays list.
- **N50 Holidays/exceptions:** section heading **“الإجازات والفترات الدراسية”**, one central **“إضافة استثناء”**, direct filters `القادمة` / `الكل` / `رسمية معتمدة` / `استثناءات محلية`, and four visible choices `دراسة حضورية`, `دراسة عن بُعد`, `إجازة`, `تعليق دراسة`. Show official multi-day holidays as one range without appending ordinary adjacent weekends. Present a calm, shorter date-tile row with name, duration/effect, source and affected-session meaning. Preserve known holiday recognition and existing teacher workflow.
- **N51:** a fresh Holidays page entry defaults to `القادمة`; other filters remain available for the visit. Do not extend the default to all study-period types or persist an account preference without a new decision.
- **N55 top hierarchy:** current state and next milestone cards are balanced **1:1 at widths ≥900px**, same outer height, with aligned padding/header. At 899px and below they stack without changing accepted content. The current card retains its week hierarchy, timeline bounds/marker, dates and three metrics. The next card retains tile/name/range/source/affected-session action. Term cards show centered dates, weeks, approximate teaching days, holiday period/day counts and one edit action. Do not restore redundant detail buttons or duplicate exception actions.
- **Responsive/atmosphere:** RTL, light/dark, 1440/1366/1024 desktop, 768 tablet, 390/320 mobile; no horizontal overflow, collision, fake blank filler or sub-44px actions. 0417 changed only desktop proportion from 0416; tablet/mobile content and layout were carried forward unchanged.

## Interaction sequence and exclusions

Calendar entry → current-term/next context → Holidays filter or central exception action → existing add/edit/delete/affected-session flow → return with focus/state intact. N50 data work must preserve exact range identity and Sync V2 lifecycle already shipped in Bug #04. A distinct persisted suspension type was shipped separately in 0446; this does not complete the remaining 0417 visual/UX transfer. Official preset dates require independent source verification before data correction.

Rejected/superseded: earlier heading `الإجازات` was superseded by `الإجازات والفترات الدراسية`; old unequal 1.5:1 top-card proportion was superseded by equal 0417 cards; repeated full-width exception actions, redundant detail buttons, automatically attached weekends, and a combined holiday/suspension type are not the approved outcome. Do not treat the 0417 handoff's pending line or older Work candidates as current approval.

Preserve Product Calendar calculations, academic-year/term identity, attendance/session/timing semantics, Owner Guard, outbox/tombstones, restore/convergence and existing data. Demo parity applies where Calendar surfaces logically exist; Demo must stay account-free with no Product cloud calls. Before implementation, prepare the ledger-required surface matrix; zero `GAP` and zero `RUNTIME-CONFLICT` are required before Preview fidelity can be claimed. Evidence: `HANDOFF-0417.md`, accepted captures and focused JSON in the manifest; PO approval recorded after the handoff and reaffirmed in 0445.
