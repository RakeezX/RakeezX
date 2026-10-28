# N44 Core V1 local packet — NOT INSTALLABLE

AI checkpoint, task n44-core-packet-1028, run 899544dd-d07a-47dd-ba3c-2ccd549d7458. Base fd79f76a4847ccc6e69c8044714e030bb9cd3025. No live service/account/browser/credential operations.

## Actual packaging and failure

Existing pinned esbuild 0.28.1 tooling compiled the current exact entry graph twice identically. Deterministic two-entry ZIP was written and reproduced using the existing Python ZipFile approach (stored entries, fixed 1980 timestamp). Archive is ignored local artifacts/build/n44-core-packet-1028/native-source.zip, SHA256 508f93beab51af4ea54f4f4e9ad4b2ad71617bdddcd5a666242d2b11fa4ad048. Compiled edge SHA256 d441f59ed25791ada6381530a705c649e66b9833932f43770ae668e60b44d9c8. It contains finite-due, finite config, transaction guards and Deno entry, but MUST NOT be installed: saved Native178 preservation FAILED.

Baseline is the original nonsecret hosted-readback packet, SHA256 bb6248f9d04c654b47ec1b491b6b3d6e90d8683770edfc94258b451d194eca92, saved edge 09d902f57abbb43ac459121072c3a1c28c3c83310aa790a5e8e43d5b744475d2, saved archive 1d596919a42dbb5317273f38242b6b5350894f621e1a157b7366c65e11d938a5. The builder verified packet, saved edge, map and saved archive hashes locally. It did not read any custody, environment secret, account/device identity or remote state. Existing current-packet pointer alone says installed=false; no new installation inference is made from it.

Current graph has 37 inputs versus 55 baseline inputs: 19 baseline modules are absent and 8 common inputs differ. This exceeds the intended finite integration delta. In particular current private-runtime.mjs drops the saved nativeExchange port passed to createAuditedSender. Copying the current archive over Native178 cannot be certified to preserve its verified native transport/mobile/readback behavior.

Affected test result: exact compiled graph/archive hashes PASS; Native178 guard preservation FAIL; inactive flags/null sample/empty cron and tracked allowlisted source-only archive checks PASS. No eight-test scheduler campaign was repeated. Builder exits nonzero when baseline preservation fails. The archive remains a diagnostic artifact, not a qualified release.

## Exact missing source scope

Absent baseline source files (none are writable under this card):

- drafts/n44-push/activation/exact-operator-cleanup.mjs
- drafts/n44-push/activation/current-hosted-inspection.mjs
- drafts/n44-push/sender-material.mjs
- drafts/n44-push/postclick-authority.mjs
- drafts/n44-push/witness-sixth-authority.mjs
- drafts/n44-push/pr6-closed-fourth.mjs
- drafts/n44-push/user-closed-fourth-envelope.mjs
- drafts/n44-push/closed-fourth-successor.mjs
- drafts/n44-push/current-request-authority.mjs
- drafts/n44-push/activation/hosted-disposal.mjs
- drafts/n44-push/expired-admission.mjs
- drafts/n44-push/attempt-trace.mjs
- drafts/n44-push/mobile-trial.inactive.mjs
- drafts/n44-push/activation/mobile-hosted-readback.mjs
- drafts/n44-push/admission-authority.mjs
- drafts/n44-push/transport-contract.mjs
- drafts/n44-push/transport-readiness.mjs
- drafts/n44-push/transport-window.mjs
- drafts/n44-push/native-readiness.mjs

Common differing files:

- drafts/n44-push/runtime-failure.mjs
- drafts/n44-push/delivery.mjs
- drafts/n44-push/private-runtime.mjs
- drafts/n44-push/one-device-test.mjs
- drafts/n44-push/backend.mjs
- drafts/n44-push/web-entry.mjs
- drafts/n44-push/existing-host.mjs
- drafts/n44-push/readiness-entry.mjs

