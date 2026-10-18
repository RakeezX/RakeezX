# N88 — integrated class/student journey, source-only LOCAL_READY

AI-authored. Task `continuous-n88-integrated-class-student-journey-20261018`, run
`01c87cee-6ed3-4bf6-a51c-503fa03b1248`. Base:
`a03b2d5173998b8fca90b7fc34683aad518eebad`. The previous checkpoint
`2fe8981004d885b0ead3f4e88e86983062a1e374` and original failures are preserved.
No push, deployment, hosted SQL/Auth/RLS/secret change or real-data mutation ran.

This card's integrated 12-digit implementation is locally ready. The current
canonical N88 row explicitly assigns the later **six-digit** decision to the
separate dependent `n88-six-digit-unified-student-code-20261018.json` after this
integration delivery. That amendment remains with the controller and is required
before live activation/final Product acceptance. This result does not close N88.

The actual class hub and roster lead to `#/teaching/:id/student-portal`. The
current account/store/ownership command/lease guard fences requests and late
responses. The former per-student route now links to current class management;
retired four-digit/private-link runtime entry points cannot enable old controls.
The public `/student` document uses only its universal client/view/CSS graph:
no teacher Auth, account bootstrap, SDK, analytics, storage or Service Worker.

Class batches, selective rotate/revoke and visibility compose into the same
signed gateway, current Auth verifier, restricted native PostgreSQL repository
and canonical source locks. Codes remain cryptographic, globally reserved and
irretrievable after delivery. Durable receipts never contain plaintext; lost ACK
replay is uncertain, never a second issue. Explicit selective rotation recovers a
lost delivery. Grade projection uses current teacher models and exact teacher
portability function bodies over one owner's locked canonical rows, with drift
and actual `store.studentContext` equivalence checks. Source state never becomes
completion merely because a deadline elapsed. Hidden fields are stripped server-side.

## Actual affected evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Actual account-app class → batch → two universal student logins | PASS | `tests/n88-integrated-class-journey.json`: actual shell/router/store/guard, service/Auth/native PG, reload, two-student isolation, selective rotate/revoke, lease rejection |
| Canonical grades/work/visibility and transfer | PASS | Same journey: `[8,0,null,4,8,4]`, regular/late/required/scheduled work, six-field omission. `tests/n88-integrated-class-projection.json` plus `tests/n88-integrated-class-final-service.json`: exact actual teacher context equivalence, transferred zero, ambiguous groups/incompatible automatic settings stay null |
| Lost ACK, stale identity/roster/term, rate/Auth gates | PASS | `tests/n88-integrated-class-boundaries.json`: real committed lost ACK/replay, persistent budgets, anonymous denial, term-stable credential, old roster/session denial, expired Auth session/ban, held response after actual owner deactivation |
| Actual UI lost ACK and selective recovery | PASS | `tests/n88-integrated-class-final-service.json`: third canonical member, lost ACK after commit, no false delivery, retry skips three, selective rotation only for target |
| 390/1280 actual UI | PASS | Class/login screenshots from journey; populated student screenshots `tests/fixtures/n88-integrated-class/student-data-390.png` and `student-data-1280.png`. Updated Arabic labels/zero vs unrecorded and synthetic review guidance in `tests/n88-integrated-class-final.json`; images inspected |
| Exact SQL and activation artifact identities | PASS, local only | `tests/n88-integrated-class-sql-identities.json`: actual private constraints/indexes/triggers, roles/helpers/grants/policies. `tests/n88-integrated-class-artifacts.json`: current hashes/graphs, readback tamper rejection, default OFF and actual SW handler exclusions in VM |
| Executable launcher and owned stop | PASS | `tests/n88-integrated-class-launcher.json`: actual PowerShell start/receipt, teacher and student HTTP targets, owned graceful stop closes HTTP/native PG and removes only owned cluster/receipt |
| Projection negative regressions | PASS | `node --test tests/n88-student-projection.test.mjs`: 27 affected tests, including all 64 visibility combinations, owner/lifecycle isolation, atomic-score mismatch and false-completion safeguards |
| Hosted activation/Production/PO acceptance | NOT_RUN | Explicitly outside this source-only card |

