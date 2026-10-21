# N88 — quiet opening and same-tab return

AI implementation for `continuous-n88-student-quiet-fast-return-20261021`, run `6f338b83-ed40-4a6a-a30e-2d3c8c4a0a0f`.
Base: `c6e91a85035e2d5f9403f002ffd8254392df2d34`. Saved session: `01a15e1e-7273-76d3-8830-0e850ed05f13`.

The pending view now shows the RAKEEZ identity, “مساحة الطالب”, “لحظات ونجهّز مساحتك…” and an accessible indeterminate progress indicator. Reduced motion disables its gentle opacity animation. Normal unavailable/timeout recovery says “تعذّر فتح مساحتك الآن. حاول مجددًا.” Technical finite diagnostics remain behind optional Support. No private placeholder, code form, stored credentials or false sign-out was introduced.

This is a visual/copy correction, **not a service-speed fix**. Testing the original source first found no avoidable dispatch queue or duplicate GET: initial pending-paint-to-dispatch 9–15ms and ordinary return 1–2ms. Controlled response delays of 600/6000ms completed in 605/6006ms. The current source and packaged private entry also dispatch promptly (initial 9–12ms, return 1–2ms), with controlled 600/6000ms responses at 602–612/6002–6006ms. These are synthetic measurements, not live response latency. The card's prior actual 5500–6500ms GET remains an unresolved service issue; no postpublication performance claim is made.

## Affected evidence

- `tests/n88-student-quiet-fast-return-20261021/baseline.json`: actual original-source DOM/client/CSS before edits, 390/1280px, ten scenario groups PASS.
- `ui.json`: actual source **and packaged private entry**, 390/1280px, twenty scenario groups PASS. Fresh disposable browser contexts over owned loopback HTTP; external requests and Service Workers blocked; synthetic fetch only. Covers fresh 401, current 200, 403/410, hiding during initial GET, ordinary hide/show, duplicate visibility/pageshow, 503, 15s timeout and ignored-abort late replies. Mutation observation and DOM assertions detect form/private flashes during unconfirmed phases. GET count is one per initial/return phase; no hidden replay or duplicate event dispatch. End acknowledgement, uncertain failure and pagehide/late-response fences retain one POST without automatic read/replay.
- Eight `pending-*.png`/`recovery-*.png` images: inspected at mobile and desktop; no overflow/clipping. Actual live status, named progressbar without a fake percentage, and reduced-motion CSS checked.
- `bundle-preparation.json`: deterministic source-derived private JS/CSS; only the two corresponding embedded carrier assets differ. Every other carrier byte is identical to the recorded prior carrier `6978352dfa73746a9c4a2cc85e822545483427d4834f172a04abb963f136068e`. No upload.
- `qualification.json`: syntax, deterministic package readback, source/evidence hashes, unchanged transport/native/carrier runtime and exact three presentation-only JS line changes verified. All view scheduling, generation/context, End and Support control flow is unchanged. Same-source prior transport, extended End, claim and diagnostic/clipboard evidence is reused rather than rerun.
- `baseline-clock-harness-failure.json` preserves the initial harness failure: the clock was installed after the timeout existed. Installing before navigation corrected the harness, and the actual delayed/hidden/reload scenarios passed. It was not a Product failure or a live fixture attempt.

Browser phase lease acquired/released per run. Owned server/connections/browser contexts closed in `finally`. No personal browser, real student code/account/read/write, provider operation, SQL/Auth/native/cookie/region/public-pin change, queue edit, push or deploy.

## Previous attempts — preserved delivery blocker

Private student JS/CSS changed. The card therefore requires fresh original-custodian native/carrier/public-pin preflight, a task/run/candidate-bound append-only one-upload reservation and exact provider/source/served asset parity **before LOCAL_READY**. These gates are NOT_RUN. The existing static gate is bound to the earlier pending-return task/candidate; a read-only call with this actual card rejects `n88_student_static_identity`. No consumed marker or original custody was changed.

The fresh activation gate path `drafts/n88-student-portal/activation/static-student-quiet-return-20261021-gate.mjs` is missing from this card's allowed paths. Preserve this candidate and saved session for the approved inactive-card maintenance process to add that bounded path. The controller can then resume the exact static custody phase, resolving the final no-deploy instruction there; the independent publisher retains Product main/frontend delivery. Reuse the successful unchanged local evidence. No routine PM approval or unchanged local retry is needed.

N88 remains open for actual postpublication performance and session acceptance.

## Reviewed scope correction and completed private-static prerequisite

