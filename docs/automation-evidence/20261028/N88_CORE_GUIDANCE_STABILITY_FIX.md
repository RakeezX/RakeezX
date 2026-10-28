# N88 stable guidance reader — inactive source remedy

AI-authored. Task `n88-core-stable-guidance-1028`, run
`0e0e1581-90bd-4c3e-9ec8-1c74827ef9cd`.
Base `64174255c82b205227b8c878f8dc0ba097862933`.

**LOCAL_READY for source-only delivery.** The actual current service, signed
synthetic Auth SDK and original fenced PostgreSQL repository now prove an
inactive reader can preserve guidance eligibility while ignoring unrelated
owner-wide projection history. No hosted SQL or service activation occurred.
N88 remains OPEN under `PO-20261028-N88-END-TO-END-STABILITY-ACCEPTANCE`.
The customer's actual provider failure is not independently diagnosed or cleared
by this synthetic result, and the original issuance UNKNOWN remains unresolved.

## Bounded implementation

`createIntegratedService` selects the reader only for guidance-list when BOTH
trusted constructor options `syntheticGuidanceClosureEnabled === true` and
`executionMode === 'synthetic'` hold. Default is OFF. Body/query/browser cannot
enable it; no environment or deployed Edge entry is wired to these options.
Guidance-save and the original list/issue/rotate/revoke/visibility/student routes
keep their existing path, including the original receipt/UNKNOWN handling.

The existing current signed teacher/session, owner lock, class resolver and
term/calendar admission run first. The new operation runs inside the SAME
repository transaction, timeout fence, synchronization and durable COMMIT path.
It supplies all thirteen certified families; an absent family fails rather than
being treated as an empty source. Empty arrays are native query results.

The seven original canonical core families remain complete, owner-bound and
limited to 2,000 rows per family. This deliberately preserves cross-class
enrollment uniqueness, publication binding revisions and the existing canonical
synchronizer. The six projection families are restricted to the current
class/term's teachings and members, including the transferred same-year/grade
teacher context needed by the unchanged portable grade resolver. Relevant logs
retain class participation evidence, including other members' rows; raw scores,
definitions and completions retain the original grade consistency dependency.
No original `studentPortalPublicationBindings`, `projectStudentPortal`, scoring,
visibility policy or guidance authorization guard is changed.

`guidance-closure.inactive.sql` is a new, uniquely named **inactive staging file**,
not an applied migration. The native primitive uses the existing owner key and
core row locks, then bounded selected child row locks. Owner-FK inserts and
core/child FK retargets conflict with the locked parents. Relevant value,
revision, deletion and restoration changes conflict with selected row locks.
Every family retains the 2,000-row and aggregate 2 MiB caps; failures/timeouts
abort. Large *relevant* data and the existing canonical/private-state bounds can
still fail safely. This is not an unbounded-read or latency guarantee.

The existing compiler adds one fixed operation and two exact native routine
identities to `error-boundary-contract.json`. The primitive is owned by the
existing non-bypass `n88_guard`, with fixed `pg_catalog` search path, owner RLS
fence and only named consumed-column SELECT grants in the inactive SQL. The wire
wrapper remains SECURITY INVOKER. Neither is executable by PUBLIC, anon or
authenticated. The original 76/78 operations, identities and migrations remain
unchanged. Both original serial/typed catalogs remain valid without the staged
extension; partial or mismatched extension identities fail closed. No direct
driver escape or replacement repository is introduced.

The official source catalog preserves its historical provider capture verbatim
and adds a clearly labelled synthetic-only qualification. Its read-only SQL
can report the two exact optional routine identities; it never applies them.

## Affected evidence

`tests/n88-stable-guidance-20261028/result.json` records the completed single
native service comparison and guard group:

| Synthetic members | Class list old/new | Old guidance, unrelated 2,001 logs | Old guidance, unrelated 2.2 MB score definition | New guidance | Tasks |
| --- | --- | --- | --- | --- | --- |
| 0 | 200 / 200, identical | 503/source | 503/source | 200 | 0 |
| 28 | 200 / 200, identical | 503/source | 503/source | 200 | 4 |
| 50 | 200 / 200, identical | 503/source | 503/source | 200 | 4 |

