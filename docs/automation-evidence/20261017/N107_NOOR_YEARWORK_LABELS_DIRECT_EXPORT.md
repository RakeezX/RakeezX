# N107 — Noor labels and direct explicit export

AI-authored local implementation for task `continuous-n107-noor-yearwork-labels-direct-export-tabs-20261017`, run `027e8234-1194-46ab-acdb-c3b6385fc289`.
Base/current remote main observed through `git ls-remote origin refs/heads/main`: `cced9c6f4b6db4ed0de4a63ba3dcc30359407767`.

Before: generic 40/60 group labels, block maximum, an additional confirmation checkbox/help paragraph, transparent inactive tab. After: exact approved yearwork/exam summary/options/dynamic totals, inline name/maximum, explicit export button supplies confirmation for current selections, clearly surfaced inactive tabs with explicit aria-pressed true/false. CSV core validation and import/owner/Sync logic are unchanged.

## Affected verification

- `n107_noor_exact_yearwork_exam_labels_inline_max_and_visible_responsive_tabs`: PASS. Actual application DOM/handlers/source CSS served at owned http://127.0.0.1:49737 with the established synthetic account fixture. Inspected screenshots at 320/390/1280 and dark 390: full summary, inline participation/max without truncation, one item list, long options legible, dynamic LTR totals, equal >=44px tabs, visible inactive background/border, keyboard focus and no document overflow.
- `n107_noor_direct_explicit_export_current_payload_and_invalid_totals_refusal`: PASS. Three actual browser download events/CSV Blobs: valid original selection, restored selection, then changed assignments changing a CSV group value from 7 to 0. Deselecting an item disables its group and refuses download; missing group and over/wrong totals also refuse with actual alert. No export on selection changes; no store changes or grade service writes.
- `node --check src/views/class-import-center.js`, test harness syntax and `git diff --check`: PASS.

Run: `node tests/n107-noor-yearwork-labels-browser.mjs`. Machine evidence: `tests/n107-noor-yearwork-labels-browser.json`; images: `tests/fixtures/n107-noor-yearwork-labels/noor-{320,390,1280}.png` and `noor-dark-390.png`.

The first rendered development check caught an empty inactive aria-pressed from boolean template interpolation; explicit strings fixed it. A focus harness assertion was corrected to enter keyboard modality before checking :focus-visible. Neither failure was a mathematical/export rejection waived by the harness.

Reuse: prior `tests/n107-readable-mapping-noor-browser.json` retained intact. Its hash and unchanged review/confirm/mapping/extension functions plus exact CSV/import/store core hashes are recorded in the new JSON. No whole-import, 28/300-student, Sync/Auth or N36 rerun. Only product source paths changed are view/CSS; no backend, router, SW or extension changes.

Isolation: canonical withIsolatedLocalBrowser, fresh disposable contexts, explicit loopback origin, external requests blocked, Service Workers blocked. This approved isolated phase requires no shared browser lease. Contexts/browser and owned server closed in finally. No personal browser/live data used. Local readiness only; no push, deployment or Product acceptance claim.
