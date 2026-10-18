# N88 shared-network successful-login budget correction

AI-authored. Task `continuous-n88-shared-network-success-budget-20261018`, run
`151cbf7c-52a6-4fc7-96a5-b899497b8c6f`, base
`5818ce1be00be34cfc94bc9dfae5dafe137dfd94`.

The delivered six-digit service charged successful sessions against its security
limits. The correction keeps source6/global100 failed-guess limits per15minutes,
but settles only a successful request's own provisional charge after its new
session transaction receives the existing fenced synchronous COMMIT acknowledgement.
Actual35 distinct fabricated students now succeed behind one trusted provider IP,
both serially and in concurrent waves of four across two service instances.

## Durable admission and proof

The independently committed admission phase consumes signed-ingress replay state,
checks both security budgets and increments BOTH before any numeric credential
lookup/format check. Exhaustion denies before lookup even for a known-valid code.
A blocked request cannot acquire a refundable attempt. Trusted identity remains
Cloudflare provider metadata -> HMAC ingress -> server-keyed aggregate bucket;
body/source/success flags and forwarded headers cannot choose the budget.

Each server-created UUID attempt stores exactly its source/global bucket keys,
independent epoch UUIDs, original expiry bounds, optional new session ID and a
settled bit. Session creation and that ID bind atomically in the existing global
repository lock/transaction. Only after COMMIT ACK does the repository mint an
opaque object capability held in a WeakSet. Settlement checks that exact object,
the durable original receipt, matching current bucket keys/epochs/expiries, and
the corresponding committed new session. Receipt settlement and BOTH decrements
commit atomically under the SAME lock. No reset, negative counter, transferable
credit, browser token or diagnostic proof is introduced. SQL protects immutable
attempt binding and one-way session/settled transitions.

Duplicate/concurrent settlement applies once. A guessed, cloned, different-source,
old-window or replacement-epoch proof cannot refund. Foreign repository instances
cannot use an in-memory proof, while durable state prevents replay on the issuing
instance. Failure/rollback, a crash boundary after admission, and an unknown session
COMMIT retain charges. In particular, a committed session with lost acknowledgement
returns generic denial with NO proof. A failed settlement can leave an otherwise
known-successful request charged. A later retry pays its own admission and may only
settle that new debit. There is deliberately no background recovery of ambiguous
attempts after restart; they remain charged until their original bounded windows end.
Legacy rate counts/windows are retained when their server epoch is first attached.

Receipts have a maximum original-bucket expiry; expired receipts/rates are removed
on the next trusted claim phase. State caps:10000 receipts,10000 rate keys, per-row
SQL bounds, existing4MiB extension snapshot budget and repository deadlines.
Expired idle state remains bounded even without later traffic. Admission writes
only changed rows; retained receipt history is not rewritten for every claim.
WeakSet capabilities are garbage-collected with owned request references.

## Separate flood and backpressure roles

All verified claims, including successful ones, consume separate source120 and
global1200 request counters per15minutes. These saturate, expire on their own
fixed windows and NEVER refund. They do not authenticate a student. Existing
8-inflight handlers per service instance and bounded pool/acquisition/lock/transaction
fences remain. Requests rejected at that ceiling receive generic503/unavailable;
authentication, guess exhaustion and admitted flood denials use generic401/unavailable.
No response reveals account/class/code/source existence or SQL details.
Six provisional guesses can temporarily bound concurrent authentication per source;
the35-student proof uses realistic waves of four, not an unbounded35-request burst.

## Focused evidence

- `tests/n88-six-digit-shared-network.json`: actual signed gateway/current teacher
  Auth/restricted native PG;35 teacher-issued distinct codes,35 serial +35 concurrent
  successes and70 sessions with zero security charge;120 real successes then source
  flood denial; fivewrong+valid+nextwrong boundary; exhausted valid prelookup denial;
  independent sources/global100; malformed/unknown/revoked identical denial.
- Same report: rollback, COMMIT-before failure, actual COMMIT/lost ACK, admission-ACK
  crash boundary, failed settlement, service AND nativePG restart, retry retains
  earlier charges; exact-once concurrent settlement, forged/foreign/old-window/
  epoch/source-binding rejection, no negative counters, abandoned receipts charged.
  Crash behavior is a deterministic fault at the commit boundary followed by actual
  service/nativePG restart; no unknown process was killed.
- Same report: separate20-request backpressure scenario; actual application teacher
  class/store/owner entry with35 fabricated rows, source CSS, and universal student
  DOM/handlers login plus reload in fresh canonical isolated HTTP browser contexts.
  No replacement HTML, secret screenshots or credential-bearing logs.
- `tests/n88-six-digit-shared-flood-window.json`: explicit fabricated global request
  high-water1199 -> one success ->1200 fresh-source denial before lookup, retained
  after restart while security charge stays0. Explicit elapsed-window fixture
  creates a new epoch/count1. This is a bounded fixture, not1200 redundant requests.
- `tests/n88-six-digit-shared-launcher.json`: executable PowerShell launcher from
  final source, six-v1/settlement-v1 receipt, actual teacher/student documents and
  ownership-matched graceful shutdown of only its HTTP/nativePG/receipt resources.
- `tests/n88-six-digit-shared-artifacts.json`: fresh source/output hashes, private
  attempt/RLS/guard metadata, four-version migration chain and rejection of missing
  identity. Six-digit format/capacity, private browser dependency graph and SW are
  unchanged; their valid prior proofs are reused.

Initial module loading failed before resources were acquired because the worktree
lacked the locked Auth package. Original failure is retained in
`tests/n88-six-digit-shared-initial-dependency-failure.json`; exact existing locked
packages were restored using offline npm ci, without dependency/config changes.
An initial successful local proof was repeated only after changing admission to
write changed rows instead of rewriting every retained attempt; final report covers
that final service source. No paid qualification loop or hosted proof was run.

## Inactive delivery and review

Installed CLI help was read. CLI2.120.0 command
`npm exec --offline -- supabase migration new n88_shared_network_budget_staged`
created `20261018114113_n88_shared_network_budget_staged.sql`. Its SQL twin is
`drafts/n88-student-portal/shared-network-budget.inactive.sql`. Neither earlier
staged migration nor dated report was rewritten. Only owned fabricated nativePG
applied/read back this fourth migration. Prior current manifest/deploy/identities
are saved as `activation/prior-shared-budget-*`; current manifest and expected
metadata cover the final source and new private structure.

Run `powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1`
after integration for a fresh actual-app fabricated review; stop only the matching
returned receipt using `-Stop -Receipt <path>`. Tests close their own browser,
HTTP and PG resources and release the integration lease in finally.

Unchanged six-digit RNG/100000 global reservation/tombstone capacity, teacher
batch/CAS/ACK/revocation, owner/Auth/lease, grades/null-vs-zero/tasks and visibility
proofs at the supplied base are reused. The latest dependent teacher-code recovery
note is outside this correction and remains for its separate controller-owned card.

This is LOCAL source readiness only. N88_ENABLED and browser readiness stay OFF.
No push/deployment, hosted SQL/Auth/RLS/config/routes/secrets/private access,
real students/accounts/messages or live student activation occurred. Fresh separately
authorized service/migration/readback/provider/device activation gates remain outside
this source-only delivery; the frontend publisher cannot apply those service steps.
No Production, real-student usability or PO acceptance is claimed.
