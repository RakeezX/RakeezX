# N88 integrated class/student checkpoint — BLOCKED

AI-authored. Task `continuous-n88-integrated-class-student-journey-20261018`, run
`c9f4a227-4930-456c-881d-6ffd2ce095fd`, base
`a03b2d5173998b8fca90b7fc34683aad518eebad`.

This is an incomplete implementation checkpoint. No push, deployment, hosted
SQL/Auth/RLS change, real-data mutation or live student activation occurred.
Default browser readiness and `N88_ENABLED` remain OFF. The publisher must not
treat this checkpoint as LOCAL_READY or a qualified activation package.

Implemented source preparation:

- Actual teaching route `#/teaching/:id/student-portal`, hub/roster links, class
  runtime binding to current account/store/ownership command/lease, and response
  fences. Selective rotation can deliberately replace a previously revoked code.
- Existing signed gateway and Auth/PG transaction now compose class/numeric
  operations; class ACK adaptation, canonical projection reader, server-side
  class visibility persistence, new private projection locks/column grants.
- Separate `/student` document uses the universal numeric client and actual login
  view. Its bundled graph excludes teacher Auth/bootstrap/store/analytics/Sync.
  Claim is followed by a private read; canonical work dates/completion states are
  retained in the response allowlist and rendered. No credential URL/storage path.
- Supabase CLI 2.117.0 `migration --help` and `migration new --help` were read,
  then `migration new n88_integrated_class_staged` created the UNAPPLIED proposal
  `20261018102843_n88_integrated_class_staged.sql`. Original baseline SQL/history
  remains untouched. New preflight, deployment contract and generated source
  hashes replace current identities; prior manifests/identities remain explicit
  historical evidence. Extended expected SQL identities are still unqualified.
- Current review launcher now composes actual `index.html`, application shell,
  router, store, ownership and lease gates with fabricated boot and native PG.
  Only loopback-served boot/readiness are substituted. Sync/session materialization
  and SW registration are disabled in that synthetic composition. The actual
  teacher UI has not yet passed the test.

Actual checks:

| Check | Result | Evidence |
| --- | --- | --- |
| Affected JavaScript syntax | PASS | `node --check` on 25 affected modules; no full Vite build |
| Offline packaging | PASS, limited | Installed esbuild 0.28.1 generated current Edge/gateway/private-student graphs; not service/UI qualification |
| Scoped artifact/SW checks | PASS, limited | `node tests/n88-integrated-class-artifacts.mjs`; current source/output hashes, disabled gateway, private student exclusions and actual SW handler in VM; `tests/n88-integrated-class-artifacts.json` |
| Actual app/class/PG journey | FAIL | Two 30-second timeouts waiting for the hub link matching `مساحة الطلاب` to become visible; `tests/n88-integrated-class-initial-boot-failure.json` and `tests/n88-integrated-class-journey.json` |
| Canonical projection/visibility/current identity whole journey | NOT_RUN | The browser never reached the teacher entry, so downstream assertions were not executed |
| Global credentials, durable ACK/retry, session/rate and activation whole journey | NOT_RUN | Complete composed path and current extended SQL identities have not been certified |

The first defect identified in the review server was CRLF-sensitive matching of
the real application bootstrap. Normalizing the served source fixed that matching
defect, but the second run still timed out at the same visible entry. No unchanged
third browser retry was performed. Neither exit success of native setup nor
artifact checks are claimed as rendered UI PASS. No student codes or credentials
were captured in screenshots, output files or logs by these runs.

Concrete retry condition: inspect sanitized console, request status and actual
document DOM/account presentation at the failed checkpoint; identify and correct
the boot, context or entry-visibility cause before rerunning. Preserve this exact
candidate/session and both failure records. Then finish the bounded two-student
batch/lost-ACK/selective retry, grades/null/zero/work/visibility, current roster/
owner/session/term, rotation/revocation, private-cache and mobile/desktop gates.
Complete the native fixture's exact parent/child FK dependencies before testing
deletion/lifecycle cases; the new consumed-column replica is not full topology
qualification. Portable score families remain fail-closed in the existing
projection and need the exact canonical resolver if exercised by this contract.

Local review command (executable diagnostic, successful review NOT established):

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1
```

The launcher returns a fresh receipt and bounded TTL. Stop only its owned process:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 -Stop -Receipt <returned-receipt>
```

Both browser attempts used the canonical isolated-local helper and fresh contexts.
Their integration leases report `RELEASED integration`; owned HTTP/native PG
resources were closed in `finally`. No global live-browser lease or user profile
was used, and no queue/status file was edited.

Later live activation, separately authorized only after local qualification:
verify full consumed metadata/types/PK/FK/RLS/revision and current migration
history; apply only absent exact approved migration versions; export/read back
extended SQL/role/helper identities; provision restricted credentials and separate
numeric/reservation/ingress keys through secret custody; deploy the exact Edge
and gateway bundles; serve `/student` plus its private assets with TLS, no-store
and disabled sensitive logging; verify all service gates before a separate browser
readiness activation. Generic frontend publishing does not perform these steps.
