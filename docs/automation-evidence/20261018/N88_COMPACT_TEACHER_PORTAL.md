# N88 — compact teacher portal (AI implementation)

Task `continuous-n88-compact-teacher-portal-20261018`, run `a2cc5ee3-395f-456f-a814-6ea5cd0e4080`.
Base: `859de68d4e3368b2b42e52540da4a9aa7647926d` (HEAD, origin/main and remote main observed at intake). Latest canonical N88 PO18October15:29 note and activated card govern this teacher-only change.

Only Product view/CSS changed. The existing appbar supplies the title; the section has one short purpose line, exact «إنشاء الرموز» and «نسخ / مشاركة / تغيير / إلغاء» actions. Native RAKEEZ tokens, RTL, readable six-digit inputs, 44px controls, accessible student-specific names and a native keyboard-accessible field disclosure replace the repeated headings/help/counters. Legacy hash-only recovery remains explicit; selective change/revoke still require confirmation and explain invalidation of the old code/sessions. Copy/share text retains the exact name, current code, universal URL and instructions; user-triggered manual fallback also covers absent/cancelled share and synchronous clipboard failure.

Mount, pageshow, visible focus/visibility, subscribed roster/context changes and successful commit read back authorized state. A 40ms event coalescer and one active read/mutation prevent parallel reads, loops and automatic write replay. Generation/current-context fences discard stale responses; pagehide, session expiry, lease/owner invalidation and unmount wipe plaintext. Unknown ACK and actual read failure disable writes and expose one contextual «مراجعة القائمة». Postcommit read failure does not infer readiness. Returning during a pending read queues one fresh read after invalidation.

The actual shell repaints the route on pageshow/visibility. Keeping the same teacher section instance on same-route repaint preserves in-flight operations, disclosure and unsaved selections; route unmount still disposes it. Same-context drafts survive copy feedback/automatic reads. A changed policy revision discards them with an explicit explanation. Saving remains an explicit six-field policy/roster CAS operation, with validated ACK and refetch; focus never saves.

## Actual affected checks

- `node tests/n88-compact-teacher.mjs` — PASS, required three named gates in `tests/n88-compact-teacher.json`.
- `node tests/n88-compact-teacher-recovery.mjs` — PASS, additional keyboard, same-context subscription/policy revision, absent-share, failed postcommit read, pending-read pagehide, unmount, session-expiry and real offline-lease guard edges in its JSON.
- `node tests/n88-compact-teacher-scope.mjs` — PASS, exact proof hashes and unchanged protected graph; report in its JSON.
- `node --check` for teacher view and new fixture/test modules; `git diff --check` — PASS. No new Product imports, startup dependency or build needed.

Fresh isolated installed Chromium contexts used a task-owned loopback HTTP server and the ACTUAL existing app shell, router/class route, account store, current owner/lease dispatch guard, teacher module, client ACK/CAS validation and source CSS. The task-only server reuses the existing fabricated account bootstrap read-only and injects fabricated client/context/clipboard/share ports at composition; it does not replace the Product DOM with a dashboard or exercise a backend. The actual shell redraw exposed draft loss, fixed in the teacher route lifecycle.

Six masked screenshots in `tests/fixtures/n88-compact-teacher/{390,698,1280}-{light,dark}.png` were visually inspected: readable long Arabic name/row actions/settings, native identity, no clipping or horizontal overflow, light/dark tokens. Geometry checks verify 44px controls and unclipped code inputs; keyboard disclosure/focus is exercised. Settings are opened in screenshots to inspect all six controls; closed state keeps the roster visible. Codes/manual delivery are masked and omitted from reports/logs/URLs/storage. No personal browser, actual clipboard/native share/send, external requests or Service Workers. Owned browser/contexts/server closed in finally; integration phase lease released by its owner (`RELEASED integration` in reports).

## Reused delivered H security evidence — not rerun

| Path | SHA256 |
| --- | --- |
| `tests/n88-six-digit-recovery.json` | `9fd5fddb9a2a7961dc0b93d0f173adb734b939233435d268bc0ac51d8d2d7407` |
| `tests/n88-six-digit-recovery-context.json` | `4feae5ee381241697439bb9be6576a23e97c2f2ef5a7d7ceaf290616e0597f79` |
| `tests/n88-six-digit-shared-network.json` | `64f12a375cb5d0960ab73133605f6146749033be63b3c0c74869fba38b341a99` |
| `tests/n88-six-digit-shared-flood-window.json` | `185c96dd0b69d1e9ca1e2f89bba5ba1290d3da206c8f1f49464f07450fe30418` |
| `tests/n88-six-digit-security.json` | `27289091e104a6a49816c2166a4c355d44bd78dee2661cc46cca41000da18122` |

All five current files match the supplied hashes. Base H view/CSS CRLF hashes match `e4e97af5b905fce53e3e8bbf3db16366ebaf6f77ce1acf036eee94a0e0cdca0a` / `32b4304913f3705f05cda783c62d7c188be1b61ef7e80d594917122c3c555602`; Git LF blobs have different expected byte hashes. These certify the input, not this edited UI. No client helper change was needed. Client/runtime/owner/store/security/backend/SQL/student/startup/router/SW/shared fixtures/activation graph remains identical to H base; the scope check verifies this. Encrypted recovery, missing-only batch, selective CAS/ACK, flood/guess controls and student projection proofs are reused unchanged.

Original timestamped failure JSON files remain: occupied integration phase, incomplete empty-roster boot fixture, and actual same-route draft-loss regression (including safe diagnostics). `tests/n88-compact-teacher-initial-cleanup-failure.json` preserves the initial checkpoint-sharing cleanup collision whose earlier UI result was not retained; no PASS is inferred for it. Corrections preceded the later PASS results.

Source-only inactive candidate; readiness/live switches remain OFF. Hosted service/Auth/SQL/real student access, Production deployment and PO acceptance were not exercised or claimed. Independent controller/publisher owns integration and delivery; no queue, ledger or activation edits and no push/deploy.
