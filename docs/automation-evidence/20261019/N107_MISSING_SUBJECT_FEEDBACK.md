# N107 — missing subject feedback, PO 19 October 18:37

AI-authored implementation/evidence. Task `continuous-n107-missing-subject-feedback-20261019`, run `d3abf29d-c2fc-4fb2-a426-f53462b2de41`.
Base and observed remote main: `a0490e3e54b11498406bad71c70ab5485920f26e` (`git ls-remote origin refs/heads/main`).

The current canonical Product row records the new actual failure and the remaining actual 18-second confirmation measurement. Earlier accepted work remains accepted; this result covers only the new subject-field correction.

Missing subject now says «اختر المادة» at the select, or «أدخل اسم المادة» at the custom input, with linked feedback, aria-invalid, red border and focus. Invalid supplied values get the short subject constraint. The preflight reuses `subjectSafe` from the unchanged import parser, trims exactly as that parser does, preserves grade/code precedence, and leaves original review/submit validation in place. Correcting either field clears its feedback. Custom subjects remain supported. No backend, grades engine, ownership, session, lease, Sync or confirmation logic changed.

## Affected verification

- `node --check src/views/class-import-center.js`: PASS.
- `node tests/n107-1837/browser.mjs`: PASS, required `n107_missing_subject_precise_field_feedback`; detailed result and tested source hashes in `tests/n107-1837/result.json`.
- Real application DOM/handlers/source CSS served at task-owned `http://127.0.0.1:49863`, fresh 390×900 synthetic context through canonical `withIsolatedLocalBrowser`. Existing account fixture exercises actual account/workspace/ownership/lease guards, actual CSV upload and review/change entry points. No production account or external service.
- Grade then code precedence; missing select/custom/whitespace feedback, focus/ARIA linkage, invalid numeric/overlength value, correction clearing, custom subject reaching original review: PASS. No confirmation click. Database records, scores and outbox unchanged across the check. Red border and no horizontal overflow checked. Both screenshots visually inspected.
- `git diff --check`: PASS. No whole-app build or unrelated suite.
- Owned browser/context and loopback server closed in finally. This eligible isolated local phase does not reserve the shared browser lease.

## Remaining limits

Inspected the actual `class-import-confirm` handler and its `waitForCreation` path only. No explicit redundant fixed wait was found: store/Sync/cloud events plus an immediate check drive readiness; 90 seconds is a maximum deadline, not a fixed sleep. The PO's actual 18-second measurement remains unresolved. No repeated import/performance fixture, new measurement or speed claim.

LOCAL_READY only. No push, deployment, provider verification, Production evidence or Product acceptance was performed; the existing independent controller/publisher owns those steps. No queue, source-card or ledger edits.
