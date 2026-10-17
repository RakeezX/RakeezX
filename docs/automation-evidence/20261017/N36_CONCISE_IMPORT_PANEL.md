# N36 concise import panel — local candidate

- Task: `continuous-n36-concise-import-panel-20261017`
- Run: `5dd3a7f5-8e42-4522-ba1d-178089675017`
- Base / observed origin/main: `aa6a1843c5102add77d61d1a3777c7916e376bb7`
- Authority: activated PO 17 October 12:48 copy/action cleanup; N36 completeness/save remains OPEN.

The central extension card now has the requested short title, one instruction,
the existing exact 0.5.9 ZIP download as its main action, and a collapsed
three-step installation guide. The manifest button and long technical paragraph
are removed from the normal UI. The ZIP and provenance manifest remain available
unchanged to internal verification tooling. No extension version or runtime change.

## Required checks

| Gate | Result | Actual evidence |
| --- | --- | --- |
| `n36_import_panel_short_useful_copy_and_no_technical_primary_action` | PASS | `node --test tests/n36-concise-import-panel.test.mjs`: actual index/app DOM, router, source CSS and handlers at task-owned `http://127.0.0.1:49447`; fresh isolated Chromium context, Demo fixture using existing `openReadyServedDemo`. Exact short heading/instruction, one ZIP action, no manifest action, collapsed guide opens/closes, export/import tab handlers work, RTL card fits 390px and 1280px widths, zero page errors. Screenshots at both widths visually inspected. |
| `n36_current_verified_download_binding_and_review_controls_preserved` | PASS | Same check fetches actual linked ZIP and manifest over HTTP and verifies archive SHA-256 `562caeb53f91b670d6d8db743046892006c0360fe9f5c2a4ca6b7af66be25d79`. Both assets are byte-identical to base. Exact normalized source comparison proves every line outside static card introduction unchanged, including partial-source notices, owner/term/lease/review/receipts. Existing `node --test --test-name-pattern='0.5.9 exact ZIP' tests/n36-terminal-pager-evidence.test.mjs` passes ZIP/source/per-file hashes, permissions and previous archive preservation. |

`node --check src/views/class-import-center.js` and `git diff --check` PASS.
No existing tests changed; no stale-copy assertion needed amendment in affected checks.
Unchanged transport/account/collection evidence is preserved rather than rerun.
This Demo layout inspection does not certify authenticated transport or source completeness.

Screenshots are temporary local inspection artifacts:
`%TEMP%/continuous-n36-concise-import-panel-20261017-{390,1280}.png`.
Canonical `withIsolatedLocalBrowser` closes owned contexts/browser in finally;
the test closes its own loopback server/connections in finally. No shared live-browser
lease is required for this approved isolated phase. No credentials, real account,
external collector, Service Worker, live mutation, build, push or deployment was used.
The independent publisher owns integration and served Production verification.
