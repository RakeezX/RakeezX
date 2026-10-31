# N88 — inactive student teaching selection source milestone

AI-authored. Task `continuous-n88-student-scope-source-20261031`, run `9f046986-1f78-4ad5-a247-397a19fc7e66`. Actual clean starting main ancestry: `5b77024e36f254a6568a0224abb9ea25d78698af`. This preserves the qualified A2 host/error-boundary/manual-retirement/provenance composition. No old candidate was checked out or cherry-picked. The running card already specifies gpt-6.1-sol / medium / Standard; no active-session or controller metadata was changed.

## Implemented behavior

The canonical V2 student admission now uses the original verified numeric READ member/session, then derives eligible teachings from that member's current owner/class/year and active dated terms. No construction-time teaching is required. One eligible teaching opens automatically; multiple teachings produce a choice-only response, and zero produce an empty response. An optional requested teaching must belong to that exact eligible set. Same-subject overlapping terms use the actual subject and term names. Custom labels are read from canonical `subjects.name` / `terms.name`, never inferred from item titles or IDs.

The exact wire union is:

```js
{version:'n88-student-scope-v2', state:'choice'|'empty', choices:[{teachingId,label}]}
{version:'n88-student-scope-v2', state:'selected', teachingId,
 choices:[{teachingId,label}], projection:{work,grades}}
```

Choice requires at least two unique IDs, empty requires none, and selected must echo a member of choices. Choice/empty cannot contain a projection. The selected projection filters canonical inputs to exactly one teaching before the existing V2 projector; no legacy aggregate or combined grades are reused. Source/publication revisions, manual work, independent component grades, receipts, teacher UNKNOWN/status-only recovery and exclusive V1/V2 teacher controls retain their existing paths.

The actual carrier is `activation/v2-runtime-writer-1031/gateway.inactive.mjs`, followed by `web-entry.mjs`, the hosted finite runtime, original numeric authentication, canonical admission/service, real browser codec/client and mounted `mountUnifiedStudentPortal` in `src/views/student-portal-login.js`. The only new transport selector is canonical `?teaching=${encodeURIComponent(id)}` on the V2 student GET. Both ends validate it, and **the complete selector-bearing path is MAC-covered and preserved in the original four-field envelope**. GET has no body. The six fixed forwarded headers, V1 signing serialization/routes, origin/CSRF, provider IP, nonce/deadline, cookie and no-store rules remain intact. Duplicate/extra/noncanonical queries and signature tampering fail closed.

Changing subject retires pending replies and immediately clears the old projection before the fresh read. Selection/choice IDs remain memory-only; session/account/cross-tab context changes clear them. The view has readable Arabic labels, keyboard selection, an unavailable-selection recheck action, escaped labels and responsive RTL/dark styling. The empty placeholder cannot be selected over displayed private results. No private projection is persisted.

## One additional fixed private label read

`activation/v2-student-scope-1031/labels.mjs` declares exactly `student-scope-labels-1031` / `n88_private.safe_student_scope_labels_1031(text)`, with four typed arguments: verified owner UUID, class ID, verified numeric session UUID and trusted current ISO date. The host's finite query map permits only this exact SQL/argument tuple after original numeric admission and owner binding. Bounds are 2,000 rows / 2 MiB; exact output is teaching/subject/term IDs and their real subject/term names. Subject rows are share-locked; existing canonical owner/key/source locks and final transaction guards revalidate membership, eligibility, selection and projection before commit.

The separately versioned combined inactive installer reuses the qualified predecessor declarations byte-for-byte apart from the new exact authority/hash gate, and appends the fixed reader. Its definer is the existing legitimate `postgres` table owner, qualified as an actual nonsuperuser owner/admin. No role, raw table SELECT grant, public function, public EXECUTE, elevation, arbitrary table/query selector or hosted logging change is added. The original fourteen installed V2 storage operation definitions remain unchanged. Base64 decoding, JSON validation, casts and SQL run inside the safe exception boundary. Public/anon/authenticated execution is revoked; only the restricted backend receives this additional private EXECUTE capability. Original authenticated RLS-bound SELECT rights are preserved.

Files include one combined `install.inactive.sql`, `readback.sql`, `disable.inactive.sql`, SQL/source `manifest.json`, current asset manifest and aggregate `delivery-manifest.json`. Install/disable authority is deliberately NULL in source and refuses execution without a separately exact bound gate. Disable retires runtime/label EXECUTE and retains the safe retirement writer; it does not restore the unsafe writer or purge receipts/tombstones. `package.mjs` only generates files and never executes SQL.

## Affected evidence