Run `f2a49542-bb75-4ad1-bc15-4a8290010e74` continues the same saved session. The activated card now includes the exact missing gate path and expressly permits this single original-custodian private-static prerequisite. This supersedes the earlier task-local scope/no-deploy blocker only for that phase. The original source candidate `ee7a8713ce6b912710c082b876aad4d2ee89d071`, baseline, UI screenshots and local proofs remain byte-identical; no UI suite was repeated. Earlier failed/unrun receipts remain historical records, not rewritten successes.

The fresh gate and its official custodian entry were committed as AI changes. `custody.json` records synthetic qualification: 29 identity/authority/lease variants deny, 17 readback mismatch variants deny, one exclusive candidate-wide attempt, append-only/idempotent completion, interrupted-save recovery without another upload, and actual wrong-custodian-root refusal before protected state access. Undefined `providerServiceOperations` in this card grants no extra operation; a nonzero value is rejected.

Actual preflight used the original custodian's protected state and official read-only CLI. It observed native v61, source `ec0efc049b20f7119b3b5eea8b55a93a52bdfd6981647bf97298383a9f37f507`, with its public pin matching. This is the fresh current preimage, not the historical v59 of the prior task. Cloudflare readback independently matched the expected prior carrier `6978352dfa73746a9c4a2cc85e822545483427d4834f172a04abb963f136068e`; settings, routes and subdomain matched the prior recorded configuration. Same saved-session official connection read capability was exercised before reservation.

At `2026-10-21T11:34:35.562Z`, the original custodian reserved this run/prepared-candidate's append-only one-upload attempt. The official `rakeez_cloudflare` connection performed exactly one carrier upload, after an immediate source/configuration/version preimage recheck. Secret bindings were retained without reading or passing secret values. New carrier SHA-256 is `a2308758f0611510f04f71cee50f69ffe35b936183d8d3e20847304adfb67091`, current at 100% in version `654ca67f-9359-4a03-ad12-03a531780f9b`.

Independent official provider readback and unauthenticated static-only HTTP reads matched the exact source-derived bytes:

- Student JS: `c5c5101e41afc253f2dbd770c0ddf93cb0cd1f9bbcded9d2aa1d5154a7b1abe3`.
- Student CSS: `2a67b8c32793d52b4e2f5daff17ac72f6775235b7d4862495c0963c714c5e7f9`.
- Both static responses: HTTP 200, exact expected MIME, `no-store`, `no-referrer`, `nosniff`.

Native v61/source and public pin remained unchanged after the upload, as did settings/routes/subdomain. At `2026-10-21T11:35:54.428Z`, the original custodian appended the exact completion to its protected history. The allowance is consumed; a new run must not upload again. `static-delivery.json`, `carrier-readback.json` and `final-checks.json` contain the current completion/parity evidence. The integration and live-mutation leases were released; no browser/server was reopened.

All five required affected checks now PASS through reused local proof and the completed static prerequisite. This supports LOCAL_READY for the independent controller. Product main/frontend publication and its verification remain with the sole publisher. No native deployment, public pin change, SQL/Auth/region/cookie/data operation, real account read or Product acceptance occurred. Live service speed remains unmeasured in this run; the earlier 5.5–6.5s latency remains unresolved.

## Publisher merge repair — run 5ef47f0b-74e7-4ea5-a005-ed5094b9a52c

The publisher's attempt to integrate candidate `75cefb0ace49318fb1674c008663cb3e49c0ae49` into observed main `f3f4fe4c074881e5eac9a4a767cb1140d023be32` conflicted because this task and the mobile503 task both inserted their independent custodian handlers at the beginning of `execute`. The retained integration worktree/index was inspected read-only and left untouched.

In the original assigned worktree, the exact quiet-static handler was moved after the existing pending-static handler, before the reopen-static handler. Its bytes, action names, guards and every surrounding candidate byte are unchanged. No unrelated main code was imported into the candidate and the declared base is preserved.

`merge-repair.json` records a successful local three-way merge of this corrected file against the exact failed integration index's ancestor and main stages. The simulated result equals the complete observed-main file plus only this task's import and handler: the mobile503 handler and all other main bytes are retained. Both candidate and simulated merged syntax pass; the actual wrong-root custodian entry still refuses before protected state/provider access. Temporary fixture files were removed in `finally`. This is a merge simulation, not publisher integration or deployment.

All original source/UI hashes and static completion receipt hashes match. `final-checks.json` remains the historical completed five-check proof; `merge-repair.json` bridges its original official-entry hash to the relocated entry without rewriting the prior receipt. The one-upload allowance remains consumed. No UI rerun, provider request, custody replay, browser/server or live resource lease was needed for this local file repair.

`merge-repair-extension-harness-failure.json` preserves an initial check-harness error: Node syntax checking rejects a `.tmp` extension. Using owned `.tmp.mjs` fixture files corrected that harness; the scoped merge/syntax/guard/evidence check then passed. No Product behavior failed in that harness step.
