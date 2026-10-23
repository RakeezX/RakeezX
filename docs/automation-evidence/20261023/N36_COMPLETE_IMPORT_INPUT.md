# N36 — current import outcome and acceptance

PO supplied a new actual .37 completed run, then actual app local readback: **10 receipts / 302 rows; zero pending**. Students and classes are visible. Teacher/principal imported, school imported with a location suffix; classes have no subjects, department/timetable missing. Extension reports complete/saved but confirmed counters0. Coverage is partial with no usable cause in copied summary. Cloud convergence/reload and exact source roster total have not been certified. This does not reconcile old .35 or prove one missing student against old303.

## Observed source seams at e4a60549bf7936de27e4ab4bc7864e4b19366d16
- source-adapter.js rejects a selected timetable anchor carrying an event name other than onclick as live-link-event, before GET. Actual attribute name and response contents were not supplied. No handler must be read/executed; response identity remains protected.
- background-runner.js clears receiverProgress on every successful receipt; view defaults then display0. Success receipt counts must survive independently and remain exact/idempotent.
- class-import-center.js appends unresolved-extension wording even after all saved receipts, and derives subject links only from explicit class/timetable data. No fictitious default subject is acceptable.
- selection.js selected-card metadata omits department before its early return. Existing suffix helper recognizes exact directory locatives but refuses a nonempty destination; test empty/same/conflict instead of assuming helper absent.
- PO's school example: ابن الجوزي الابتدائية بمكة المكرمة -> display ابن الجوزي الابتدائية; canonical department الإدارة العامة للتعليم بمنطقة مكة المكرمة. Keep raw school binding, explicit source label precedence and calendar unchanged.

## End-to-end acceptance, not a message patch
Fresh normal account and populated partial account, actual popup/source-reader/worker/receiver/store over isolated loopback with fabricated data: Start -> validated metadata -> actual class/subject links and timetable -> students -> exact receipts -> UI/reload -> one bounded synthetic repeat without duplicates. Complete roster proof stays separate from optional setup, with safe reasons for genuine gaps/unknowns. Use both supported entry paths as grounded in existing source fixtures; simulated layout is not claimed to be live inspection. Package and publish only through the existing sole path. Local supported completion, actual-source limitations, published version and PO acceptance must be distinct.

One implementation owner: continuous-n36-complete-import-outcome-20261023, gpt-6.1-sol / medium / Standard. The existing fresh-start correction e4a60549 is now accepted by the actual successful start/rows at its narrow scope; no Product umbrella closure. No queue or account access is performed by this intake. No denied Issue creation is retried. All previous candidates/evidence retained.
