# N88 integrated class management module — AI implementation

Task `continuous-n88-integrated-class-management-20261018`, run `48654997-1a32-4af7-aa5e-c3882d2731f6`.
Base and observed origin/main: `8ff59100ead8802dec7ebb7f7d4f4d41c2c89f8c`.
Authority: latest N88 ledger note PO18October12:47 and activated class module card. Earlier four-digit/private-link UI is superseded for this new module; existing shared code remains untouched.

## Bounded result

`src/views/student-portal-class.js` exports synchronous `mountClassPortal(root, options)` returning `{refresh, contextChanged, dispose}`. Its ordinary default view adapter deliberately mounts unavailable. No router/runtime/store/client/SW registration, startup dependency, real account, hosted SQL/Auth/RLS, service activation or publication is performed. The module uses the existing `.page`, `.btn`, `.card` and app tokens; it adds a class section, not another teacher dashboard/header. It contains no date input.

The class list shows current student identities and active-code status, never retrieves an existing credential. One explicit action issues missing codes with a roster CAS. Results distinguish created, existing/skipped, failed and uncertain entries by current student label. Every mutation requires a fresh list review afterward; retry of issue-missing cannot rotate existing codes. Rotate/revoke requires selecting a current active-code row and a separate consequence confirmation. Visibility is a single class form for exactly `name,class,grades,required,completed,scheduled`; unchecked fields are false. No inferred grades/completion/publication is created.

Credentials are server-returned strings matching `/^1[0-9]{11}$/`, never generated or chosen by this production UI. The service owns cryptographic randomness, global uniqueness and stable issuing-owner/student binding across terms. Only newly acknowledged credentials enter the temporary delivery sheet. Copy/print requires another gesture while the same valid context remains current. Close, refresh, owner/context notification, expiry, pagehide or disposal clears the sheet. Clipboard history and teacher-controlled printed paper are outside application memory; closing does not claim to erase those teacher-created copies. No application persistence, URL/query, analytics, diagnostics, automatic message or credential retrieval exists in the module.

## Integration binding (explicit follow-up, no undefined request port)

Load `src/styles/student-portal-class.css` alongside existing app CSS when registering the final class route. Import `createClassPortalClient` from `src/lib/student-portal-class-client.js`, then mount with:

```js
const client = createClassPortalClient({ request, getContext });
const handle = mountClassPortal(root, {
  client, getContext, subscribe, classLabel,
  // optional copy(text), print(), requestId() — browser defaults supplied
});
// Always call handle.dispose() on unmount.
```

`getContext()` defaults to null and must return null/unavailable unless verified readiness AND existing current account ownership/dispatch guard permit this operation. Bind the actual existing runtime owner guard and current server Auth/session/lease in final integration, never a teacher/student assertion from a request. No authenticated store-flow integration is claimed by these isolated module tests. `request` has the fetch-compatible `(relativePath, init) -> Promise<{ok:boolean,json():Promise<object>}>` signature. It must use the existing authenticated gateway, enforce the actual ownership guard (owner-bound command for writes), and must not log or persist bodies. There is no default fetch or readiness fallback. The external server must independently derive owner/session, validate current membership, class/teaching/term, session validity/lease/revocation and CAS under the existing transaction boundaries. Echoing the binding alone does not authorize access.

Context shape:

```text
{enabled:true, ownerId, sessionId, leaseId, teachingId, classId, termId,
 contextRevision, validUntil}
```

All seven identity/revision fields are nonempty strings (max 200 characters); `validUntil` is a future epoch millisecond number, bounded by the current actual session/lease. No bearer/refresh token or credential belongs here. `contextRevision` must change for any relevant roster/current-enrollment/term/workspace/service-binding drift. `subscribe(callback)` must synchronously notify every relevant owner/session/workspace/roster/term/readiness change and return unsubscribe. Notifications clear all local review/secret state and refetch. Expiry also clears automatically. `classLabel()` supplies the current native class label and must follow that same subscription. The request port must recheck the actual guard, not use this context as a substitute. Changes invalidate pending UI results even when a server request cannot be cancelled; a dispatched write can have occurred, so only a fresh read determines its disposition.

### HTTP request and acknowledgement contract

Every endpoint is POST under the exact relative prefix `/api/n88/teacher/class/`. Options specify same-origin credentials, no-store, redirect:error, no-referrer, JSON and `X-N88-CSRF: 1`; the actual gateway must validate origin/CSRF as well as current Auth. All bodies include original `teachingId` and `binding` containing exactly the seven string fields above (no enabled/validUntil). The response must be successful HTTP and have EXACT envelope:

```text
{ack:true, binding:{ownerId,sessionId,leaseId,teachingId,classId,termId,contextRevision},
 requestId: <exact submitted key, or null for list>, data: <validated result>}
```

Binding must match all original fields; original class identity cannot be replaced. Unknown result/envelope properties are rejected, including secret-bearing roster additions. Revisions/credentialVersion are safe nonnegative integers; zero is not treated as absent. All mutation responses are current committed server acknowledgements, never local optimistic projections. Service errors/409/timeouts/malformed or absent ACK cannot become success. Body parsing shares the 15-second default request deadline (configurable 1–30000 ms); abort is best-effort and never proves rollback. Errors are fixed public codes, not reflected transport error messages/bodies.

