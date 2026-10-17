# N88 runtime — inactive activation artifact

AI-authored. This package is executable server code, **not an enabled endpoint**.
`deployment.inactive.json` remains `enabled:false/sourceOnly:true`; neither app,
router, student Production page nor Service Worker imports it. No listener starts
and no environment, credential or network is read at import time.

## Concrete mapping

Canonical schema sources are migrations `0001_core_schema.sql`,
`0012_sync_v2_server_protocol.sql` and `0021_section_archive_lifecycle.sql`.
`owner_id + students.id` is the stable identity. `enrollments.id/section_id` supplies
the current enrollment/class; `enrollments.revision` is the actual server-assigned
Sync revision, not a timestamp, name hash or client revision. Every transaction
refreshes enrollment status/end_date/deletion, student status/deletion and section
and year lifecycle. Missing or ambiguous current memberships deny student access.
Old membership parents remain inactive for session foreign keys. New canonical
enrollments are never created by claim/read. No term, year or membership transition
changes a credential. New sessions bind to the verified current enrollment/revision.

Actual stores have evaluation `items` belonging to `teachings`, not an assignments
or submissions store. Eligible manual (`auto IS NULL`), undeleted items on active
terms in the section's year supply **unpublished candidates**. Source IDs are kept
privately; a deterministic UUID identifies each owner/enrollment/teaching/item
projection. A new source starts with its canonical item name and empty instruction,
no due date and `todo`. Teacher publication/title/status are explicit portal-only
editorial updates; they do not update item names, scores or infer completion from
grades. A later canonical name change does not overwrite this editorial title.
Source/teaching/term disappearance retracts the projection; restore requires new
explicit publication. No scores, notes, attendance, name, owner or class appear in
the student response. Progress counts only these explicitly published projections.
This implements the bounded read-only foundation, not all future N88 assignments.

## Atomicity and limitations

The PG repository retains its global N88 advisory transaction lock, durable commit,
bounded snapshot, rollback/time fences and tombstone constraints. Its trusted
`synchronize` hook reads canonical sources and flushes portal membership/publication
changes within that **same** transaction. The fixed SECURITY DEFINER helper in
`canonical-lock.inactive.sql` acquires SHARE locks on the seven source tables until
commit. Backend needs SELECT access and EXECUTE on this helper, not source UPDATE
grants. Helper ownership must be a separately approved controlled NOLOGIN role.

Existing Sync mutation/natural-identity locks are not the N88 lock. Generic Sync
RPCs, enrollment/transfer/lifecycle RPCs, restore, grade import, and privileged SQL
writers do **not** promise to take N88's advisory lock. PostgreSQL SHARE table locks
block their RowExclusive writes anyway; the focused test proves this for an
otherwise noncooperating writer. Multi-table writers can deadlock against this
coarse pilot locking; lock/statement/transaction deadlines fail closed, no retries.
DDL/restore that removes required sources also fails closed. This is bounded small
pilot serialization with database-wide source write contention, not public scale.
Do not silently replace locks with TTL copies or assume existing RPCs cooperate.

## Exact remaining hosted operations (NOT executed)

1. Obtain the separately bounded hosted schema/private-access authorization. Check
   actual applied migration identities first; **do not apply anything twice**. The
   previously qualified SQL was local PG only. Prepare reviewed migrations from
   `schema-proposal.sql`, `postgres-repository-schema.sql` and the new fixed lock
   helper as needed. Keep private schema unexposed to PostgREST/frontend roles.
   Approve exact backend role/SELECT column grants, private table DML, helper
   owner/EXECUTE and bounded pool without granting canonical writes or frontend
   access. This artifact itself grants none of those permissions.
2. Execute `readback.inactive.sql` under the proposed backend role and read back
   migration/function identities, exact columns/types, RLS/ACL and limits, capturing
   fixed facts only. Prove concurrent canonical lifecycle writes block, and that
   commit/rollback/source loss revoke access correctly on an authorized synthetic
   hosted fixture before any real student activation. No real roster enumeration.
3. Supply a **real independently verified current Auth session resolver** to
   `verifyCurrentSession({token,userId,signal})`. Existing browser Auth session and
   decoded JWT/user_metadata are insufficient. The concrete verifier already calls
   existing Auth `GET /auth/v1/user` with the bearer and compares the independent
   session's verified user ID/current state. GoTrue's user response alone provides
   no independently verified current session ID. This repository has no trusted
   opaque-session introspection endpoint; one must be explicitly provisioned or
   an approved verified server Auth integration supplied and read back. Do not invent
   `/introspect`, decode a JWT, trust a body session ID, or accept a stale session.
   A missing port makes preflight throw; no fixture fallback exists in runtime.
4. Provision the five environment names in `deployment.inactive.json` privately;
   values are never part of this artifact/evidence. HMAC key must be >=32 random
   bytes (same across instances; rotation requires a revocation plan). Inject a
   bounded pg pool (`acquire` returns query/release(error), max 2, bounded queue,
   verified TLS/database identity, destroy uncertain clients). Run code on trusted
   direct TLS Node ingress. Only socket remoteAddress supplies source budget identity;
   no Forwarded/X-Forwarded-* headers are accepted. A Cloudflare/reverse-proxy route
   is **not** supported by blindly enabling forwarded headers; it requires a separate
   reviewed authenticated ingress adapter plus its own exact activation diff.
5. Before attaching routes, configure direct TLS host/header/body/time limits and
   private log policy: no URL paths containing entry secrets, bearer/cookie/body,
   PIN, SQL parameters, database DETAIL or per-owner/student metrics labels. Disable
   TLS host and any intermediary access/error URL logs for private entry/API routes;
   use only fixed operation/status counts. Match the supplied origin; redirect/error
   handling, Secure HttpOnly path-scoped SameSite cookie and no-store stay intact.
   Repository transaction deadline 8s fits within HTTP deadline 12s. HTTP timeout can
   leave an already-started transaction to settle within its own fence; outcome is
   uncertain to the caller and must never trigger an automatic issue retry.
6. The **bounded activation diff** is: supplied verified ports and private environment
   names -> actual schema/readback facts -> explicit `sourceOnly:false`,
   `canonicalReadback:true`, `privateIngressReadback:true` in an approved server-only
   composition -> attach returned `handle` only to listed `/api/n88/` routes.
   `deployment.inactive.json` is a review manifest, not an automatic loader or proof;
   booleans cannot substitute for those recorded facts. Context namespace/owner
   registration is a separate authorized private operation, never client-selected.
   No actual current config flag or hosting binding was changed in this task.

After the service prerequisite has been proven, separately authorize the small
actual teacher/student page integration. Reuse existing client, teacher controller,
student DOM/CSS and date adapters; do not add a new picker or leak the private entry
to logs/analytics/caches. Independent publisher owns source release; generic frontend
publisher cannot deploy these service/SQL/Auth prerequisites.

## Final manual acceptance path after bounded activation

With separately authorized synthetic hosted identities, sign in as the teacher via
the existing Auth flow; select the server-current student and explicitly publish a
source activity. Issue once and privately hand off the individual link/PIN, open it
in a fresh student context, log in and see only the selected published projection.
Update via teacher and refresh student. Move the fixture through the canonical
second-term lifecycle: old session denies, same bookmark/PIN rebinds and sees only
current published work. Rotate, then revoke: old links/sessions/PINs deny. Repeat
the targeted negative current-owner/session/membership checks and verify private
logs/cookie/cache/real TLS behavior. Only then seek the bounded real-student/manual
handoff approval. No messages are sent automatically. N88 is not Product CLOSED.
