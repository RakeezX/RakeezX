# N88 — canonical task execution and delivery guidance

AI-authored local/inactive result. Task `continuous-n88-task-execution-delivery-guidance-20261018`,
run `da437f4d-bfbe-42af-bcbc-33996358d071`; base
`fdbd680f1f2fd8dfe8cda3daac22fa52475f0681`. No push, deployment, hosted SQL,
Auth change, real data or student-access activation was performed.

The four dependency deliveries were already verified by the independent publisher,
and their published revisions are ancestors of this base. Their exact candidate,
published SHA and served-evidence timestamps are recorded in
`tests/n88-task-guidance-artifacts.json`. They remain awaiting PO, not Product CLOSED.

The current class portal now offers **تعليمات المهام وطريقة التسليم** for existing,
currently authorized published canonical subitems. Two explicit plain-text fields
are bounded to 400 UTF-16 code units each. The teacher deliberately saves/publishes;
the student expands details under the same required/completed/scheduled task.
Title, dates, completion and scoring remain canonical. No submissions, uploads,
message sending, new assignment workflow or scoring writes were added.

There is no supported canonical guidance field. The separate private
`n88_private.task_guidance` proposal stores exact owner/class/term/teaching/subitem
keys, metadata revision, current source stamp and independently generated per-member
scope/source/publication bindings. Existing authenticated class service, canonical
source locks, membership checks and fenced restricted-PG transaction are reused.
Save requires current source binding plus metadata CAS. ACK is returned only after
COMMIT. Unknown/failed saves retain the in-memory draft and report uncertainty;
refresh reads actual committed state. Changed source/revision needs explicit review
before a retained draft can be published. Empty clearing requires confirmation and
retains the revision tombstone. Context change clears ephemeral drafts.

Student projection omits guidance server-side on hidden/disabled work, changed
publication or scope/source revision, deletion or ended membership. Text is never
interpreted as HTML. Markup/script/control/type/unknown-key/overlength inputs fail;
mathematical `1 < 2` and line breaks survive as escaped text. Private metadata reads
are bounded to 2 MB/2000 rows; no new repository query/transaction bypass was added.

Actual commands and evidence:

- `npm exec --offline -- supabase migration new --help`, then
  `npm exec --offline -- supabase migration new n88_task_guidance_staged` used the
  installed CLI **2.120.0**, which generated
  `20261018125611_n88_task_guidance_staged.sql`. The
  [official CLI migration reference](https://supabase.com/docs/reference/cli/supabase-migration-new)
  was consulted. No Supabase skill was available in the supplied skill catalog.
  The staged SQL equals the inactive proposal; all five old migrations remain exact.
- `node tests/n88-task-guidance.mjs`: PASS for both required behavior/security gates.
  Real app shell/router/store ownership guard, teacher client, authenticated gateway,
  service and restricted native PG; same student task after ACK and reload; native PG
  restart durability; unchanged score/task/completion snapshots. Precommit rollback
  and lost postcommit ACK preserve draft and read back revision correctly. Owner,
  class, term, expiry/current membership, stale source/CAS, visibility, revision,
  removal and plain-text/length negatives pass. Current source remains OFF outside
  the synthetic fixture.
- Actual application screenshots in `tests/fixtures/n88-task-guidance/` inspected at
  **390 and 1280** for teacher and student: correct RTL, expanded guidance, preserved
  multiline display and no horizontal overflow. Teacher credential elements are
  masked; student screenshots contain no code. Actual DOM/handlers/source CSS over
  owned HTTP were used, never lookalike HTML or file navigation.
- `node tests/n88-task-guidance-review.mjs`: PASS for the current hidden PowerShell
  launcher, fresh populated teacher/student examples, actual code-form login and
  ownership-matched graceful shutdown. HTTP closed, PG stopped and owned files removed.
- `node drafts/n88-student-portal/integrated-bundle.mjs <installed esbuild 0.28.1 main.js>`:
  final CURRENT bundle generated **once** after the four merged lanes and final guidance
  checks. Previous current manifest/deploy/identity snapshots preserved under
  `activation/prior-task-guidance-*`; prior history retained.
- `node tests/n88-task-guidance-artifacts.mjs`: PASS for exact final source/output
  hashes, source graphs, sixth migration and restricted-PG expected catalog identities,
  readback mismatch rejection, OFF guards, unchanged protected sources and historical
  migrations. Actual SW handlers exercised with synthetic cache/network ports for the
  added teacher module's install/offline fallback and private-path exclusions. This
  is a focused shell-import check, not live Service Worker certification.

Original failed attempts remain in `tests/n88-task-guidance.json`. Initial harness
issues were a missing local locked dependency installation, waiting on a control
inside collapsed details and a transient controller card-read sharing violation.
Dependencies were restored from the existing offline cache only. The expiry harness
initially assumed a synchronous notification from the lease's internal invalidator;
that invalidator emits no subscription event. The corrected real UI check expires
the lease then exercises the guarded refresh entry; a separate owner-switch check
proves immediate subscription-driven clearing. The editor also clears on changed
context at draw/input/click and rejects stale async results. No guard was disabled.

Unchanged E/F/H evidence is bound by file SHA in `tests/n88-task-guidance-artifacts.json`:
credential/scoped Auth/35-student/shared-budget/flood/recovery proofs reused, not rerun.
Credential/class/recovery/Auth/repository/canonical-adapter modules remain identical
to the previous inactive manifest; store/models/scoring/router/app remain identical
to this merged base. The small current UI/service guidance journey is newly checked.

## Local review

From this exact checkout:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1
```

Open the returned teacher URL. Choose **مساحة الطلاب**, then
**تعليمات المهام وطريقة التسليم** → **تطبيق مقارنة الكسور**.
The example asks the student to compare 1/2 and 3/4 with a drawing and bring the
solution in the mathematics notebook. Both fields can be deliberately edited and
saved. For a student review, read عبدالله سالم's code only from his teacher row,
open `/student` on the same returned origin, type the code in the form and expand
that actual required task. Completed/future examples are also populated. No real
credentials or hosted account are used. Do not put codes in URLs or evidence.

Stop with:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 -Stop -Receipt <returned receiptPath>
```

All check-owned resources were closed before this result. The reviewer launcher
starts its own fresh bounded resources only when explicitly run.

## Remaining hosted prerequisites — NOT_RUN

This is readiness for **inactive source-only publication**. All runtime/browser/
student flags, private-document rewrites, routes and provider activation remain OFF.
Any later activation needs separate exact authority, current five-version baseline
metadata comparison and guidance preflight, one authorized application of the sixth
SQL amendment, full current catalog readback, exact service function deployment,
secret-custody/binding and private ingress/log/no-store/SW-exclusion checks. Existing
Auth/scoring safeguards and original migration history remain binding. The frontend
publisher cannot apply migrations or deploy Supabase service functions. No hosted
step, provider verification, Production behavior, PO acceptance or parent closure is
claimed by this local result.
