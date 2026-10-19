# N120 — report-specific filter options

AI-authored implementation, 2026-10-19. Task `continuous-n120-report-specific-filter-options-20261019`, run `1a69fc7e-f539-4339-9046-7e36101784b7`.
Base: `98885befd4f13c02210661309a4add21e04c72ca` (also observed by `git ls-remote origin refs/heads/main` before edits).

## Actual affected-path diagnosis

The local HTTP app replayed the three affected immutable base files in a fresh synthetic Demo context, using the existing readiness helper and canonical isolated browser helper. The baseline confirmed:

- Students report offered grade and absence sorting even though those values are absent from that document.
- Attendance ignored the selected absence ordering: on 2026-09-02 Badr was absent, but Ahmad stayed first when “الأكثر غيابًا” was selected.
- Execution report had no unified report filter bar.

The actual report DOM/handlers/CSS were used; no substitute page or live account was used. Baseline observations are retained in `tests/n120-feedback-1532/evidence.json`.

## Exact options for PO review

| Existing section | Options after this change |
| --- | --- |
| تقرير الفصل — الطلاب | الترتيب الافتراضي (السجل)، أبجديًا (اسم الطالب)، حسب رقم الكشف |
| تقرير الفصل — الدرجات | الترتيبات السابقة، الأعلى درجة، الأقل درجة |
| تقرير الفصل — الحضور | الترتيب الافتراضي (السجل)، أبجديًا (اسم الطالب)، حسب رقم الكشف، الأكثر غيابًا **داخل الفترة المختارة**؛ من/إلى، موجز/تفصيلي |
| تقرير الفصل — من يحتاج دعمًا | الأكثر حاجة للدعم، أبجديًا، حسب رقم الكشف، الأعلى درجة، الأقل درجة، الأكثر غيابًا |
| جميع الفصول — الدرجات | الفصل الدراسي، الصف، الفصل والمادة، حالة الرصد (كل الحالات/درجات مرصودة/رصد غير مكتمل)، بحث عن طالب |
| جميع الفصول — طلاب يحتاجون متابعة | الفصل الدراسي، الصف، الفصل والمادة، سبب المتابعة (كل الأسباب/الدرجات دون 50٪/غياب متكرر/لا مشاركة مرصودة/لم يُرصد له شيء)، بحث عن طالب |
| جميع الفصول — الحصص والحضور | الفصل الدراسي، الحالة (كل الحالات/لم يُرصد الحضور/تم رصد الحضور/مجدولة/غير مطلوبة)، الفصل والمادة، من/إلى |

Class reports retain the A4 preview action. All report bars expose “مسح التصفية”. Class reset clears ordering and, only in attendance, dates/detail mode; it retains the selected tab and preview. Switching class-report tabs resets ordering, preventing an invisible inapplicable sort. Re-entering the report initializes state before its first paint. Aggregate reset retains the selected term and clears grade/class/reason/search; execution reset retains the term/archive context and clears status/class/dates. Execution summary explicitly remains the existing whole-term summary; filters affect the details and existing export/print path.

The report-only CSS modifier keeps one RTL row with horizontal scrolling when needed, 44px controls, a focusable named overflow group and keyboard-reachable controls. Shared gradebook selectors/handlers/geometry were not edited. Existing date adapter attributes and ISO values remain in use, with historical bounds for class attendance and planning bounds for execution.

## Affected verification

`node tests/n120-feedback-1532/report-options.mjs` — PASS (`n120_report_context_options_semantics_and_stable_compact_bar`).

- Actual app at task-owned `http://127.0.0.1:5134`, disposable isolated contexts, external requests/Service Workers blocked by the canonical helper.
- Baseline reproduction, exact per-tab option lists, roster/grade/support ordering, attendance ordering for two distinct date ranges, detailed attendance and downloaded CSV ordering.
- Both aggregate contexts and reason filtering; execution pending/completed/future/excluded status filters, class/date selection and scoped reset.
- At 1440 and 390px: one row, RTL, no page overflow, minimum 44px controls, keyboard access across horizontal overflow, and unchanged bar position/size across affected filter changes. Eight screenshots saved alongside the evidence JSON; representative wide/narrow images visually inspected.
- Scores, attendance, sessions and enrollments compared before/after report interactions: unchanged.
- JavaScript syntax for the three changed views and `git diff --check`: PASS. No full build or unrelated suite was run.

Existing accepted gradebook/quick-score geometry evidence (`tests/n120-1019-stability.json`) is retained and not rerun. No store, grade calculation, owner/lease/revision guard, Sync, schema, service or real data operation was changed.

Harness corrections are explicit: the first draft read a tab before repaint completed; another same-hash navigation did not remount the report. Those waits/navigation were corrected. A row-count assertion initially included the existing print-only signature row, first with a generic tbody selector and then with a table selector that still included that row. The retained `harness-failure-before-selector-correction.json` records the failure; the final selector excludes only `.report-ending-row`, preserving the exact expected data-row counts. These were harness defects, not converted Product failures. The baseline Product defects remain recorded separately. The synthetic section fixture now uses the existing `label` field.

The owned Vite server closes in finally and the canonical helper closes its disposable browser/contexts. No shared live browser lease was needed for this authorized isolated synthetic phase. No push, deployment, provider proof or PO acceptance is claimed; the independent controller/publisher owns delivery.
