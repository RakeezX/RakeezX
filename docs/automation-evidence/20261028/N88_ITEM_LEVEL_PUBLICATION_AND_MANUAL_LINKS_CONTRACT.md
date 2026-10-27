# N88 — مراجعة نشر الأعمال والدرجات V2 (مقترح خامل)

AI-authored, 2026-10-28. Task `continuous-n88-work-and-grades-publication-contract-20261028`, run `bd46ac28-a9c6-4e00-97a1-9aac2d27dc11`.
Base: `3fb70a8f91bfc5dbedbf6ae4ff29e608234815d1`.

## النتيجة وحدودها

مقترح مصدر قابل لإعادة الاستخدام، ومسودة مراجعة محلية في الذاكرة فقط. لا مسار مسجل في التطبيق، ولا زر نشر حي، ولا حفظ في حساب المعلم، ولا طلب خدمة أو قراءة بيانات حقيقية. لا يدعم الخادم الحالي نشر درجة كل بند على حدة. وصول هذه الملفات عبر الناشر الوحيد لا يفعّل هذه الإمكانية ولا يغلق N88.

Authority: activated source-only card and latest canonical N88 note `[PO-20261028-PUBLICATION-V2-SOURCE]`. The urgent predecessor was observed in controller state `awaiting_po`, candidate `59c056b4a4095eb6d95ba8f9d464860b35342527`; this worker did not run its delivery/provider checks. Its live teacher JS/CSS are untouched.

## مصدر البنود والتواريخ

- `src/models.js` `makeTeaching`: `sectionId`, `subjectId`, `termId`; `makeItem`: `teachingId`, `name`, `scoreMode`, `distributionVersion`; `makeScoreSubitem`: `itemId`, `name`, `value`, normalized stored dates.
- `src/store.js` `score:configure` saves `scoreSubitems.startDate/dueDate`, preserving definition IDs and distribution versions. The proposed adapter consumes a caller-supplied authorized snapshot of those saved records, not a second curriculum list, fabricated deadlines, or student scores.
- `student-portal-class-client.js` supports six **group** visibility flags. `student-portal-task-guidance-client.js` validates `subitemId/title/sourceStamp/revision/executionInstructions/deliveryInstructions/needsRepublication`, with no dates or per-item publication field. Neither response is evidence of V2 support. No current endpoint is called or extended here.

`proposePublicationRows({scope,data,previous,manualTasks})` accepts `data.ownerId`, `teachings`, `sections`, `terms`, `items`, `scoreSubitems`. The caller must obtain these from the current authorized teacher workspace in a later gated integration. Scope is exactly the values `{ownerId,teachingId,sectionId,termId,subjectId}`. One owned nondeleted teaching must reference the owned Section/Term/subject and the same year. Items must belong to that teaching; subitems must belong to those owned parents. This pure fence is not server authorization.

Each distribution subitem produces a work/grade review row. A direct item produces a grade-only row; subitem parents do not produce aggregate grade rows. Stable row IDs are JSON tuples `[kind,parentId,sourceId]`, scoped by the surrounding teacher/teaching/Section/Term. No title-based matching or cross-teaching copying. Duplicate identities or invalid stored dates fail closed. Missing dates stay `null`; existing stored ISO dates are preserved even when outside today's input window.

Each row starts with `{required:false,scheduled:false,completed:false,grade:false}`. Work categories and grade disclosure are independent. These are choices about disclosure, not claims that a pupil completed a task. New rows default OFF. Removal drops the row. Rename/date/value/parent/distribution/revision changes retain identity, refresh the teacher label and reset choices to OFF. Unchanged rows retain the current **local draft** choice within exactly the same scope. Changing owner or teaching cannot inherit choices or manual tasks. Stored legacy group visibility never opts in any item.

`sourceRevision` is a canonical JSON **local content token**, not an existing server receipt/stamp. The tuple includes kind, parent name/mode/revision/distributionVersion/updatedAt/max, source revision/distributionVersion/updatedAt, title/start/due/value, manual description/link. A future server must recompute this from canonical records under locks, or replace it with a server-minted equivalent through an explicitly updated adapter. It must also version actual grade content in its student projection. Do not pass today's guidance `sourceStamp` off as a date/grade V2 token.

## المسودة اليدوية والرابط

`manualTaskDraft` validates title (1–200), teacher description (0–2000), an explicit stable draft ID (1–100 ASCII letters/digits/underscore/hyphen), optional start/due and at most one optional supporting HTTPS link. The UI generates session-local IDs; a future custodian must allocate durable collision-safe identities.

