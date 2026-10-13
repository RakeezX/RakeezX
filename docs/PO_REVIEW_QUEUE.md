Current PO decisions 2026-10-13 11:16 Asia/Riyadh: N94/N97/N98 and the +/- surface correction accepted/CLOSED. N93 temporarily DEFERRED. N73 stays CLOSED; N100 records agreed label-only target-mark preservation with copied start/due dates, not a delivered change. N78 stays deferred for a small open-source study. Finish the previously unfinished work before N23/N24/N64/N88/N90.

Current PO priority update 2026-10-13: N73 accepted/CLOSED; optional target-mark preservation tracked as N100 pending details. N23/N24/N64/N88/N90 are reopened for work AFTER the pre-existing unfinished tickets; N78 is re-deferred. This supersedes old deferred flags for those five only. No new deferred worker is admitted by this record.

# Current PO acceptance — 2026-10-13 08:27

PO acceptance 2026-10-13 08:27 Asia/Riyadh: N77 CLOSED. Loading-circle correction accepted/CLOSED as a subtask only; N71 unified restore remains OPEN. N91/N13/N49 remain CLOSED. This record does not alter runtime code or Product data.

<!-- BEGIN RAKEEZ OPERATING POINTER -->
# RAKEEZ — published results for PO review

This page preserves user notes and acceptance context. The automatic block lists only delivery with observed Production evidence; use the task's delivery receipt and [Product ledgers](PRODUCT_LEDGER.md) for status. `awaiting_po` releases execution capacity immediately, so review does not delay the next eligible ticket. Local/Preview results are not published acceptance items.

<!-- BEGIN RAKEEZ CONTINUOUS DELIVERY -->

