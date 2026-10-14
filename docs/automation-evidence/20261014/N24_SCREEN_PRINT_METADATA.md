# N24 screen and print metadata evidence

Candidate scope: report print foundation and report presentation CSS. The local synthetic fixture uses the real report app, event handlers, styles, and generated Chromium PDFs over a task-owned loopback HTTP server. `tests/n24-fixture.mjs` seeds synthetic values only; no teacher or student account was used.

## Results

- `node tests/n24-render.mjs grades` — PASS for short (1 page) and multi-page (5 pages) grade reports. The rendered A4 preview DOM has centered title/metadata/signature cards/footer; the timestamp sits at the physical left within the existing details block. Print media assertions confirm centered signature roles/names and title, physical-left timestamp, and the same footer link.
- `node tests/n24-render.mjs detailed` — PASS for short (2 pages) and multi-page (12 pages) detailed attendance output; same alignment assertions pass.
- `node tests/n24-render.mjs mobile` — PASS at 320px and 390px across the existing eight report surfaces. Its 390px grade A4-preview assertion confirms centered footer and `https://rakeezx.com/` link.
- `node tests/n24-render.mjs scopes` — PASS for real report sort order, historical date range selection (2026-08-03 through 2026-08-05, selecting the three matching sessions), date adapter, and cross-class report search/reset. Student links remain unchanged; the brand URI is intentionally outside the student-link selector.
- Generated PDF inspection — PASS. The short/multi-page grade and detailed PDFs were rendered with Poppler and their first and last pages visually inspected. Final rows and signature cards are visible without clipping; content remains inside the page. The 5-page grade PDF has exactly one `/Subtype /Link` annotation with `/URI (https://rakeezx.com/)`; the annotation contains no account/class data or query string.

## Browser-generated print decoration

The app print button and confirmation handler were exercised; PDF layout was generated from that actual report DOM. Chromium's automated PDF route does not establish a user's `window.print` dialog default. Chrome's [print margins documentation](https://developer.chrome.com/blog/print-margins) says browser-generated URL/title/date headers and footers appear when there is room and can be disabled in the print dialog; reducing margins enough can suppress them but changes pagination. The existing A4 margins (12mm portrait, 10mm landscape) remain because the tested multi-page output has clean margins and no clipping. For a clean user print, turn off **Headers and footers** in the print dialog. No browser policy, personal setting, or machine configuration was changed.

The preview and saved PDF include the centered clickable brand. Browser-added print-dialog decoration remains controlled by the user's browser option; page CSS does not claim to override it.
