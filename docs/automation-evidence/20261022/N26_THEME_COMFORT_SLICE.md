# N26 theme comfort slice — 2026-10-22

Scope: synthetic local Chromium comparison of the actual Rakeez app at `http://127.0.0.1:4178/`; no account, remote service, Sync, or real student/teacher data was used. The application Demo workspace generated its fabricated teacher, classes, schedules, attendance, and grade data.

## Finding and correction

The existing light-theme `--text-3` value `#64748b` on page background `#f4f7f5` measured **4.41:1**. This is below the 4.5:1 AA target for normal text and the same token is used for muted and disabled control text. The smallest central-token adjustment was `#607087`, which measures **4.67:1** against the unchanged page background. Dark theme remains `#94a3b8` on `#0d1511` at **7.23:1**. Other sampled ratios remain: primary text 14.27:1 light / 16.37:1 dark; secondary text 9.60:1 / 8.16:1; accent label 5.20:1 / 12.54:1.

Rendered Home, Teaching Hub, and Settings states retained the same scroll heights before and after at both viewport sizes; no horizontal overflow was observed. Surface hierarchy and card separation were clear in the captured renders. Keyboard Tab focus remained visible with a 2px solid outline and the 4px focus halo. The Settings theme controls selected and rendered each requested theme; Home's N48 quick-theme control switched and restored each theme successfully.

## Evidence

- `tests/n26-theme-comfort-20261022/before/measurements.json` and `before/*.png`: actual app DOM, CSS, and handlers before the token adjustment.
- `tests/n26-theme-comfort-20261022/measurements.json` and `*.png`: the same 12 representative states after the adjustment. The JSON records viewport, theme, hierarchy, rendered token values, contrast, focus, scroll dimensions, and quick-theme result.
- `tests/n26-theme-comfort-20261022/theme.mjs`: bounded isolated browser check using `withIsolatedLocalBrowser` and the real application Demo.

## Limits

Chromium local evidence only; it is not Safari/iPhone proof, PO visual acceptance, or closure of N72 or the wider N26 direction. No deployment or served-CSS check was performed by this worker.
