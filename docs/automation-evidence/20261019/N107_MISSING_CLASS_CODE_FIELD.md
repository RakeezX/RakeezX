# N107 — missing class code field feedback, 2026-10-19

- Task: `continuous-n107-missing-class-code-field-20261019`
- Run: `b3a4f494-7079-4175-a6cd-29a95321b1d3`
- Candidate base: `11fa6e069391df8dd85adb60de0e7059bbde2da6`.
- Fresh remote main observed/fetched: `8c46d59a1b3fcbdb368e010f2d5fdb727fc19075`; both affected source files identical to the candidate base before this patch.
- Latest canonical N107 note: PO-20261019-1719, missing class code needs field feedback like grade; reported18 seconds retained without an unsupported speed claim.

## Change

New-class review focuses and marks the class-code input with `aria-invalid`, a linked field message and the existing danger border. Empty/whitespace values show «أدخل رمز الفصل». Provided invalid values show the precise character or length constraint. Correcting the value clears feedback; the existing classGroups/store review validation still runs. Existing destination, mapping, consent, creation and success handlers are unchanged.

## Affected checks

- PASS: `node --check src/views/class-import-center.js`.
- PASS: `node tests/n107-actual-1719/browser.mjs` — required `n107_missing_class_code_precise_field_feedback`.
- Actual app DOM, delegated handlers and source CSS served over task-owned `http://127.0.0.1:49859`, using the canonical isolated browser helper and a fresh390px synthetic context. Existing account fixture, ownership and offline-lease guards retained; no test-only view seam or lookalike page.
- Real CSV upload/review: missing grade still takes precedence; empty and whitespace class code show direct focused feedback; invalid characters and programmatic overlength are blocked at review; native maxlength8 retained; valid code clears feedback and reaches the existing preview/confirm button without clicking confirmation. Synthetic records/grades/outbox snapshot unchanged.
- Computed red border, visible linked error and no horizontal overflow checked. `missing-code.png` visually inspected; `invalid-code.png` and `valid-code-review.png` also retained. Source hashes and actual outcome: [result.json](../../../tests/n107-actual-1719/result.json).
- PASS: `git diff --check`.
- Browser contexts/browser closed by helper finally; task-owned HTTP server connections and listener closed in harness finally. No shared live browser or lease used under the approved local synthetic exception.

## Latency scope and preserved evidence

Inspected only the owned view orchestration: confirmClassImport → save continuation → waitForCreation (event-driven store/Sync/cloud subscriptions and immediate check) → optional maximum ACK → grade confirmation → continuation cleanup/recovery. The90-second timer is an upper bound, not a fixed delay. No concrete redundant wait/ACK scan was established as a cause of the reported18 seconds; no orchestration or durable ACK guard was changed, and no speed improvement is claimed. General latency remains N125. Prior delivered import/data evidence is reused; no old maximum/grade replay, full build or full-app suite.

Local readiness only. No real account/record mutation, service change, push, deploy, Production verification or PO acceptance performed.