Unchanged credential reservation/generator/tombstone and underlying Auth/repository
safeguards retain their prior focused proof; changed path/composition boundaries
were exercised above. No blanket suite or full Vite build was added. Current
bundle hashes replace old graph certification; `prior-20261018-*` is historical.
The canonical origin/main observed for this work remains the supplied base SHA.

## Original failures and concrete corrections

Both original hub timeouts remain in `n88-integrated-class-initial-boot-failure.json`
and `n88-integrated-class-prior-attempt-journey.json`. A bounded diagnostic found
`Invalid resolved Product database name`; the fixture now uses the existing
account database-name generator. The class view also returned an escaped string
inside the app's safe template; it now returns the actual `html` template.
The student path preserves the original signed-request identity instead of
cloning away the ingress WeakMap binding. The second student's seed is now an
atomic completion/score fixture generated with the existing score model. Its
original failure and the lost-ACK test's non-JSON-error parsing failure remain
in scoped JSON evidence. No guard was disabled to obtain PASS.

## Run the actual local review

From this candidate checkout or its integrated source:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1
```

The command returns a task-owned loopback URL ending in `/#/teaching/teaching`,
a fresh receipt under `tests/fixtures/n88-integrated-class/receipts`, exact PID/
birth and TTL (default four hours, maximum eight). Open the class's مساحة الطلاب,
choose visibility and save, issue codes, then use the page's `/student` link in a
fresh tab/context. Copy/print only the owned delivery sheet and close it to clear
codes. Everything is fabricated; no hosted service is contacted. Stop only this
receipt's owner:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 -Stop -Receipt <returned-receipt>
```

All worker-owned contexts, loopback servers and native PG clusters were closed
in `finally`; every integration lease was released. No queue/status file, user
browser/profile, unknown process or other owner's lock was touched.

## Exact later activation operations — not performed

1. Complete the controller's dependent six-digit amendment and refresh only its
   affected source/schema/credential/UI proofs and bundle identities. Keep all
   live flags OFF until that final format contract is satisfied.
2. With separate matching authority, independently verify project identity,
   current migration history, existing Auth policy/profile and secret/log custody.
   `activation/integrated-metadata-contract.json` records 109 consumed columns:
   76 match the captured metadata; 33 were absent from that capture and are NOT
   claimed hosted-verified. Fresh authorized metadata/type/PK/FK/RLS/revision and
   management-privilege checks must pass. No new Auth/bypass privilege is implied.
3. Apply only absent approved exact versions: preserved fresh baseline
   `20261018034356_n88_exact_activation_staged.sql`, then additive
   `20261018102843_n88_integrated_class_staged.sql`. Baseline fresh preflight is
   `prior-20261018-preflight.inactive.sql`; additive typed preflight is
   `integrated-preflight.inactive.sql`. Never blanket-push unrelated migrations,
   reapply, rewrite applied history or adopt a colliding private schema.
4. Export metadata only with `activation/integrated-identities.inactive.sql` and
   compare against the pinned `integrated-expected-identities.json` using
   `node drafts/n88-student-portal/integrated-readback.mjs actual.json expected.json`.
   This includes global reservation uniqueness, partial active index and immutable
   receipt/credential triggers, not merely old helper hashes. Expected identities
   describe the staged NOLOGIN role; later custody changes require their own diff.
5. Through approved custody only, provision restricted `n88_backend` LOGIN/TLS
   connection and distinct server keys `N88_HMAC_KEY`, `N88_NUMERIC_KEY`, stable
   global `N88_RESERVATION_KEY`, and signed-ingress `N88_INGRESS_KEY`. No key values
   or credentials are included here. Keep the private schema unexposed.
6. Deploy the exact newly qualified Edge/gateway bundles and pinned locks from
   `activation/manifest.json`/`deploy.staged.json`; configure `/api/n88/*` and the
   exact `/student` document plus `/n88-private/` allowlisted assets on the existing
   origin, HTTPS, private/no-store, sensitive logs disabled and SW/cache exclusions.
   Verify current Auth, ingress, service and served-asset gates before separately
   enabling `N88_ENABLED` and browser readiness for that exact revision. Generic
   frontend publishing does none of these service or secret operations.