Only backend.mjs and existing-host.mjs among these common differences are writable here. Required next correction is a scoped, pinned Native178 source composition restoration/merge with the finite delta, including private-runtime.mjs, delivery.mjs, web-entry.mjs, runtime-failure.mjs, one-device-test.mjs and readiness-entry.mjs plus the explicit absent dependencies. This is not permission to merge private history or copy private state. Preserve exact baseline hashes and independently qualify any changed integration. No change was made to Product service sources in this attempt. The approved inactive-card maintenance path may authorize the necessary exact nonsecret files; controller then resumes this candidate. Do not rerun unchanged compilation before that material correction.

## Reproducible local command and handling

Run node drafts/n44-push/activation/core-v1-packet/build.mjs from this checkout. It reads only the pinned saved nonsecret baseline and tracked current source graph, writes edge/map/ZIP/comparison only under ignored artifacts/build/n44-core-packet-1028, and writes a public manifest containing hashes and structural counts. Tests read the existing artifacts: node --test tests/n44-core-packet-1028/qualification.test.mjs. The current preservation test intentionally reports the genuine failure; do not relabel it. No archive is staged in Git. No active service, server, lease or process is left running.

## Future finite proposal — no authority activated

After a corrected archive is qualified, the original custodian must bind its exact source graph/entry/map/archive and staged worker hashes to a separately authorized immutable grant. Original account/workspace and the two devices remain protected custody references, not values in this public packet. Maximum two canonical event sources, four event/device tuples, two registrations, four provider attempts and twenty scheduled ticks. Proposed window <=20 minutes, wholly within one UTC day, activated only after actual source/service/device readiness and adequate cleanup margin. These are proposed upper bounds, not new permits.

Canonical source code requires a lesson session under an existing valid teaching/term/section/year, and a due scoreSubitem under an item with scoreMode=subitems under that teaching. Thus a minimal new fixture proposal is one lesson session plus one item parent and one due child (three source records, two events), using already verified existing ancestry. No grades, completions or manual contributions. The normal UI must produce canonical save/Sync receipts and exact source IDs/stamps before descriptor binding. If existing parents cannot be used, stop and amend exact source allowance; never infer extra creation. Due stage must coincide with its real timezone midnight boundary and lesson with selected lead; no fake clock or synthetic event in physical acceptance.

Install/readback proposal: save exact existing source/config rollback material; qualify the compiled replacement against Native178 first; separately authorize at most the exact necessary service installation and read back entry/map/archive/source identity plus unchanged transport/SQL/Auth/peer protections. Install one owned scheduled worker with minutely trigger only under that same bounded authority. Set finite descriptor and finite mode explicitly; general delivery remains OFF. Read back exact pins, caps, hardEnd, enabled flags and schedule identity before first tick. Current staged crons remain empty, flags false, descriptor default null. Frontend publisher cannot substitute for service installation/readback.

Physical acceptance requires scheduled (not manual) automatic lesson and due OS arrival while closed, tap destination and peer retention on the named devices, plus truthful duplicate/foreign delivery observation. UNKNOWN consumes the event permit permanently. At hardEnd the finite server becomes inert; installed cron deletion/config OFF still requires owned cleanup. Stop iPhone then Android with local subscription/worker-binding and cloud revocation receipts; delete only new fixture child before item parent and the exact lesson through normal UI, zero-grade invariant and canonical local/cloud readback. Remove only owned schedule; clear finite descriptor and read back OFF/null while preserving Auth/peers. Rollback first disarms; a second service upload is not implied and needs its own authority.

Old grant60fc7d23 remains DISARMED_CLOSED_SPENT. Preserve original private candidate d4e695d3 and original deletion mutation receipt. Any residual cleanup proof is separately permitted fresh READ ONLY same-document owner/ancestry/tombstone/revision/ACK/Sync/zero-grade checkpoint; never repeat Delete. N44 Core V1 remains OPEN. Teacher UI simplification waits for actual automatic stability; Admin/D107/marketing remain deferred.
