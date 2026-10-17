# N104 responsive toolbars and compact Koshoof export — local evidence

AI-authored implementation, 17 October 2026. Task `continuous-n104-responsive-toolbar-compact-export-20261017`; run `fb2b433b-da40-4f0a-9493-99221d33d6c4`.
Base: `7fb1bd31eab8f1838db71f16e37fc9a57aceae1b`, confirmed against `git ls-remote origin refs/heads/main` during this run. Clean isolated checkout at start. Latest canonical N104/N107/N36 notes and activated card read; no queue, ledger, Auth, schema, router or SW changes.

## Result

- Grades alone uses «استيراد وتصدير الدرجات» with its exact existing class-context href/guard. Students and empty Teaching hub use «إضافة طالب». Scoped CSS groups and wraps existing Students/Classes actions, retaining DOM order, handlers, delete eligibility and 44px targets.
- Export uses an academic-order responsive grid of grade/section/subject labels and selected count. One primary button builds a fresh guarded snapshot and requests every selected independent XLSX. Removed obsolete per-file controls/handler/state/CSS and the three-file limit. Request failures are counted without stopping remaining requests. Status distinguishes requests from saved files and retains a short browser permission hint.
- Optional `filenameClassName` gives the requested short grade/section/subject identity to hub XLSX and Noor CSV filenames; full internal className, year, term, subject and context remain intact. Legacy helper callers retain their existing default naming. Unicode normalization, unsafe-character removal, distinct names/grades descriptions and collision suffixes remain. Workbook engine and bytes are unchanged for the same roster/items/context; no metadata/content was removed or added.
- Noor is a secondary collapsed card with «تصدير كشف نور 40 / 60» (LTR-isolated digits) and «تصدير كشف نور». Math, grouping, confirmation, missing-versus-zero and manual CSV semantics remain unchanged.
- N36 requested title applied. Body deliberately narrows the requested account-update wording to available student names/class data and explicit review/save, matching actual capability. It ends «راجع البيانات وأكّد حفظها في ركيز.» Existing/new file destination help explains no new class versus reviewed names-only class+subject creation/duplicate refusal. Extension ZIP/manifest 0.5.9, link and review/owner protections unchanged; installation guide remains collapsed.

## Affected check mapping

| Required check | Actual evidence |
| --- | --- |
| n104_grades_label_same_route_and_responsive_students_classes_actions | Actual app HTTP DOM/CSS at 320/390/1280: empty/populated Students and Classes; empty hub; paste/manual sheets cancel; exact Grades label and contextual navigation; visible enabled/disabled delete; >=44px targets, no overlap/horizontal overflow. |
| n107_compact_short_class_selection_and_single_bulk_action_all_selected_files | At each width, five distinct owned synthetic classes selected; actual primary click generated five unique XLSX download events. All workbook filenames recorded in browser JSON. Clear selection disables action. Injected one synchronous download request failure still requests the other four and reports 4/5 plus failure. A stale selected term generates zero additional downloads and displays rejection. |
| n107_short_safe_distinct_filenames_workbook_data_and_noor_contract_unchanged | Downloaded source workbook contains its actual synthetic student/19 score/Exam column; other classes do not contain that student. Focused Node checks assert exact requested short name, normalization/unsafe characters/collision suffix, names versus grades, byte-identical workbook outputs, zero/19 values, and Noor 40/60 zero/blank/invalid grouping behavior. Exact source comparison preserves workbook engine, store, Classes handlers, router, ownership/term/import guards and Noor core. |
| n36_direct_madrasati_copy_import_destination_explanation_and_guards | Actual title/body, collapsed guide interaction, one ZIP link, destination help in both modes checked in combined browser run; immutable extension bytes and guard equality checked by Node. Directly stale N36 text assertions updated; its separate browser run reused combined proof rather than repeated. |

Commands PASS:

- `node tests/n104-responsive-export-browser.mjs` — three widths; zero page errors, zero database write transactions after fixture setup, unchanged durable checkpoint, zero synthetic service commits. Actual application and existing restored-account fixture/owner guard, not a lookalike.
- `node --test tests/n104-responsive-export.test.mjs tests/n107-unified-koshoof.test.mjs tests/n105-grade-export-filenames.test.mjs tests/n108-xlsx-export.test.mjs` — 8/8 PASS.
- `node --check src/views/class-import-center.js`, `node --check tests/n36-concise-import-panel.test.mjs`, `git diff --check` — PASS. No full build needed for this bounded client change; publisher owns its build.

Browser results/source hashes/screenshots: `tests/n104-responsive-export-browser.json`; 27 local captures in `test-results/n104-responsive/`. Visually inspected changed Students, Classes, Grades, import, export and Noor pages, including mobile wrapping and desktop grid. Early harness runs exposed an overly broad nested `.class-import-page` locator and assertions racing the existing asynchronous repaint; narrowed locator and waited for actual rendered state. No Product guard was relaxed.

Canonical `withIsolatedLocalBrowser` owned fresh disposable contexts, blocked Service Workers/external requests and closed them/browser in finally. Task-owned loopback port 49144 server closed in finally. No shared live-browser resource acquired; no user browser, credentials, school data or real service used. Synthetic fixture provisioning preceded the zero-write checkpoint.

This is local candidate readiness only. No push, integration, provider deployment, Production evidence, Product closure, complete official school coverage, actual file-save receipt or PO acceptance claimed. The independent controller/publisher owns delivery.
