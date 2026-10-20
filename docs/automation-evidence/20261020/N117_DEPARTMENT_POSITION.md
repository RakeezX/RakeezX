# N117 — required department field position

- Task: `continuous-n117-signup-department-field-position-20261020`
- Run: `8753ad99-b386-4c7c-864c-05734034c027`
- Base / observed origin/main: `01940ee3a6fe0f4c79e0ad50c9209662a7ef7517`
- Authority: latest N117 Product row, PO actual acceptance at 13:36 Riyadh, conditional on this field-order correction and sole-publisher verification.

Moved the existing department field intact from after school to immediately after phone and before the teacher choice. No field attributes, text, directory, mapping, persistence or event handlers changed. Applied migration `20261020090836` was not accessed or repeated.

## Affected inspection

`n117_department_immediately_after_phone_before_teacher_choice`: **PASS**. Actual application renderer, its bound handlers and source CSS served at task-owned `http://127.0.0.1:19927`, using the canonical `withIsolatedLocalBrowser` helper and a fresh disposable context. A temporary in-memory Vite transform exposes the existing renderer instead of invoking `boot()`; no repository test or instrumentation was added, and no Auth/OTP/profile submission/service journey ran.

| Viewport | Phone bottom | Department top–bottom | Teacher choice top | Adjacent DOM fields | Horizontal overflow |
| --- | --- | --- | --- | --- | --- |
| 320 | 410.80 | 426.80–531.14 | 547.14 | PASS | none |
| 390 | 410.80 | 426.80–531.14 | 547.14 | PASS | none |
| 1280 | 414.41 | 432.41–536.75 | 554.75 | PASS | none |

Required selection remains true, 48 options include the empty prompt and unchanged 47 departments; the existing hint and 12px input border radius remain applied.

Initial inspection setup preserved: waiting for `[data-workspace-login]` timed out after 30000ms under Vite development boot. That was a harness-readiness failure, not a field-order PASS. The corrected inspection invokes only the actual existing renderer and does not depend on the unrelated boot/landing path. Both invocations closed their owned browser/context and HTTP server in finally. No security denial, shared browser attachment or shared lease was involved in this isolated local phase.

`node --check src/app.js`, `git diff --check`, and exact block-move parity: **PASS**. No build or new test suite; unchanged service/OTP/provisioning proofs are reused. No push, frontend deployment, queue/ledger edit or claim of Product closure. Sole publisher verifies the served position; controller owns the authorized lifecycle transition.
