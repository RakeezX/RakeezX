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

## Delivery prerequisite — BLOCKED

Private student JS/CSS changed. The card therefore requires fresh original-custodian native/carrier/public-pin preflight, a task/run/candidate-bound append-only one-upload reservation and exact provider/source/served asset parity **before LOCAL_READY**. These gates are NOT_RUN. The existing static gate is bound to the earlier pending-return task/candidate; a read-only call with this actual card rejects `n88_student_static_identity`. No consumed marker or original custody was changed.

The fresh activation gate path `drafts/n88-student-portal/activation/static-student-quiet-return-20261021-gate.mjs` is missing from this card's allowed paths. Preserve this candidate and saved session for the approved inactive-card maintenance process to add that bounded path. The controller can then resume the exact static custody phase, resolving the final no-deploy instruction there; the independent publisher retains Product main/frontend delivery. Reuse the successful unchanged local evidence. No routine PM approval or unchanged local retry is needed.

N88 remains open for actual postpublication performance and session acceptance.
