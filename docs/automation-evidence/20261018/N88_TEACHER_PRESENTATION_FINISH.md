# N88 — final teacher presentation (AI implementation)

Task: `continuous-n88-teacher-presentation-finish-20261018`
Run: `7af8a31d-e389-4e1d-aa87-8460a7b402d7`
Base: `207ee9666aadef9bcc609be57cd5b24bf1ab3fb8` — actual remote `refs/heads/main` observed with `git ls-remote` before implementation; isolated HEAD matched. Product source changes are limited to the teacher view and its CSS.

## Review result

One small toolbar, a missing-code primary action, aligned desktop name/code/action columns and two-line mobile rows replace the repeated four-action layout. Current recoverable codes remain visible; normal actions remain **نسخ / مشاركة**. Native **المزيد** disclosures contain change/revoke, retain the existing deliberate confirmation and legacy status, support keyboard activation and Escape returning focus. Empty rosters have contextual text; creating codes is disabled when no never-issued students remain.

**الحقول الظاهرة للطلاب** and **تعليمات المهام وطريقة التسليم** start closed. Their summaries show small authoritative counts. Guidance has one source selector, two labelled textareas, a character counter and one save. Confirmation appears only when both fields are empty. Unchanged guidance cannot be published pointlessly; changed-source republication still requires explicit save. Field drafts survive teacher-panel redraws and explicit save still waits for the authoritative result.

Guidance reads on focus/visible/pageshow are coalesced with context notifications and class reads. They retain per-source drafts and text selection during normal focused reads. Save uncertainty remains per source, including after switching away and back. The UI reads the authoritative state without replaying a mutation, offers one relevant retry/revalidation action, and retains exact revision/source fences. Pagehide, owner/context switch, expiry and unmount remove guidance/code plaintext. Shared class/session/lease/owner guards are unchanged.

## Actual affected verification

`node tests/n88-teacher-presentation.mjs` PASS. The existing fabricated application bootstrap is reused with task-owned ports. This loads the actual application shell/router/store, teacher view, class client, actual ownership guard and source CSS over a unique loopback HTTP server through the canonical isolated-browser helper. The transport is synthetic; this does not claim a hosted service or student activation test.

- Native menus: keyboard/Tab/Escape/focus; legacy change confirmation/cancel and revoke confirmation; exact name/code/universalURL/instructions for explicit copy/share.
- Field draft retention and explicit save; initially closed disclosures; guidance draft selection, conditional clear, confirmed empty save and no-op prevention.
- Coalesced return reads; before-commit failure and lost after-commit ACK; no mutation replay; exact stale-source/revision review; contextual read failure; delayed stale-context response, actual owner denial, pagehide, expiry and route unmount.
- Six fresh 390/698/1280 light/dark contexts, each captured compact/menu/expanded. All visible controls have 44px targets; names wrap fully, codes retain six ASCII digits without clipping, and the document has no horizontal overflow. Screenshots mask code inputs/manual messages. Final compact/editor/menu images were visually inspected; the composition uses existing brand/type/tokens without an added header.

Review images: [390 light compact](../../../tests/fixtures/n88-teacher-presentation/390-light-compact.png), [698 light compact](../../../tests/fixtures/n88-teacher-presentation/698-light-compact.png), [1280 light compact](../../../tests/fixtures/n88-teacher-presentation/1280-light-compact.png), [390 dark editors](../../../tests/fixtures/n88-teacher-presentation/390-dark-editors.png), [698 dark menu](../../../tests/fixtures/n88-teacher-presentation/698-dark-menu.png), [1280 dark editors](../../../tests/fixtures/n88-teacher-presentation/1280-dark-editors.png).

Original sanitized failed attempts are retained in `tests/n88-teacher-presentation-failure-*.json`. They record a missing wait for the scheduled return read, the actual duplicate-read defect (fixed by coalescing while a read is active), a caret assertion mixed with whole-shell pageshow reparenting, and a reload harness attempting to click a teaching link after already returning to the class route. Final normal-focus caret, pageshow draft and reload/unmount checks pass without weakening Product guards.

`node tests/n88-teacher-presentation-scope.mjs` PASS: scoped syntax, `git diff --check`, allowed paths and exact source hashes. Eight unchanged delivered proof files are SHA256/base-blob matched, covering guidance/nativePG/source/CAS, Auth/owner, grade projection, recovery/crypto and shared-network/35-student safeguards. Historical nativePG proof is retained as history alongside the later integrated/guidance proofs; nothing was requalified or expanded here. The report records all 18 image hashes and source hashes.

## Disposition

Owned browser contexts/engine and loopback server closed; integration phase lease released in `finally`. No build, hosted mutation, real send, service/SQL/Auth change, push or deployment was performed. `PORTAL_READINESS` remains OFF. Candidate source is ready for the independent controller/publisher and subsequent same-source integrated review. The dependent activation lane must refresh final source metadata and complete its own actual service prerequisites; this result does not enable official access or claim Production/PO acceptance.
