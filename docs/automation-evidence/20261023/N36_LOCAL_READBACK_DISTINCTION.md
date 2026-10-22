# N36 — app-only local readback distinction

AI-authored scoped implementation for `continuous-n36-local-readback-distinction-20261023`, run `d18bc10f-300d-4f34-bf63-1cdbd2e18e59`, base `2e43dc14161c6a27af7c30fc6bf29f39fd2a0bc4`.

The latest canonical N36 row records the PO's actual generic local-progress output. It is received evidence, not a missing user action. The real .35 batch remains unresolved. This change does not establish original save success/failure, solve the independent timetable school-response issue, or close N36.

## Implementation

Only `src/views/class-import-center.js` changes Product behavior. A private read result retains safe finite presentation states: completed/no eligible trace, unverified context, incomplete storage read, unverified trace, and the existing verified progress presentation. The public `window.rakeezNamesLocalProgress` still returns exactly `checkpoint`, `relation`, `confirmedRows`, `confirmedReceipts`, `pendingRows`, `pendingSavedRows`. `reportHandoffOutcome`, transport code and extension package are unchanged.

The existing owner/lease/session/document access checks remain. Context is asserted before the readonly snapshot, after it, after existing asynchronous imports/digests, and immediately before presenting counts. Context loss takes precedence over storage/integrity errors. No eligible owned trace and a foreign marker have identical output. No-trace copy explicitly does not mean zero imported rows. The no-write statement describes only this read action.

Tested view SHA256 (worktree bytes): `555cb0ab09545c35e6b3216c98c4d4d69ab7fb14f57d1750b8f829f95c556344`.

## Affected verification

The existing `prepareNamesAccount`, synthetic N73 service fixture and `openReadyServedDemo` load the real app entry, store/ownership guards, IndexedDB, view handlers and source CSS at task-owned `http://127.0.0.1:49943`. Canonical `withIsolatedLocalBrowser` validates the active card and run, uses fresh contexts, blocks Service Workers/external traffic and closes its owned browser. The server closes in finally. This eligible isolated phase does not take the shared live-browser lease. No real account, source browser, live service or fixture was inspected.

| Required check | Actual evidence |
| --- | --- |
| `n36_readback_ambiguous_baseline_and_distinct_actual_ui` | `tests/n36-local-readback-20261023/baseline.json`: absent trace, aborted snapshot and invalid pre-read document all reproduced the identical original message. `candidate.json`: distinct safe rendered messages, identical absent/foreign presentation. |
| `n36_readback_owner_session_document_and_failure_safety` | 14 affected cases PASS: absent, foreign, abort, two-second timeout, invalid context before read, session/owner/lease/document change after snapshot, malformed batch ID, invalid digest, valid receipts, pending rows already present, original-term hint. Owner/lease loss uses the existing guarded unavailable screen; old receipt counts never appear. A fresh subsequent public read in the new valid same-owner session can return receipts, while the interrupted button action remains context-unverified. |
| `n36_readback_zero_writes_and_unchanged_transport_contract` | Every case: zero IndexedDB write transactions/write calls, zero `postMessage`/extension messages, zero source/network action requests; complete database snapshot identical before/after, including selections, outbox and checkpoint. Exact six-key public shape asserted. Handoff/protocol and .37 ZIP/manifest byte-equal to base. No import/replay/ACK can be initiated through the measured action. |

Screenshots: `baseline-absent.png`, `candidate-absent.png`, `candidate-timeout.png`, `candidate-pending.png` in the same test directory. The absent and pending rendered results were visually inspected: readable RTL copy within the actual application card, unchanged .37 link.

Harness corrections are preserved in `harness-owner-gate-failure.json` and `harness-lease-fixture-failure.json`. The initial owner assertion expected the diagnostic node even though the existing access guard correctly replaced the view. It now asserts the actual `data-class-access-status` ownership/lease/verification result and absence of old counts. Direct mutation of the derived workspace lease-generation field did not reliably invalidate the actual lease; the corrected fixture calls the existing runtime lease's `invalidate` method. No Product guard was altered. An early abort injector also matched string store names during the independent checkpoint; it was narrowed to the exact seven-store readonly array. These were test-harness failures, not waived Product gates.

Passed cases for the unchanged view were reused while correcting only later fixture assertions; `candidate.json.reusedCases` records them. The committed runner defaults to a fresh complete affected run and does not trust cached evidence. Reproduction: `node tests/n36-local-readback-20261023/readback.mjs --baseline`, then `node tests/n36-local-readback-20261023/readback.mjs` while this exact card/run is active. `node --check` for the view and runner and `git diff --check` PASS. No broad collection matrix or full build was run.

Unchanged .37 ZIP SHA256: `bed6dd617411021018d4a81c3c00ec3e33e37289c082e0ddfbb1ef32e3890c4c`. Manifest SHA256: `dec2d2f368cf6314b18609e3494708759348493aee63f54b3787c5ba24d61938`.

## Delivery boundary and next read

Local candidate only; no push, deployment, provider check or served parity is claimed. The original independent publisher owns integration and frontend/served verification. No extension release, reinstall, service operation, nonce acknowledgement or queue change was made.

بعد تحقق الناشر من النسخة الجديدة: استخدم «قراءة التقدم المحلي لهذا الحساب» مرة واحدة وانقل نص النتيجة الجديد فقط؛ إن تعذّر السياق فتحقق من الحساب والجلسة أولًا. لا تُعد الجمع أو الاستيراد. اكتمال القراءة بلا أثر مؤهل أو تعذّر التحقق من الأثر يترك نتيجة الدفعة الأصلية غير محسومة؛ عدم اكتمال القراءة يسمح بإعادة القراءة المحلية فقط.
