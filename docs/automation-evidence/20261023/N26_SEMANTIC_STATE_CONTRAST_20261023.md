# N26 semantic-state contrast — 23 October 2026

Task: `continuous-n26-semantic-state-contrast-20261023`

Run: `996fc5a8-ec58-4d71-837d-064d294d54bb`

Base: `4ee4608c3a043f8ff27fd1c90d0ba652bc7e558b`

## Actual failure and bounded correction

The actual application was served at `http://127.0.0.1:4187/` using installed Vite and the canonical `withIsolatedLocalBrowser` helper. Each state used one fresh disposable Chromium context, the actual Demo workspace/store, Settings theme handlers, toast and confirmation helpers, Archive information action, and Attendance view/handlers. No lookalike markup, real account, external service, live data or shared personal browser was used.

Computed foreground/background measurements reproduced white ink on bright dark-mode toast and hover fills. Attendance already had an automatic-dark rule, contrary to the initial source lead, but its root-selector specificity overrode the newer soft-surface attendance text in **both** dark modes. Light excused/absent selected labels also failed 4.5:1.

The existing theme blocks now pair solid status fills with `--status-ink` (existing white/light and `#0a0d10`/dark ink). Base selected segment controls consume that token instead of a higher-specificity theme override. The current soft-fill attendance controls use existing `--text`. Status labels, selected semantics and colored backgrounds remain intact. No palette/background, dimensions, navigation, JavaScript, data handler, grade or N48 behavior changes were made. Accepted light `--text-3: #607087` is unchanged.

| Actual state | Before | After |
| --- | --- | --- |
| Dark danger / warning / info toast | 2.766 / 1.669 / 1.803 | 7.043 / 11.670 / 10.803 |
| Dark danger / info hover | 2.766 / 1.803 | 7.043 / 10.803 |
| Dark selected attendance, four statuses | 1.197–1.356 | 12.682–14.368 |
| Light selected attendance, four statuses | 3.953–4.567 | 12.604–14.020 |
| Light danger / warning / info toast | 4.829 / 5.022 / 5.169 | unchanged |

Explicit dark over light OS and automatic dark over dark OS produced the same passing pairs. Forced light over dark OS matched light. A 390px dark mobile guard and 1365px desktop states passed without horizontal overflow; before/after row document bounds, page height and affected control dimensions matched exactly. Every measured affected text pair passed 4.5:1. Keyboard focus outlines on the confirmation and attendance controls, urgent/polite toast semantics, confirmation cancellation and all four attendance selection handlers remained functional. No application page errors occurred.

## Reproducible checks and evidence

- `node tests/n26-semantic-state-contrast-20261023/outcome.mjs --baseline`: reproduced failures on the unmodified base; retained in `baseline.json`. Do not overwrite this baseline with corrected-source measurements.
- `node tests/n26-semantic-state-contrast-20261023/outcome.mjs`: PASS, five fresh actual-app states, computed ratios in `measurements.json`, paired palette/background/geometry assertions and focus checks. Candidate screenshots cover attendance in all five states plus dark status toasts and hovered actions. Screenshots were inspected for readability and layout.
- `node --check tests/n26-semantic-state-contrast-20261023/outcome.mjs` and `git diff --check`: PASS.
- Reused unchanged [12 representative Home/Teaching/Settings proofs](../20261022/N26_THEME_COMFORT_SLICE.md) and `tests/n26-theme-comfort-20261022/measurements.json`; no new Home/theme survey or full suite/build.

The helper blocks Service Workers and off-origin requests and closes owned contexts/browser in finally. This purely local isolated phase is exempt from the shared live-browser lease. The test owns port 4187 and closes its Vite server in finally. No shared locks, queue/status or unrelated processes were changed.

This is scoped local Chromium evidence, not Safari/device certification, deployment, Production verification, PO acceptance or closure of N26. The independent controller/publisher owns integration and served-asset verification; no push or deployment was performed here.
