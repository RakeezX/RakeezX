# STUDENT-REMOVAL-PREVIEW-RUNTIME-01 — 0088 live verification / promotion

Status: PRODUCTION REVIEW — PENDING PRODUCT OWNER VERIFICATION. NOT CLOSED.
Production before source promotion: `74309ac606321fc7d0a458b20bc7b98bc1cd49d5`.
Work-Active was neither read nor modified during this ticket.

## Prepared local candidate

- `store.previewStudentRemoval(studentId, sourceEnrollmentId, sourceRevision)` returns only `outcome`, `reason`, `retryable`.
- Authenticated owner-derived read-only RPC; `delete_pristine`, `end_enrollment`, `blocked`.
- Shared 0029 pristine guard; unchanged source checks extracted into a private shared helper used by end-enrollment execution and preview.
- Local readonly IndexedDB snapshots preserve this-device local-only protection; no Sync push, command envelope, checkpoint or Product write during preview.
- Existing execution independently rechecks authority; preview never authorizes stale deletion.
- Additive migration `0030_student_removal_preview.sql`; no Product data changes during installation, no new tables or table grants.
- Final reviewed/applied migration file SHA256: `a368b7e343884a9406eda26206e13ecb36107cb70dd14525ce5dfbe778d68d4d`. Old `e067...` freeze is INVALIDATED; never apply it.
- Contract: `docs/STUDENT_REMOVAL_PREVIEW_RUNTIME.md`.
- Metadata-only checks: `supabase/verify-0030-student-removal-preview.sql`.

## Completed evidence

53/53 PASS: preview client/server, existing lifecycle client/server, frozen handoff and drift/atomic rollback suites, all against the final frozen migration 0030.
10/10 PASS: real isolated PostgreSQL two-connection lifecycle/concurrency suite, including preview behind committed history/deletion and evidence arriving after preview.
4/4 PASS: Build Meta privacy/content checks.
4/4 PASS: transfer/roll safety regression including independent roster integrity, tombstone rejection and offline atomic V2 convergence.
Single `npm run build` in 0088: PASS. `git diff --check`: PASS. Normal content Build Meta regenerated. Production serves the supported content identity, matching the built runtime fingerprint; successful Cloudflare deployment is independently tied to the promoted Git commit. No build-pipeline changes were made.
No real accounts/student records queried or mutated. No frontend UI added.

## Historical delivery blocker (resolved)

Initial linked CLI migration history successfully confirmed the correct project `xlrubcwjqktzzunrvuns`, remote 0029 present, and local 0030 pending. An initial metadata-only query succeeded for existing authority.
Subsequent migration dry-run and exact metadata requests stalled at “Initialising login role”; the dry-run reported `LegacyDbConfigLoginRoleNetworkError` / `TransportError`.
Bounded unauthenticated connectivity checks independently timed out against `https://api.supabase.com/v1/projects`; `https://rakeezx.com` returned 200. HTTPS DNS retry did not restore management endpoint connectivity.
Only these verified stalled read-only/dry-run CLI jobs were stopped. No actual migration apply was started. No source commit/push/deployment.

## 0088 live verification and supported history alignment

Product Owner manually applied the final frozen 0030 successfully. DO NOT apply it again.
Live metadata-only postcheck completed successfully: all five reviewed normalized bodies, signatures, attributes and effective privileges match.
Security fingerprint remains `18fa8c7a905e4dc5072924798d8a4af3b1a750e744318128baae5e33aa28f8a6` (identical to the approved pre-apply fingerprint).
Supported `supabase migration repair 0030 --status applied --linked`: SUCCESS. No internal history table was edited manually and no migration SQL was applied by Codex.
`migration list --linked`: all local/remote entries align, including 0030.
`db push --linked --dry-run`: upToDate=true, migrations=[], seeds=[], roles=[]; 0030 will not be replayed by normal tooling.
Authoritative origin/main after fetch still equals the approved baseline; no newer work needs reconciliation.
Synthetic preview evidence is isolated local PGlite / real PostgreSQL plus fake IndexedDB; no live Product rows queried or mutated.
Only reviewed preview runtime, its tests/migration documentation and normal generated Build Meta are in scope. No Work UI is included.
Narrow .gitattributes rules preserve the four SHA-bound handoff files as LF, so Windows checkout conversion cannot invalidate the reviewed byte-level freeze. No unrelated file normalization is performed.

## Production delivery evidence

Runtime integration commit: `d587ac7fc5a281896eaeb655f12f80f82d97684f`; pushed and remote main verified.
Cloudflare Pages check: completed / success for that exact commit.
Signed-out isolated-browser smoke on rakeezx.com: PASS at 390 and 1280, Support readable, visible Home navigation and reload working, no horizontal overflow or console/runtime errors.
Public deployed Build Meta: version 1.0.0, kind content, fingerprint `5ff6d168103490cb3c1585d593b2315987044516dcce0788567a13369bfd7f93`, matching the built runtime. Public deployed transport contains the new preview RPC endpoint.
No real accounts accessed, no live Product rows inspected, no student lifecycle commands invoked; no Work-Active access and no unfinished lifecycle UI promotion.
This delivery-note correction changes no runtime/build input and requires no second build.

Do not touch Work-Active, apply destructive/data-changing SQL, query Product Owner private records, or promote source before migration verification.