New date inputs use the existing `rakeez-datetime.js` adapter with `data-rakeez-datetime="date"` and `data-rakeez-date-scope="planning"`. Validation uses `rakeez-datetime-values.js`, its central planning bounds, digit normalization and optional semantics; no competing date policy/picker. A supplied due date cannot precede a supplied start date. Teacher text is inserted with `textContent`.

Links reject non-HTTPS, relative/insecure/javascript/data/file schemes, raw or encoded C0/C1 controls, whitespace/backslashes, username/password/empty userinfo, invalid URL syntax and raw or normalized URLs over 2048 characters. The link is never fetched, previewed, embedded or automatically opened. It renders only as an explicit anchor with `target="_blank"`, `rel="noopener noreferrer"`, `referrerpolicy="no-referrer"`. HTTPS validation does not attest to the remote content. Manual tasks have work choices only, no fabricated grade component.

## Proposed V2 wire envelopes — NOT implemented endpoints

All objects below have the listed fields only; reject unknown keys/types and bound payloads. IDs in scope and bindings are nonempty strings of at most 200 characters. Publication revisions are nonnegative safe integers. Every request is authenticated, owner-bound and same-origin/CSRF protected; client-supplied owner IDs are never authority. `sectionId` is the model Section, corresponding to the current class transport's `classId`; do not silently mix the two contracts.

`publicationCommand` builds this proposed request without sending anything:

```js
{
  version: 2,
  action: 'item-publication-set',
  requestId, // 16–100 ASCII letters/digits/underscore/hyphen, new explicit intent only
  scope: { ownerId, teachingId, sectionId, termId, subjectId },
  binding: { sessionId, leaseId, contextRevision },
  expectedMembershipRevision, // bounded opaque roster/membership revision
  sourceId, rowId, expectedSourceRevision,
  expectedPublicationRevision, // 0 only if never published/tombstoned
  decisions: { required, scheduled, completed, grade }, // booleans, no implicit defaults on server
  manualTask: null // or exact {id,title,description,startDate,dueDate,link}
}
```

Server gate, in one transaction: authenticate current owner/session/lease/context; verify active Teaching → Section/Term/subject and memberships; lock the canonical parent/source and publication; compare membership, source and per-item publication revision; validate decision capabilities/manual payload; atomically persist the chosen disclosure, **increment only that item's revision**, and write its idempotency receipt. Manual ID must match `sourceId` and row identity. Server recomputes source tokens/URLs/date validation; no trusting an altered client row. Retired sources cannot be resurrected by replay. A parent source is never permission to disclose a hidden child grade.

Uniqueness is `(owner,teaching,section,term,rowId,publicationRevision)`. Two different rows may each have revision 1. Receipt key is `(owner,requestId)` with an immutable canonical command digest. Same ID/same bytes returns the original result after authorization; same ID/different command rejects. Revision conflicts reject without changing any item. COMMIT and receipt must be atomic; losing the ACK leaves UNKNOWN on the client. A real implementation must prove rollback and concurrent membership/source/owner changes; the in-memory fixture is not such proof.

Exact receipt:

```js
{
  version: 2, scope, binding, requestId, rowId, sourceRevision,
  state: 'applied', // or 'rejected', only for durably recorded non-application
  publicationRevision // expected + 1 for applied; expected for a rejection reconciled by this codec
}
```

Exact fresh reconciliation result is the receipt fields plus:

```js
{
  fresh: true,
  membershipRevision,
  decisions: { required, scheduled, completed, grade }
}
```

`fresh` is an assertion supplied by a future authenticated, no-store service read in a new current transaction, not freshness proven by a client boolean. Receipt lookup is read-only and checks current access while correlating the original request/row/source/binding. `reconcilePublication(command,currentScope,receipt,fresh,currentBinding)` requires matching scope/session/lease/context, original request, source, roster revision, expected-next revision and choices. Missing/malformed receipt, timeout, stale read, changed source/membership, unknown outcome or contradictory response remains UNKNOWN. Owner/session switch blocks reconciliation. **Every return has `retry:false`**, including rejection: new intent requires a fresh review; never regenerate/resend UNKNOWN after reload, successful listing or retention expiry. If another later revision superseded it, preserve the original receipt and require explicit reconciliation rather than inferring success from the newer row.

There is deliberately no mutation dispatcher, network adapter, receipt persistence or automatic recovery loop in this card. A later real integration must reserve bounded owner-scoped uncertainty hints before sending, survive remount/reload, and keep the exact original request identity without storing grades/names/credentials in hints.

## Privacy, retention and student projection gate

