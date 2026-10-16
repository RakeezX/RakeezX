# N109 — content-fitted Excel dimensions

AI-authored implementation/evidence. Task `continuous-n109-content-fit-excel-20261016`, run `f41909b0-bb81-4199-9723-897baedb8533`.

Base: `f3014b1f60cfa56e1f8578aa9817917c884031e3`. Read-only `git ls-remote origin refs/heads/main` confirmed that exact current remote main during this run. The activated card and current canonical N109 ledger row authorize only this client export formatting follow-up.

## Change

Each column scans all exported values, including the header, using deterministic Arial 11 digit-width estimates. Arabic characters, combining marks, wide/narrow Latin characters, header bold, explicit line breaks and tabs contribute appropriately. Widths round upward to quarter units with two units of padding, minimum 4 and maximum 36. Empty cells contribute no extra width; zero remains numeric. Long headers/names wrap with the existing RTL alignment and wrap styles.

Each row uses its largest estimated word-wrapped cell line count: 15 points per line plus 3 points padding, with an 18-point single-line row. Explicit CR/LF line breaks and unbroken wide words are covered. Text exceeding Excel's 409-point row limit raises a clear Arabic error rather than silently clamping/clipping. This intentionally rejects pathological over-tall text; stored data is untouched.

Actual generated example (two synthetic students: short علي and the long N108 Arabic name; short أ and long Arabic task headers): column widths **36, 17, 36**; header / long-name / short-name row heights **48, 48, 18** points. Short-only fixtures have every column below 24 and both rows at 18 points. Widths respond independently to a longer name or one longer heading; blank versus numeric score cells do not inflate dimensions.

## Verification

`node --test tests/n109-excel-content-fit.test.mjs tests/n108-xlsx-export.test.mjs`: **6 tests PASS, 0 FAIL**.

- `n109_content_based_per_column_width_without_waste_and_no_clipping`: generated OOXML column widths vary independently with contents and stay bounded; wrapped long header height grows, empty class and blank template remain compact.
- `n109_per_row_height_short_rows_compact_and_long_wrap_readable`: generated row heights cover short rows, long Arabic names, three explicit lines, unbroken wide Latin text and Arabic diacritics. Over-tall content is explicitly rejected.
- `n109_arabic_RTL_header_name_scores_zero_blank_formula_safe`: actual workbook parsed by the existing application `readSheet` reader; RTL/frozen header/wrap preserved, escaped Arabic entities and literal formula prefixes read back as strings, no formula or external/macro content, numeric zero distinct from null blank.
- `n109_xlsx_roundtrip_300_rows_noor_csv_unchanged`: all 301 rows and every cell roundtrip against the existing export projection, 299 ordinary rows remain 18 points, long header/name rows grow, deterministic bytes and six-part OOXML ZIP retained. Existing N108 tests separately pass independent CRC validation and exact manual Noor 40/60/CSV injection, zero, blank and filename checks.
- `node --check src/lib/grade-transfer-xlsx.js` and `git diff --check`: PASS. Candidate scope contains only the four activated paths.

These are workbook/OOXML and parser checks, not a rendered application UI or native Excel visual PASS. Font substitution and viewer typography can differ from deterministic estimates; the exporter uses conservative estimates with padding. No new UI/browser/server phase was needed or opened. The unchanged N108 application entry, downloads, touch, filenames and offline shell evidence is recorded in `docs/automation-evidence/20261015/N108_READABLE_XLSX_KOSHOOF.md` and `tests/n108-xlsx-export-browser.json`; this run does not reassert those as fresh checks. No startup dependency, selection, download handler, CSV/Noor source, ZIP writer, scoring, store, owner or service changes.

Exploratory dimension-printing commands initially had a PowerShell quoting error, an incomplete synthetic ctx, and a greedy diagnostic regex that captured customHeight instead of ht. Corrected read-only probe produced the dimensions above. The committed tests use complete synthetic contexts and anchored row attributes; all acceptance tests passed on their first execution.

No push, Preview, provider operation, deployment, real data or queue mutation was performed. The independent controller/publisher owns subsequent integration and served Production evidence; local readiness does not claim Product acceptance.