`tests/n88-student-scope-1031/results.json` is the final PASS from the owned native PostgreSQL17.6/SCRAM fixture. It records ten affected checks, actual nonsuperuser postgres installation, actual restricted LOGIN, exact original14 definition/temporary-edge comparison, real/custom labels, foreign owner/class denial, malformed/private-marker containment, rollback, exact combined disable, and PID/birth/data-path/port cleanup. The installed archive and client were reused; this is local native evidence, **not hosted restricted-login/profile acceptance**. The SQL install hash qualified there is `3cb168cd95a260cd16b89d5f2ad17d9418e79ed2ea0020b2aee45be4e5c4f959`.

The actual signed service/client journey covers automatic single scope; same-subject overlapping terms requiring explicit choice; isolated grades 8 versus 3 and manual work; a foreign class hint; tampered/duplicate/extra selectors; two owners with colliding local IDs; exact old pilot teaching/two-pupil fences; current class transfer; numeric code rotation/revocation; deletion; class archive/restore and inability to revive an old session. Legacy `/student/read` still rejects the ambiguous overlapping-term case with its original 503 instead of acquiring V2 selection behavior. `rollout-guard.mjs` is unchanged.

The mounted browser check uses a fresh disposable canonical isolated browser, task-owned loopback HTTP server, actual source DOM/handlers/CSS, actual numeric entry, real fetch/client codec and signed native service. It verifies no projection before choice, keyboard opt-in, escaped malicious label text, an old delayed selection reply ignored after switching, cross-tab retirement and reload clearing, RTL390 and no horizontal overflow. Reviewed images: `student-choice-390.png`, `student-scopes-390.png`, `student-scopes-dark-390.png`. Browser contexts and owned server close in finally; the integration lease is released. No personal browser or shared cookies were used.

Eight focused Node tests (`scope.test.mjs`, `sw.test.mjs`, `bundle.test.mjs`) PASS: strict response discriminants; canonical selector and unchanged legacy MAC; client context/late-reply fences; choice/selected commit guards; SW105 atomic affected assets; existing N44/private/API exclusions; exact source/compiled/CSS hashes; actual prepared gateway allowlist/default-OFF behavior. The SW VM test is affected asset evidence, not live SW/offline certification. Prior unchanged teacher Auth/UNKNOWN/component-grade/N44/native campaign evidence is reused rather than rerun.

Original failure records remain under this test directory. They include the superseded-writer fixture preimage, SQL generator string replacement, incorrect ACL expectation, missing fixture state/deployment limits, and the lifecycle fixture's refused direct archive update. The corrected fixture uses the actual archive/reopen command. The placeholder check's Playwright `isDisabled()` assertion failure is retained; inspecting the actual DOM `option.disabled` passed, as did keyboard behavior. No guard or tool policy was relaxed. The first unit fixture used the wrong historical MAC domain in its expectation; it was corrected to the actual unchanged `n88-ingress-v1`. No Product server operation was retried against a hosted target.

## Inactive delivery identity and remaining gates

Aggregate delivery identity: `0cbf90605854181d43c045bcc59db03a05f06c1e533cb86b0f3c9c304e6d3390`.

| Prepared output | SHA-256 (UTF-8 LF, preserve BOM) |
| --- | --- |
| student | `43b0923abfe546ef4d203c7d2ccf510066acf3e5aa96cf5a6511338d16a2c3c2` |
| service | `9beb6a6685fabee6ac49e97c65cdb59b928975df2442ba5f35dc1f5ac73e6d1f` |
| gateway | `e99d58320df99cb4c7b9ce72cbce1fe2f25a8996c8db2149742731991e92493a` |

The explicit ten-asset private allowlist includes the current student bundle, current app/login/publication CSS, existing brand assets and `/student`. The generated service and actual V2 gateway use this corrected source; no prior fixed-teaching bundle is substituted. Normalize CRLF to LF before comparing/uploading prepared text, as recorded by the manifests. `assets.mjs` uses the already installed esbuild0.28.1 offline; no full Vite build or provider check ran. SW advances actual104 to105 and makes the affected login stylesheet required while preserving prior core/N44 and private-cache exclusions.

`PUBLICATION_V2_READINESS` and `N88_PUBLICATION_V2_ENABLED` remain OFF. V1 stays enabled. Source-only LOCAL_READY is eligible for the sole original publisher's inactive source/asset integration; it is not Production availability, public enablement or Product CLOSED.

The original hosted-runtime compatibility task remains BLOCKED on actual restricted authentication SQLSTATE28P01. This milestone neither retries that login nor completes it. The original student-scope resolution task remains pending whole-task reconciliation and should consume this source/evidence without repeating completed work. The original custodian still owns: resolving restricted authentication/profile acceptance under its existing gate; exact bound combined install/readback (or verified already-applied identity); exact service/gateway/private-asset delivery; positive actual teacher/student/pilot/privacy/public acceptance; and a separately authorized source-controlled readiness activation. Publisher frontend/build checks cannot substitute for those operations. No private custody, hosted SQL/Auth/provider/config/data/service operation, real account/customer session, message or new hosted fixture occurred here.
