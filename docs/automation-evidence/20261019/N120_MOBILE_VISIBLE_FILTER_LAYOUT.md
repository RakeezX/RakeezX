# N120 — mobile visible filters, 19 October 2026

AI-authored implementation and evidence for task `continuous-n120-mobile-visible-filter-layout-20261019`, run `baf665ec-a79e-484b-9e9c-e42f8ee9ac5c`.

Base: `0b4e841ca9447373add29c0a62876494a81ecdb8`. Read-only `git ls-remote origin refs/heads/main` confirmed the same current remote SHA before the candidate commit. Latest canonical Product row: `[PO-20261019-1719]`, desktop accepted; mobile horizontal dragging rejected. Earlier horizontal-overflow acceptance is superseded for this result.

## Result

Report filters use two equal flexible columns on screens up to 1100px. The classroom sort field and attendance mode span both columns; dates and actions remain visible with their existing components. The accepted wide row and existing gradebook layout are preserved. Removed obsolete horizontal-drag instructions from the three affected accessible group labels. No date policy, filter calculations, record writes, identity or grade logic changed.

## N119 explanation for the user

في المصدر الحالي، كشف الطلاب وتقرير درجات الفصل الحيّ يستخدمان `displayRoster`: ترتيب أبجدي وأرقام كشف معروضة تصاعدية، مستقلة عن أرقام المصدر والهوية. لذلك «حسب رقم الكشف» يطابق الافتراضي فيهما؛ أزيل الخيار المكرر وأصبح اسم الافتراضي «حسب رقم الكشف (الافتراضي)». لم تتغير الأرقام أو السجلات.

الترتيب «الأعلى درجة» مختلف: يضع الدرجة الأعلى أولًا عند اختياره صراحة. في تقرير درجات الفصل الحالي لا يفرز الافتراضي حسب الدرجة تنازليًا؛ الفحص الفعلي أظهر أحمد أولًا افتراضيًا وبدر أولًا مع «الأعلى درجة». لا يصح تعميم أن الافتراضي يعني أعلى درجة. افتراضي تقرير الدعم مختلف أيضًا: الأكثر حاجة للدعم. أبقينا خيار رقم الكشف في الحضور والدعم والتقارير المغلقة؛ قد تحتوي أرقامًا تاريخية محفوظة أو ترتيبًا افتراضيًا مختلفًا.

Source basis: `src/models.js` `displayRoster`; `src/views/reports.js` `sortRoster`, `reportAttendance`, `supportRows`; `src/views/grades.js` explicit `score_desc` branch. Report sort preference is module-local, not a saved storage preference. Old live `roll` handler values map to the identical default; historical values retain the original explicit ordering branch.

## Affected verification

PASS `node tests/n120-actual-1719/mobile-layout.mjs` — `n120_mobile_filters_no_horizontal_drag_desktop_preserved`.

- Actual application DOM, handlers and source CSS served by task-owned Vite at `http://127.0.0.1:5148`; existing `openReadyServedDemo` helper and small N120 disposable Demo fixture.
- 24 rendered inspections: gradebook geometry only; classroom roster, grades, attendance and support; aggregate grades and followup; execution. Each at 320, 390 and 1440px. No horizontal document/filter-bar overflow; every visible control fits the viewport with dimensions at least 44px. Gradebook logic was not rerun.
- At 1440px each bar remains a single row. Exact geometry comparison against the base stylesheet in the same actual app passed for all eight pages.
- Tiny real actions: roster sort and old `roll` value; explicit descending grade sort and reset; attendance mode and reset; aggregate filter to zero results and reset. Bar geometry stayed stable; measured control geometry stayed identical in the stability checks.
- Fixture students, enrollments, scores, sessions and attendance remained byte-identical after the read-only checks.
- Visual review of attendance 320/1440, aggregate grades 390, execution 320 and gradebook 320 screenshots confirmed readable wrapped controls.
- `node --check` passed for the three changed JS views; `git diff --check` passed.

Raw measurements, actions and PASS: `tests/n120-actual-1719/evidence.json`; screenshots and reproducible check are in that same directory. Existing unrelated owner/Sync/scoring proofs are reused; no full suite or cosmetic build was run.

## Resource disposition and limits

Canonical `withIsolatedLocalBrowser` validated the active synthetic card and run. Fresh owned disposable context; loopback origin only, external requests blocked, Service Workers blocked, no credentials or personal browser. This approved isolated phase does not acquire the shared live-browser lease. Browser/context cleanup and task-owned Vite server closure ran in `finally`; no listener remained on 5148 afterward. The existing app emits Service Worker update/inventory warnings when workers are intentionally blocked; this evidence makes no Service Worker/offline claim.

Local candidate only. No push, provider, Preview, Production, queue/ledger update, live account access or real-data mutation. Independent controller/publisher owns integration and served Production verification; PO acceptance remains separate.