Proposed custodian retention: keep immutable command receipts for at least 30 days **and until any UNKNOWN referring to them is resolved**, whichever is longer. Term retirement must deny mutations before archival/purge. Keep source/publication tombstone identity and highest revision through the term's lifetime and at least 30 days after retirement; no reuse of a purged request/source identity. Expiration never means success or permission to retry. Final retention/purge policy needs separate privacy approval before implementation; none is applied here.

On source deletion, membership removal, teacher withholding or term retirement, revoke the affected student projection transactionally and invalidate any service cache; source tombstones prevent stale snapshot restoration. Re-added source content needs a new deliberate OFF-to-ON decision, even if its name is identical. Subsequent revisions cannot silently carry disclosure across a source change.

`projectStudentFixture` is a synthetic projection specification, **not** a student API or security control. It consumes a current owned scope, active student/enrollment/roster membership, source rows and fresh confirmed publications. It whitelists work fields and individually allowed grades only, matching exact pupil/enrollment/source/owner/Teaching/Section/Term. Stale, duplicate, tombstoned or unknown publications disclose nothing. Draft choices alone disclose nothing. No total, rank, denominator, hidden score components, parent aggregate of subitems, pupil roster or internal source revision is returned. The future server must perform these checks on every fresh read, also checking enrolled student's own session and source grade revisions. Coarse legacy flags may restrict disclosure further but cannot create per-item permission.

## Activation gate — a separate precisely scoped card is mandatory

Before ANY actual server publish link, schema/Auth/RLS operation, real pupil/teacher read/write or route integration:

1. Obtain named custodian/provider operations and exact data/privacy approval, fixture allocation/disposition, migration identity and service rollback/UNKNOWN safeguards. No permission is inferred from this source draft or generic frontend publication.
2. Implement/verify actual server ownership/term/membership CAS, unique item revisions, tombstones, durable receipts and no-leak student projection. Qualify with the complete real application local fixture first, including valid parent/child dependencies, delayed/reload/owner-switch and concurrent failure cases.
3. Apply/read back only the explicitly authorized backend capability before frontend readiness. The generic publisher does Git/build/Cloudflare/assets; it cannot supply missing migrations or service deployment.
4. Verify real authenticated teacher entry guard and current student's read with precisely approved synthetic identities and cleanup; prove hidden grades/aggregates stay private, freshness/withholding and UNKNOWN reconciliation. Do not consume any earlier retired live pair or substitute this simulator for that proof.
5. Only after the above may the sole controller/publisher integrate an authorized active teacher/student UI. Any new startup dependency then needs its affected offline-shell check and exact `sw.js` authority. This card adds no startup dependency and touches neither SW nor N44.

## Affected checks and retained evidence

Final local result: **6/6 pure tests PASS**, actual dormant-component browser **PASS**, syntax and scoped whitespace/path assertions **PASS**. Browser report records owned server/browser closure and `RELEASED integration`. These are source/synthetic results only.

- `node --test tests/n88-content-publication-v2-20261028/contract.test.mjs`: real pure modules; saved dates/identity/add/remove/rename/default privacy; fixtures 0/1/30/50 fabricated pupils; independent grades; owner/Teaching/Section/Term/subject and enrollment failures; manual HTTPS/date validation; synthetic CAS/idempotency/source+roster conflict and UNKNOWN reconciliation. No database/provider proof is claimed.
- `node tests/n88-content-publication-v2-20261028/browser.mjs`: actual new dormant component DOM, handlers and source CSS mounted by a minimal synthetic HTTP host, **not a recreation** and not a route in the live portal. Canonical isolated browser helper; fresh disposable Chromium context; explicit task-owned loopback origin; Service Workers/external requests blocked; integration phase lease for the owned server, finally cleanup. `browser-evidence.json` records PASS, zero page errors/external requests and released resources.
- `review-desktop.png` (1100px) and `review-mobile.png` (390px), visually inspected: source dates, independent choices, optional date form and explicit local-only notice; no horizontal overflow. The manual title/description deliberately contain literal HTML attack strings to demonstrate text-only rendering. Unsafe links are rejected by the actual submit handler. Reload discards draft, source rename resets the changed row, owner switch clears manual text and rows.
- The final browser check also exercises the exact-scope guard, add/remove synchronization and fail-closed form hiding; pure tests cover exact receipt keys and current-binding reconciliation. No live Preview or unrelated suite was run.
- Syntax checks and scoped Git whitespace/path checks only; no full build required for these unimported modules. No queue/status/ledger/provider/service/SQL/Auth/RLS/live portal/SW/N44 change, push or deploy performed.

Local source readiness only. Provider/service activation, Production evidence and Product acceptance are outside this result.