| التذكرة | النتيجة المنشورة | الموقع | Git SHA | التحقق UTC | بطاقة التنفيذ |
| --- | --- | --- | --- | --- | --- |
| N99 | Aligned the public landing event name to campaign_landing, preserved old per-tab dedupe behavior, and documented the historical event boundary. Local candidate is committed; publishing and Production verification remain with the controller. | [Production](https://rakeezx.com/) | 192df49cd7b1bb263f15a9448c2dcb1d7dd30563 | 2026-10-13T08:21:55.239Z | continuous-n99-campaign-event-contract-20261013 |

<!-- END RAKEEZ CONTINUOUS DELIVERY -->
<!-- END RAKEEZ OPERATING POINTER -->

<!-- BEGIN RAKEEZ PO DECISIONS 20261013 -->
## Current PO decisions — 2026-10-13

N13 is CLOSED. Exact verified Production release `a516ced605cf016848841b0bc021d4e5acdfa41f`; candidate `f8e2a5234e72b0af04174a4b33588c8e34f99d36`. PO reported improvement and accepted closure when technically ready. The requested single creation form, shared roster and duplicate-without-writes outcome passed all three required checks. N77 deletion remains independent.

N49 is CLOSED. Exact verified Production release `df1715a822fe37f15f5b25d288db75c2d391b895`; candidate `8d44d3a5fbedae0fbcd3f894bca9d9fc4c4350cf`. PO reported a successful personal 3/6-minute Preview trial at 03:07 Asia/Riyadh on 2026-10-13. The remaining screen wording and printed student-table correction now passed its own actual-app check and Production delivery, satisfying the separate delegated technical closure condition. Production stays at 7/14 days.

N96 and N54 remain previously accepted/CLOSED. N91 remains available for PO review. N77 has high priority; deferred tickets stay deferred. Full prior notes, user feedback, delivery evidence and the bounded unattended-work/Scheduler observation are retained in `docs/automation-evidence/20261013/PO_DECISIONS_20261013.json`. The observed work interval proves local progress without chat calls; it does not establish uninterrupted 24-hour operation. The controller observes canonical closure; this document operation does not write queue state.
<!-- END RAKEEZ PO DECISIONS 20261013 -->

## Preserved user notes and historical review context — not dispatch instructions

The original content below is retained verbatim, including Product notes and prior acceptance evidence. Its dated runtime claims, PM handoff requirements and resolved asks do not re-block the controller. Do not mark a user note accepted, delete it or change its Product meaning merely because delivery automation advanced.


# V5 Product Owner review

Only meaningful **new Product decisions** or actual Production acceptance belong here; previously accepted work must not be re-submitted. N33 is PO-accepted and **CLOSED** 2026-10-12; N86/N87/N85/N15/N53/N79/N89 are also closed.

| Ticket | Current PO position | Release boundary |
| --- | --- | --- |
| **N73** | PO requested Production on 2026-10-12; the requested release was **not performed** after source inspection revealed that the new D-119 apply operates in Demo only. [Existing Preview](https://96195b5e.rakeezx.pages.dev/) is available for optional design review. | Do not seek repeated routine approval and do not claim Production-ready. Server atomic copy and owner/Sync/scoring/data-loss protection must be certified, preserving the current live copy path, before offering a safe production candidate. |

**PO pause:** No new ticket and no new work after 2026-10-12 instruction. `STOP-REFILL` remains in force until new explicit authorization. N84, N44, N77 and N36 have existing local outcomes but none is ready for Production; see [PM queue](PM_REVIEW_QUEUE.md) for factual release gates. N12 names-only V1 is CLOSED and N90 grades scope remains deferred; neither is a new approval request.

## New Product Owner discussion — notes originally dated 2026-10-06, received 2026-10-12

The five new notes have been preserved verbatim in [Product Ledger History](PRODUCT_LEDGER_HISTORY.md) and assigned separate INBOX identities N91–N95 in [Active Product Ledger](PRODUCT_LEDGER.md). **INBOX is not coding approval.** `STOP-REFILL` is unchanged; no workers/tickets for execution may be launched.

| Ticket | Proposed interpretation and related open/closed tickets | Decision needed |
| --- | --- | --- |
| N91 — class tool cards on mobile | PO 2026-10-12 refined solution: **slightly reduce title font** where appropriate, plus responsive grid reflow (two columns while readable, one if width demands). Current CSS clips `.tile__title` with `white-space:nowrap`/ellipsis; mere shrinking is insufficient. Related deferred N72 quality sweep, CLOSED N76/N53. | Preserve all card titles/icons/action reachability and test RTL 320/360/390/430px + real iPhone Safari when implementation is authorized. PO hold remains. |
| N92 — pristine student deletion message | Exact current success sentence in student-lifecycle-ui.js is «تم حذف الطالب المضاف بالخطأ.»; requested «تم حذف الطالب بنجاح». N80 CLOSED navigation remains separate. | Is the proposed exact short text accepted? Do not change confirmation or historical-record removal semantics. |
| N93 — Noor two intraterm assessment periods | PO clarified **grades only**: keep ONE class, student and item roster. MOE 2025 executive rules mention electronic reporting twice per academic period, while an older official Noor help screen refers to entered marks in intraterm periods. Neither alone establishes 1448H Noor input schema; do not infer two separate totals. | Verify actual teacher Noor 1448H Gradebook for target subject/grade and current MOE distribution. Design two reporting checkpoints/snapshots from one scorebook only after determining cumulative vs independent nature, no duplicate entities or automatic double-summing. |
| N94 — PO-approved three-tap late/regular/unrecorded with clear colors | PO explicitly approved **optional** teacher-chosen start date (future allowed; empty means start immediately); `createdAt` is saved automatically and distinct, `dueDate` optional. Each subitem has normal points (existing value) and optional late points, default **equal**; teacher may lower late points or keep same. After the due date first intentional tap records **متأخر** with late points; next tap changes to **عادي/مقبول بعذر** with full normal points (including cases like medical excuse), without recording sensitive health details. This first-tap suggestion is **not proof of when the student actually submitted**. N88 is future and not required for manual teacher marking. | **PO approved third tap on 2026-10-12:** after due date, unrecorded → late → regular/excused → unrecorded, then repeat. Before deadline or without a deadline: unrecorded ↔ regular. Use three highly distinguishable visual states: GREY neutral + dash/unrecorded; GREEN success + check/regular or excuse; AMBER/ORANGE + clock/late, with explicit Arabic text, points and high-contrast labels in light/dark modes. Colors are not the sole cue. Due-date day/time cutoff remains a separate implementation detail for confirmation. Actual app currently uses a boolean checkbox and `score:set_completion` Sync command and recomputes derived marks, so three states + per-student exception require scoped model/server-receipt/projection/Backup/Restore/Sync compatibility tests, not just UI change. Never auto-reclassify recorded students when the deadline changes. Still no implementation authorization while STOP-REFILL is active. |
| N95 — credible red Sync warnings | PO reported repeated red warnings when leaving/re-entering app or internet toggles. Verified code cause: `syncAll` catch sets `error` after first transient exception; `coordinatorOperationalState()` propagates error before durable failed evidence; UI maps error to `badge--danger` immediately, while retries are scheduled at 2/4/8/16/30 seconds. CLOSED N68 handles only some resume flashes; N95 is wider severity policy. | Proposed **UI-only severity hysteresis**: quiet retrying/local-save signal for transient reconnect/offline, red only for confirmed sustained impact (initial study estimate 90–120s + >=2 meaningful failed attempts, NOT approved threshold); confirmed server rejection, owner/auth failures and data-loss/recovery hazards shown immediately with actionable detail. Keep real Sync retry/data truth unchanged. |

No implied mergers, no new Product implementation permissions, and no reversal of earlier completed N33/N68/N80 tickets.


Latest PO feedback 2026-10-13 04:52 Asia/Riyadh: N91 is expressly accepted and CLOSED. N77 and N94 follow-ups, N97 sync status, and N98 alphabetical roster have entered the current controller catalog. N24 report-design note is retained without activating deferred work. See docs/automation-evidence/20261013/PO_FEEDBACK_0452.md.