| Client method | Endpoint suffix | Additional body | EXACT `data` result |
| --- | --- | --- | --- |
| `listClass(teachingId)` | `list` | none | `{classId,rosterRevision,policyRevision,students,visibility}` |
| `issueMissingClassCodes(teachingId,{requestId,expectedRosterRevision})` | `issue-missing` | same arguments | `{requestId,created,skipped,failed,uncertain}` |
| `rotate({studentId,enrollmentId,revision,credentialVersion,requestId})` | `rotate` | same arguments + expectedRosterRevision from reviewed list | `{rotated:true,studentId,enrollmentId,credentialVersion,credential}` |
| `revoke({studentId,enrollmentId,revision,credentialVersion,requestId})` | `revoke` | same arguments + expectedRosterRevision from reviewed list | `{revoked:true,studentId,enrollmentId,credentialVersion}` |
| `saveVisibility(teachingId,{policyRevision,fields})` | `visibility` | same arguments + client-generated requestId + expectedRosterRevision | `{updated:true,policyRevision,fields}` |

`students` contains at most 2000 exact `{studentId,enrollmentId,revision,label,hasActiveCode,credentialVersion}` objects with unique student/enrollment IDs. Labels are escaped text, max 200 characters. `visibility`/`fields` contain exactly six boolean fields above. No unknown fields, missing keys or coerced values are accepted. New policyRevision and selective credentialVersion must be greater than their reviewed values; saved fields must exactly match the submitted choices. Selective IDs, enrollment and old revision/version must match a reviewed active-code row.

`created` entries are exact `{studentId,enrollmentId,credentialVersion,credential}` for reviewed missing-code rows only, with greater version and correct enrollment. Returned credentials must be valid strings and unique within that result. `skipped`/`failed` entries are exact `{studentId,reason}` with reason allowlist `existing,conflict,unavailable,not_current`; skipped permits only `existing` for reviewed active rows. IDs cannot repeat between any categories. With uncertain:false every reviewed student must be accounted for. With uncertain:true unreported identities are explicitly shown as unknown; only validated acknowledged created rows can display a credential. Existing code data is never returned. Server must recheck actual roster revision before writing; drift rejects without broadening roster or implicitly rotating any code.

Mutation request keys are opaque nonempty strings (max 200), ordinarily cryptographic UUIDs. Client consumes keys even after uncertain outcomes, blocks concurrent writes and invalidates its reviewed snapshot after any attempted mutation. The service must preserve request idempotency and transaction/CAS semantics across network ambiguity; client request keys are not authorization or stable student identity. A fresh read followed by a new deliberate issue-missing request is safe because committed active codes are skipped. No automatic retry exists. The client also rejects older concurrent list responses and suppresses results if any context field changes before dispatch, HTTP completion, body parsing or UI completion.

## Affected verification

- `node --test tests/n88-class-management-client.mjs`: 6 focused tests PASS (`n88_class_client_ack_owner_roster_revision_and_secret_boundary`). Covers strict ACK, owner/session/lease/class/term/context fencing, no default readiness, actual server roster CAS rejection, rejected HTTP without parsing private error body, current selective membership/version, unknown visibility denial, credential shape/duplicate/existing-code replacement denial, partial batch and missing-only retry, deadline including lost JSON, one-shot request key, concurrent writes, stale owner body, redacted transport failure and non-optimistic visibility.
- `node tests/n88-class-management-browser.mjs`: `n88_class_roster_batch_selective_actions_visibility_actual_ui` PASS at 390 and 1280. Actual source module DOM/handlers/client/app CSS over task-owned HTTP with 30 fabricated students. Covers full roster, six explicit field choices and valid ACK/readback, 19 created/10 existing/1 failed, retry 1 created/29 skipped, doubleclick coalescing, copy/print and print CSS visibility, clear, selective cancel/rotate/revoke, lost ACK followed by readback, explicit uncertain result, context drift and delayed owner switch, clearing visible sheet on owner switch and expiry, storage/URL/log boundaries and dispose. Machine evidence with source hashes: `tests/n88-class-management-browser.json`.
- Credential-free screenshots `tests/fixtures/n88-class-management/roster-{390,1280}.png` use actual source CSS and were inspected. No generated code exists at screenshot time.
- Syntax checks on new production JS; `git diff --check`. No full build or unrelated suites needed for the unregistered module. Existing unchanged service/PG/activation evidence is retained rather than repeated.

Canonical `withIsolatedLocalBrowser` validates this running synthetic card and run ID and owns fresh disposable contexts, loopback allowlist, blocked Service Workers/external traffic and finally cleanup. The task owns a unique OS-assigned loopback port and closes its HTTP server in finally. This eligible isolated phase does not acquire the shared live-browser lease. No shared queue/status/lock, unknown process or user browser was changed. All local checks are module preparation evidence; route/store/server composition is the separate integration card, and hosted access, Production and PO acceptance remain unclaimed.
