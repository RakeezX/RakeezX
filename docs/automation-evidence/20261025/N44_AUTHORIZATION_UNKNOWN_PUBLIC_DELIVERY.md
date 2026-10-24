# N44 qualified authorization failure classification — local source delivery

Task: `continuous-n44-authorization-unknown-public-dependency-20261025`

Run: `e4e33f4f-8be3-4d4e-8383-3dc9f46bdce2`

State: LOCAL_READY for this one-file source dependency only; publication NOT_RUN.

## Identity and exact scope

- Isolated base / observed origin/main: `d285e226fc1ddb4a1d52d07b0dd68b0646b87a18`.
- Qualified parent containing immutable evidence: `30e3a4fc77a8d6c14ae57b1adabf7fe3b1da838f`.
- Parent evidence run: `a5c87fa8-5d47-45af-aab2-531f216d726b`; qualified code: `05500ec07917d37e8a45c8d59bdec85ab04550ff`.
- Manifest preparation main: `b47b49dc57fb92a9e88b121f961ee5d255ffbf51`; actual App proof main: `3f727b76d0b8905ac2a0de2c733085961072d8f1`.
- Gateway preimage SHA256: `cda1b0efedf8796ff26d3e734f1c847721dd355886a34af623dbad2e90a45789`.
- Approved patch SHA256: `ecf831807169de2792187d1e783c419e64231e9addd038c857c40269e284521a`.
- Result gateway SHA256: `659079853d3ea1003ac4d81fb4d50158d33d6f376e983626b42ca1df95bfbe2c`.

Validated preimage and patch before `git apply --check --unidiff-zero`, then applied only that patch with `git apply --unidiff-zero`. No old-base whole-file copy or private-branch integration. Initial post-apply raw hash assertion failed because Git wrote CRLF (`0d8effa5573f2ed1a44023bbcbba7d0026f5e4c9e0b81a7473ad591466ed648f`). Normalized only this owned patched file to LF, without configuration changes; exact required target hash then passed. The failed assertion is retained here, not represented as an initial PASS.

The only runtime change is `authorizeEvent`: an unconfirmed HTTP/transport outcome or narrow event refusal denies the action without invalidating the entire subscription. Authorization additionally requires current `valid()`. Binding retirement continues through existing owner/session/lease/consent/worker guards. All gateway bytes outside this method match base, including original-registration cleanup/CAS, fresh authorization, context/source checks and UNKNOWN stop/readback behavior. No startup dependency, SW, API, backend, schema, RLS, Auth, role, SQL, carrier or region change. Current-main N88 student/source and Sync/Auth403 changes remain intact.

## Three affected checks

1. **PASS — `n44_authorization_unknown_actual_full_app` (reused, not rerun).** Read and byte-verified the original evidence against the immutable parent Git objects. `authorization-ui.json` records 11 PASS cases on actual App DOM/SW message handlers over `http://127.0.0.1:64838`: 503, 15-second timeout and narrow refusal deny action while retaining binding; explicit readonly recovery reuses registration; owner/logout/newSID/lease/consent/stale-worker cases retire it. Its original RED remains FAIL. `authorization-click.json` records the corrected owned-lease click check at `http://127.0.0.1:65302`: no private action/navigation/revoke after 503. `authorization-typed-app.json` records actual DOM/handlers/source CSS, compiled native privateQuery/ownership boundary with real local PG, normal projection/authorization, real W3C bytes sent once to a FAKE provider, idempotency and stop, plus ten negative/fault cases. Fake-provider coverage is not OS delivery. The unleased click procedural failure remains FAIL and is not accepted. No browser or PG rerun occurred in this child.
2. **PASS — `n44_authorization_current_main_binding_security`.** Exact preimage/patch/target checks, method-excluded byte equality, gateway-only runtime diff, `node --check src/lib/notification-push-gateway.js` and `git diff --check`. Comparing proof main to this base across src/public/SW found only build metadata, `src/lib/student-portal-unified-client.js`, and `src/views/student-portal-login.js` changes; App/store/notification/owner/lease/cloud paths and source CSS are unchanged. Evidence gateway hash matches this exact target. No broad build or new journey needed.
3. **PASS — `n44_authorization_no_live_service_replay`.** Verified immutable phase certificate/disposition: all five actual registration IDs revoked; old window retired, approval null and delivery off; first actual send UNCERTAIN; additional actual sender requests zero. This child ran local file/Git/syntax assertions only: zero actual account/browser/consent/registration/source-fixture/service/native/pin/provider-send/window/admission operations. No leases or servers were acquired or processes launched for a browser/server phase. No queue, ledger, parent or foreign resource edits.

## Reused evidence binding

All files below are in `tests/n44-current-closed-page-followup-20261024/` at parent `30e3a4fc77a8d6c14ae57b1adabf7fe3b1da838f`. Read from the original custodian's worktree and compared byte-for-byte to those Git objects.

| File | SHA256 |
| --- | --- |
| authorization-public-manifest.json | `51da708de4ba29b6f3a9500a3d55c2d85d4b8751554393d7eb553b0d377003c3` |
| authorization-ui.json | `250c6158f47bfa8d10283a872dda018034b280d36d9a52a8d59973801ea254f4` |
| authorization-click.json | `fe9d5492508b2f011d57e3570d70fc9287912b3a9288360025899e72ad4f0c70` |
| authorization-typed-app.json | `0b7223e7d6a914dc4dfd56876a79687a4091f44094a3e6b43187640dc9ea2628` |
| authorization-phase-certificate.json | `667031fe05d6c57e8a8d76c4ea7518ac0937bbf6b5edd4ea5c80b488aaa59df9` |
| authorization-click-unleased-procedural-failure.json | `279b4bf8afcffff12eaab6e1df4b974ddec210002720adcdc271e9094b2eea81` |

## Remaining limits and delivery ownership

Actual historical events/authorize 503 cause remains UNKNOWN. One earlier aggregate query returned zero rows; it does not establish cause or authorize another query. Original FAIL/NOT_RUN/UNKNOWN remain unchanged. Actual OS arrival is NOT_PROVEN and parent N44 acceptance remains BLOCKED. This frontend causal fix neither repairs the service 503 nor closes N44.

No replay, regenerated fixture, reset budget, revived identity or new recovery capability. Any later bounded recovery belongs solely to the original custodian under applicable PO authority. Source publication grants none of it. The independent sole publisher/controller owns integration, deterministic build and actual served gateway hash verification, serialized with N88 corrective assets. This worker did not push, deploy or claim Production evidence.