Before adding unrelated history, original full canonical versus new scoped
canonical give exact guidance source/binding/stamp equality. After adding it,
the new response equals that original baseline. All rosters retain zero active
codes. Request-body flag injection and a constructor flag without synthetic mode
leave the old failing path selected.

The same group proves:

- Raw grade inconsistency for all 50 members suppresses tasks identically on
  both paths; removing only that inconsistency restores them. The original grade
  guard is not relabelled, removed or replaced by a grade-free approximation.
- Definition revision invalidates old publication; deliberate synthetic policy
  preparation restores current sources. Absent saved member policy grants no
  tasks. No policy is inferred or silently published by the reader.
- Wrong owner/session/teaching/term, expired signed JWT, revoked Auth session and
  same-year active enrollment in another class deny at the actual service entry.
- Concurrent raw-grade, membership and definition updates, and a new log insert,
  each fail with PostgreSQL `55P03` while the closure transaction holds its locks.
  The writers roll back and the reader completes normally.
- Tampered helper owner and unregistered SQL fail the original private boundary.
  Absent definition and inactive term preserve fail-closed behavior. A delayed
  closure exceeds the repository deadline, returns 503, rolls back and cannot
  commit after the late reply.
- No issuance, rotation, revocation or guidance-save call occurs. Final native
  credentials, issuance receipts and guidance rows are all zero.

Commands actually run:

```text
node tests/n88-stable-guidance-20261028/prepare.mjs --compile
node tests/n88-stable-guidance-20261028/service.test.mjs
node tests/n88-stable-guidance-20261028/registry.test.mjs
```

`registry-result.json` binds the inactive SQL hash, checks the current finite
query registry, exact legacy contract/catalog preservation, original serial and
typed catalog compatibility without extension, rejection of partial extension,
changed-JS syntax and `git diff --check`. The service proof was not repeated
after only compiler/catalog bookkeeping and registry checks changed; its source
hashes still match. The second preparation produced identical SQL and contract
bytes and added the explicitly local catalog addendum.

`preparation-result.json` preserves a real cleanup harness failure: the runner
briefly held checkpoint.json while the second preparation tried to release its
integration lease. Its owned PG had already closed. A later call to the SAME
canonical lease release, with the matching run token, returned `RELEASED
integration`. No lock file or process was manually removed. The initial failure
is retained, not represented as a Product gate failure or silently erased.

## Evidence reuse and remaining acceptance

Reused `316abff426bd35af6d1f3d0df4042a7e9871b00d` and its closure proof rather
than replaying the old grade-free impossibility diagnostic. That prior FAIL was
valid under its old scope and remains preserved. This card materially resolves
the two blockers by retaining raw grades and extending the actual existing
compiler/registry/catalog within the newly approved paths. Prior source-bound
diagnostics, UI/layout, UNKNOWN journal/receipt, student/Sync and offline shell
evidence are unchanged; no unrelated browser, Preview, full Vite build, N44 or
sw.js work was run.

Both owned native PG clusters were closed and cleaned by the existing fixture's
identity-checked cleanup; the integration lease is released. No browser or HTTP
server was opened, and no rendered-UI PASS is claimed. Provider operations,
hosted SQL/Auth/RLS/schema/migrations/deployments and real account/data/credential
operations are zero. Nothing was pushed or deployed by this worker.

The original controller/sole publisher may deliver this inert source candidate.
Enabling a real backend reader requires a separate exact current service-custodian
grant, prerequisite/catalog/FK/role qualification and authenticated end-to-end
readback. Static served-source parity cannot prove service activation, resolve
the original UNKNOWN, or satisfy the teacher/student refresh/re-entry journey.
The original controller retains that continuation and N88's final acceptance.

The [Supabase function security documentation](https://supabase.com/docs/guides/database/functions)
was consulted for invoker/definer and EXECUTE handling. The required changelog
fetch returned an unsupported-content-type error; no new Supabase SDK/API behavior
or provider configuration is introduced.
