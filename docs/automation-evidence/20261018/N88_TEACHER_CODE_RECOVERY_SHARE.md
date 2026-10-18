# N88 — teacher active-code recovery and share (18 October 2026)

AI-authored inactive source candidate; task `continuous-n88-teacher-code-recovery-share-20261018`,
run `72d3c8a3-8a69-4e86-8cee-e6c37034035e`, base
`2dee74aea5adfe448eb69c3edc0d2a89a1d0a88c`. Dependency G was already delivered
at this exact base. No push, hosted operation, real identities/messages, live student
access or PO/Product closure is claimed.

The explicit current PO policy supersedes the former one-time handout for NEW codes.
Same integrated authenticated teacher class list now recovers the exact active code
and version. Dedicated server-only versioned AES-256-GCM envelopes are committed with
the matching new credential; immutable credential/verifier/reservation/tombstone rows
are preserved. Wrong/missing keys, malformed envelope/AAD or tamper fail generically.
The exact active owned credential is resolved from current canonical class membership
AFTER ingress/current teacher Auth/ban/source authorization and BEFORE envelope SELECT,
decryption or serialization. Student/public paths never access recovery envelopes.

Each fresh96-bit secure nonce has a permanent database uniqueness boundary per immutable
key version; append-only generations retain retired/revoked nonce history across service
instances and nativePG restarts. Only a known nonce collision permits up to eight fresh
proposals, never a failed/unknown transaction replay. Canonical AAD binds envelope ID, algorithm,
version, key version/generation and credential ID/version/owner/student/format. Local CAS
rewrap appends a fresh envelope without changing code/verifier/reservation/version; supported
old decrypt keys remain deliberate. See CURRENT custody/rotation prerequisites in
`drafts/n88-student-portal/ACTIVATION.md`. No actual keys/provider configuration were read
or written; fabricated keys exist only in test-process memory.

Hash-only prior codes stay legacy/nonrecoverable, with an explicit Arabic per-row warning
and selective rotate choice/consequence. There is no inversion/brute-force or automatic
reset. Fresh authorized list resolves server-proven lost-ACK issuance; unknown outcomes
remain uncertain until current server state proves commitment. Refresh never issues.
Revoke/rotate ends old copies' authentication and old sessions, and old encrypted generations
are never selected by any reveal route.

Teacher UI uses escaped bounded names, ephemeral no-store response/DOM only and per-student
user-gesture copy/share. Arabic text includes the student's name, exact six-digit code,
absolute trusted current-origin `/student` URL and entry instructions; code never enters a
URL. No automatic dialog/send/contacts; cancel does not claim sent. Failed copy offers an
editable-selection-only manual field. Context changes, expiry, failure, stale results and
unmount clear plaintext; printing omits code/manual fields. No screenshot or persistent
handout/calllog/debug object stores plaintext.

## Actual focused evidence

- `tests/n88-six-digit-recovery.json`: restricted nativePG + actual gateway/Auth/two service
  instances, restart, encrypted-only storage, AEAD/key/AAD/nonce/tag/version failures, supported
  key rotation/CAS rewrap, nonce uniqueness/eight-attempt bound, restricted roles/browser denials,
  authorization before envelope access; transaction/member-savepoint rollback, lost COMMIT ACK and exact refetch;
  legacy preservation/explicit rotate, old session/copy/revoked reveal denial, concurrent CAS.
  Small affected five-wrong/success/sixth-wrong regression passed. Actual application class route,
  ownership guard/store/handlers/source CSS at390px passed one-click missing-only creation,
  explicit legacy warning/cancel/rotate, reload/refetch exact codes, injected copy/share precise
  Arabic content/cancel/manual fallback, persistence scan, immediate lease/owner wipe, delayed
  response denial and same universal student document login. No clipboard or real share occurred.
- `tests/n88-six-digit-recovery-context.json`: additional changed-path membership removal/stale
  selective denial, same-code restoration, desktop CSS/actual route unmount/reopen, failed
  server reauthorization and logout plaintext wipe.
- `tests/n88-six-digit-recovery-launcher.json`: actual hidden PowerShell final-source launcher,
  current recovery receipt, fresh five-migration/preflight cluster, actual teacher/student HTTP
  documents and owned PID/birth shutdown/cleanup.
- `tests/n88-six-digit-recovery-artifacts.json`: LF source/exact output hashes, fifth migration
  twin, local expected metadata/readback rejection and inactive/server-only graphs. The native
  expected-identity snapshot includes actual recovery constraints/RLS/grants/append-only trigger.
- Original missing package load failed before leases; restored existing locked packages offline.
  Original legacy fixture harness omitted the canonical synchronizer; corrected the test, retaining
  `tests/n88-six-digit-recovery-initial-legacy-harness-failure.json`. Neither failure became PASS. The additional context harness assertion failures are retained
  separately: removed membership is excluded by the current list and stale selective
  input returns409; no guard was weakened. The corrected logout check exercises the
  real signOut entry with an owned fabricated logout transport rather than a nonnotifying
  fixture setter.
  An initial focused pass is retained; the final expanded app check additionally covers actual UI
  missing-only creation and legacy explicit choice with current CSS.

Reuse delivered G `tests/n88-six-digit-shared-network.json`, flood-window and prior graph evidence:
35 students behind one trusted IP, serial/bounded concurrency, exact-once settlement, global/source/
window isolation, crash retention and flood/backpressure. The numeric module is byte-identical to G.
Unchanged six-digit crypto/global100000 capacity/tombstones, scoring/projection/visibility and full
Auth evidence are reused; no broad rerun, capacity enumeration or hosted qualification.

## Inactive service prerequisites and review

Actual installed CLI2.120.0 help/history was inspected. Command
`npm exec --offline -- supabase migration new n88_code_recovery_staged` generated fresh version
`20261018115648`; only that new staged file and its proposal twin contain recovery DDL. Earlier staged
migrations/review receipts/dates are untouched. Compare the complete four-version baseline saved as
`activation/prior-recovery-*`, then run new metadata-only recovery preflight and the fifth migration
ONLY under separate exact hosted authority. Native local fixtures applied/read back all five.

CURRENT final manifest/deploy/readback hashes include the server envelope module, private structure,
actual teacher class/client/CSS and new key custody names; browser/student bundles contain no recovery
key or envelope code. N88_ENABLED, browser readiness, routes and activationPermitted remain OFF.
Fresh service installation/readback, supported key custody/version binding, exact roles and provider
activation are still outside this inert source-only task. Frontend publisher cannot supply those.

After integration, `powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1`
opens a fresh owned fabricated review of the SAME actual teacher class and universal student page;
its new receipt identifies `teacher-active-code-aead-v1`. Stop with the ownership-matched receipt.
Arabic synthetic names replace the visible OTHER_NAME marker. Historical receipts are unchanged.
All test-owned browser/HTTP/PG resources closed; integration leases released in finally.
