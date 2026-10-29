# N142 — closed grades sort Arabic labels

- Task: `continuous-n142-grades-filter-text-clip-20261029`
- Run: `9c9d5589-6878-49d6-a562-448618b9b407`
- Base: `69db3dc89e7b8e7717f526cca9d5f6d6c52c3ee5`
- Scope: only `.grades-01c__sort .select` in `src/styles/components.css`, plus the focused check and this record. AI-authored change. No grades JavaScript, scoring, exports, store, or N138 code changes.

## Correction

The toolbar's fixed height combines with the global select's 12px block padding and the later 44px minimum, constraining the closed label's line box. The local rule now uses automatic block size, 8px block padding and 1.6 line height while retaining the 44px minimum. Logical inline padding remains unchanged (32px at the arrow). Replacing the existing local background shorthand with background-color preserves the global select arrow gradients, previously reset by that shorthand. No global select rules changed.

## One focused verification pass

Command: `node --test tests/n142-grades-sort-label-visual.e2e.mjs`

Result: **PASS**, 1 test, 0 failures, about 21 seconds. Actual app served by task-owned Vite at `http://127.0.0.1:53142`; existing served-demo readiness helper and canonical isolated-local-browser helper; fresh Chromium context, Arabic locale, RTL, device scale 2. Synthetic Demo only, no credentials or remote service access; Service Workers blocked. The helper closes its owned contexts/browser and the test closes the Vite server in finally. This eligible isolated phase does not reserve the shared live-browser lease.

| Check | Result | Evidence |
| --- | --- | --- |
| `n142_grade_sort_select_full_arabic_descenders` | PASS | Actual change handler exercised for أبجديًا / الأعلى درجة / الأقل درجة at 320, 390, 768 and 1280px. All 12 closed-state screenshots inspected visually: complete dots, marks and descenders; arrow visible and separate from label. Measured content height 26px, line height 22.4px and actual canvas ink height 17px for each label. |
| `n142_320_390_768_filter_layout_no_overflow` | PASS | Same pass includes desktop 1280px. Select height 44px throughout; widths 263 / 325 / 275.15625 / 373.15625px respectively. No page overflow (scrollWidth minus clientWidth = -15px), select bounds inside viewport, text width below available width and 32px arrow padding preserved. Tab then Shift+Tab returns keyboard focus to the select in all 12 states, with visible focus ring in screenshots. |

Local screenshot directory: `C:/Users/Abody/AppData/Local/Temp/rakeez-n142-DE0Qhq/`. Files: `{320,390,768,1280}-{default,score_desc,score_asc}.png` (12 PNGs). These are actual app toolbar captures, not replacement markup. Canvas ink measurements supplement their visual inspection; they alone are not the visual proof. Font stack is the existing Thmanyah Sans / IBM Plex Sans Arabic / Noto Sans Arabic / Segoe UI / Tahoma / Arial stack; this records the installed Windows Chromium rendering, not physical-device or all-engine certification.

Expected console warnings report blocked Service Worker registration/update/inventory in the isolated context; no Service Worker/offline acceptance claimed. No unrelated suite or full build run. Source-scope inspection confirms N138 functional code unchanged. Production CSS delivery and verification are NOT_RUN by this worker and remain with the original independent publisher. Product closure/PO acceptance not claimed.
