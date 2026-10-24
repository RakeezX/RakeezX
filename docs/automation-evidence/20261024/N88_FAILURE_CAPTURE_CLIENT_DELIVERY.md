# N88 public failure-capture client source — AI implementation

Task `continuous-n88-failure-capture-client-delivery-20261024`, run `923a2be4-4016-4b55-8d5e-ffe53c3571e0`.

Prepared on the card's published immutable base `438ceffaf6aeab121c10f7a6e466aa41024a14a4`. Applied only the three declared source diffs from `98a4e76a46d6b921a17aa9909ce521f2597ca432` through qualified candidate `169ba140ecbd8e8823427c9e6ad7f26941ebbfac`. The two existing source files were identical between qualification base and publication base; the observer is new. The resulting three files match every card SHA-256 exactly (including actual working bytes). No class UI source changed, preserving the delivered count/order/mutation work.

The opt-in fragment reserves one ordinary read challenge, then disappears from the URL. Finite failure metadata is captured before ordinary error handling; HTTP 503 still renders unavailable recovery and HTTP 401 still renders session entry. Neither becomes a profile or successful binding. Retirement removes owned DOM metadata and cannot renew the reservation. Missing/unknown acknowledgement does not cause an automatic retry.

## Affected verification

| Required check | Result / evidence |
| --- | --- |
| `n88_finite_failure_capture_before_error_handler` | PASS — `node tests/n88-failure-capture-client-delivery-20261024/client.mjs`; `client.json`: strict keys/status/hash/phase/family/pin shape, expiry/current/connected/retired request guards, one-read unknown acknowledgement, ordinary 503 rejection without reading its body, unchanged 401 and digit normalization. |
| `n88_actual_student_error_path_retirement_and_privacy` | PASS — `node tests/n88-failure-capture-client-delivery-20261024/app.mjs`; `app.json`: actual repository student HTML/module entry, transport, real page handlers and source CSS at owned loopback HTTP. Ten fresh synthetic contexts cover selected 503, ordinary non-opt-in, unknown acknowledgement, 401, extra fields, wrong browser challenge, malformed source pin, malformed JSON, expiry and late retired response. Actual capture precedes the error paint, one initial GET, no private profile/false binding, pagehide cleanup and automatic return without the retired challenge. |
| `n88_qualified_capture_source_current_main_parity` | PASS locally — `provenance.json`: all three exact dependency hashes and unchanged-base comparison. Original finite/native/PG/crypto evidence is referenced by immutable candidate and evidence hashes, not rerun. Public served-byte verification remains the sole publisher's phase. |

`node --check` passed for all three source modules; `git diff --check` passed. No Vite build or broader suite was needed for this exact qualified slice.

The first app-check process encountered `ERR_HTTP_HEADERS_SENT` in its owned synthetic server cleanup: the late response completion was called again in `finally`. The test server completion now returns when ended/destroyed; the affected app check then passed and closed its owned server and browser. This was a harness cleanup failure, not a Product PASS from the failed process. No original parent FAIL/UNKNOWN evidence was changed.

The canonical `withIsolatedLocalBrowser` helper owns disposable contexts, loopback-only routing, Service Worker blocking and bounded browser cleanup. The HTTP server uses a unique OS-assigned port and closes connections/server in `finally`. This eligible synthetic phase needs no shared live-browser lease; no live resource was acquired or user browser attached. Read-only `sw.js` inspection confirms the draft student entry/observer are outside the teacher offline SHELL and `/student`/student API paths bypass its fetch handling. There is no new teacher startup module or offline-shell change.

## Publication and trust boundary

The public publisher must verify the repository bytes of `src/lib/student-portal-unified-client.js`, `drafts/n88-student-portal/client/binding-proof.js` and `drafts/n88-student-portal/client/student-entry.js`, including normal module resolution. Exact expected hashes are in `provenance.json`; line-ending conversion must not be mistaken for exact byte parity. This worker made no push, deployment, remote request or provider operation.

These are finite browser-captured metadata, **not verified source/actor/MAC proof**. Synthetic receipts deliberately use fabricated pins/MACs. A malformed source pin is rejected locally; a well-shaped wrong pin or MAC requires the original custodian's independent cryptographic/source verification. `sourceChecked` belongs only to actual original pin/readback verification; `x-n88-source` is an IP pseudonym, not that proof. A harmless callback or captured failure is not a committed binding receipt.

The original private `/student` compiled/embedded asset is not changed or claimed delivered by these public raw sources. Its original custodian must bundle the exact entry/observer as needed inside the already authorized single combined diagnostic carrier transition, preserving all other private assets/routes/headers and original allowance history. No carrier/private custody/server/native/SQL/Auth/RLS/environment/fixture/session work occurred here. Server observer activation and actual correlated student read remain original-custodian gates.

Actual user student 503, issuance UNKNOWN, transport 401 and whole N88 remain OPEN; the retained wrong-signature expectation failure remains FAIL. Source readiness is not service stability, Production evidence or PO acceptance.
