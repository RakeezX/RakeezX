# N36 final receiver journey — synthetic PASS

Task: `continuous-n36-final-receiver-journey-20261018`

Current run: `006e830c-a452-47e6-8a89-358ca35024b8`

Base: `f2395c4841db30fb29e5908fe30e6154a925116a`. Observed `origin/main`: `faa3cd5c32895148d5220ec9b34dd3f07a82cb5e`; affected app, extension, store and Sync sources are identical. The candidate contains inert tests/fixtures/evidence only. No Product defect was observed, no extension patch was needed, and N107 is unchanged.

## Completed result

The actual extension controller selected each source class and sent its exact rows through the actual worker, shared protocol, origin-bound handoff, real Koshoof route and receiver UI. Each transfer required partial-coverage approval, an explicitly selected existing owned class/material, source-to-section mapping, names preview and explicit save confirmation. Claim, selection and preview left every database store unchanged.

| Source class | Selected and saved | Normal Sync ACKs |
| --- | ---: | ---: |
| خامس1 | 28 | 56 |
| خامس2 | 28 | 56 |
| خامس3 | 29 | 58 |
| خامس4 | 28 | 56 |
| خامس5 | 30 | 60 |
| خامس6 | 28 | 56 |
| خامس7 | 29 | 58 |
| خامس8 | 31 | 62 |
| سادس6 | 34 | 68 |
| سادس7 | 38 | 76 |
| Total | 303 | 606 |

The actual store persisted 303 new students and 303 enrollments. The real Sync V2 engine, using its default database/transport and runtime ownership guard, dispatched actual durable owner-bound commands and reconciled canonical responses from the fabricated network service. Parent student acknowledgement preceded dependent enrollment. Every saved row had a positive reconciled server revision with no pending-create flag; the actual Outbox was empty. Exact per-class names and memberships matched their selected payload, no unselected rows appeared, and all other DB stores, including grades, remained unchanged. Ten independent transfers exceeded 300 in aggregate without loss; the protocol's 300 limit remains per transfer.

The receiver's visible receipt correctly describes local persistence. The test separately verifies normal Sync reconciliation; it does not reinterpret that local label as server proof. Existing class selection was the tested destination path. This result does not add a new-class control to the direct-extension receiver.

## Affected safeguards

- Dropped extension outcome after the first actual save and Sync ACK retained the exact source batch. Explicit retry reopened it as 28 existing names, returned an existing receipt, advanced only that batch, and changed no database row or Outbox command.
- A claimed nonce could not replay. Wrong receiver-tab claims were denied without consuming the legitimate claim. The actual worker rejected duplicate rows and expired envelopes.
- Actual receiver expiry erased the review without writes. Switching the authenticated owner closed and erased the actual modal without writes. No ownership or lease guard was disabled.
- Every selected class required a fresh partial-coverage acknowledgement. Generic source completeness was never hardcoded from the expected synthetic total.
- No application exceptions occurred. The helper closed its disposable contexts/browser, and the test closed only its owned loopback server in finally. No shared live-browser phase was used for this purely synthetic check.

## Evidence and preserved failures

`tests/n36-final-journey-resumed.json` records both required checks as PASS, ten count/ACK operations, 606 reconciled network receipts, unchanged-store readback, source hashes and cleanup. `tests/n36-final-journey-evidence.json` reconciles these results with current-main source identity. Commands: `node tests/n36-final-journey-resumed.mjs`, `node tests/n36-final-journey-evidence.mjs`, scoped `node --check`, and `git diff --check`.

Initial commit `0fc763d349038222876ec71b2b2954c8a6b272af` and unchanged `tests/n36-final-journey-browser.json` retain original run `7f8c82ff-b9cc-4fd1-969e-fc45c94caf5f`: BLOCKED, full journey FAIL, receiver negatives NOT_RUN, exact HANDOFF_UNAVAILABLE loopback/HTTPS mismatch. That file was not overwritten or converted to PASS. The corrected card and canonical helper supplied the explicitly authorized synthetic HTTPS facade, exclusively from local GET/HEAD bytes. Product origins/manifest stayed byte-unchanged. External HTTP, WebSockets and Service Workers were blocked; DNS failed closed. This was not a retry of any real browser/tool denial.

Three resumed harness failures are preserved in the new machine evidence. First, the test incorrectly expected ownerId on local student rows; actual ownership is workspace/database and durable-command bound, with owner identity in the canonical network response. The corrected assertions cover those actual boundaries. Second, the test expected to close a modal that the existing current-state guard had already closed after Sync refresh. Third, its close selector matched both header/footer controls. Those harness assumptions were corrected without changing Product behavior. The final complete run passed once; unchanged passing browser checks were not rerun.

## Reused package proof and limits

The initial run verified all 25 deterministic 0.5.11 packaged files against current sources and manifest. Archive SHA-256: `7b9a286073834e3d01df49410f102ece86caa8bdffaa71771ee11fdaafbaa79d` (105862 bytes). Its read-only stable receipt showed 0.5.11, source task `continuous-n36-popup-width-top-diagnostics-module-load-0511-20261017`, published SHA `2159da1b7d11ccdc16772085f2ad4228c78e5543`; updater health reported ALREADY_CURRENT and chromeReloaded:false. These unchanged package, extraction and module proofs were reused, not repeated. No updater invocation, manual duplicate update or version increment occurred.

The source rosters, service/network responses and Chrome APIs were fabricated. The app DOM, handlers, source CSS, worker protocol, store, DB and Sync engine were actual Product code. This is source-local synthetic readiness, not Production, personal account save, native MV3 action-popup proof or reproduction of the original personal-Chrome module error. Those real/native gates remain NOT_RUN. No real student/teacher writes, hosted service operation, credentials/profile use, push, deployment or queue/status edit occurred. The independent publisher owns delivery of this inert candidate.

## User path

اختر فصل المصدر في الإضافة ← راجع أسماءه ووافق على نقل المتاح إن كان الكشف جزئيًا ← انقل إلى ركيز ← اختر فصلًا موجودًا ومادته وطابقه ← عاين الأسماء وأكّد إضافتها ← راجع الكشف وحالة المزامنة، ثم انتقل إلى الفصل التالي. الإيصال المحلي يختلف عن اكتمال المزامنة. حفظ حسابك الحقيقي واختبار نافذة Chrome الأصلية لم يُنفّذا هنا.
