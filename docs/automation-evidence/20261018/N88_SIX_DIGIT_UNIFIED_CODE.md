# N88 — six-digit universal credential amendment

AI-authored. Task `continuous-n88-six-digit-unified-student-code-20261018`, run
`f6931c38-05f6-4d7d-bf8c-0a9e3ba95681`; base
`df94a3c43681a4ee1842ac938e025a51cf8920e7`. Local synthetic source preparation; current result LOCAL_READY.
No push/deploy, hosted SQL/Auth/RLS/secret/route operation, real-data read/mutation,
real message or live student activation. N88 remains open; all published switches
and browser readiness remain OFF.

Current contract is a STRING matching `^1[0-9]{5}$`: prefix 1 plus five uniformly
cryptographic `randomInt(0,100000)` digits, including both endpoints. No teacher ID,
private link, class question, user-selected code, numeric coercion or length fallback.
Existing Arabic/Persian digit and space normalization is preserved only in the UI;
server retains its explicit ASCII edge-space policy and strict shape. Paste and
excess insertion reject before native maxlength can truncate into a valid code.
Teacher guidance, delivery validation/copy/print sheet, universal form and current
review launcher use the same contract and actual application.

Reservations keep the original global stable-key HMAC, owner/student binding,
unique SQL reservation index and immutable revoked tombstones. New rows carry
`six-v1`; historical absent-format records are untouched and do not count toward
this namespace's 100000 retained reservations. Neither deletion nor reactivation
is allowed. The issuer bounds random collision draws to 128, returns unavailable
without changing the old code/sessions on failure, and never claims that collision
budget failure proves the namespace full. SQL serializes insertion and checks the
exact six-v1 count. Existing bounded snapshot row/byte/time/connection limits also
fail closed with unavailable, potentially before namespace capacity; this is not a
claim of 100000 simultaneously serviceable students or of public production scale.
No NIST/AAL compliance claim follows from this short credential.

The actual claim path now independently commits signed-ingress replay consumption
and BOTH trusted-source and global attempt debits before loading numeric credential
state. This uses the SAME restricted PG repository, global advisory lock, deadlines
and durable COMMIT ACK. A later lookup, session write, source synchronization or
projection rollback cannot undo debit. There is no memory fallback. Limits stay six
attempts per trusted source and 100 globally per 15-minute window (successes also
consume them). Trusted identity remains the provider/HMAC boundary, never body or
forwarded headers. Uniform 401/unavailable, existing availability caps, private
cookies, no plaintext storage and secret-free responses/diagnostics remain.

## Actual evidence

| Check | Actual result / evidence |
| --- | --- |
| Actual class → teacher delivery → two universal student entries | PASS — `tests/n88-six-digit-journey.json`; actual app shell/store/owner guard/source CSS, batch/missing-only, six-digit copy validation, selective rotation/revocation, other-student isolation, reload, visibility and lease rejection. 390/1280 screenshots under `tests/fixtures/n88-six-digit/`; secrets closed before capture |
| Current launcher and input boundaries | PASS — `tests/n88-six-digit-launcher.json`; actual PowerShell start/six-v1 receipt, catalog-only amendment preflight, actual universal DOM/handlers/CSS, five-digit rejection, no seven-digit native truncation, Arabic paste normalization. Owned stop closes HTTP/PG/removes receipt. Blank login screenshot inspected |
| Issuer and whole-report redaction | PASS — current `tests/n88-six-digit-security.json`; boundaries/invalid types and lengths, bounded collision, controlled capacity metadata and historical namespace distinction; fabricated locator/message/nested log/page error/stack scrubbed before persistence/console |
| Actual durable attempts across two service instances | PASS — `tests/n88-six-digit-security.json`, current resumed run; actual signed gateway/current Auth/restricted PG, concurrent malformed/unknown/revoked failures, independent source and global budgets, source/header/body-spoof isolation, failed-session-write rollback preserves committed debit, service AND native PG restart preserve limits |
| Actual global reservation, historical precision and full namespace | PASS — same current report; a cross-owner duplicate of a revoked six-v1 reservation rejects on the exact global unique constraint; alternate namespace, tombstone deletion/rewrite reject. Controlled metadata inserts reach exactly 100000 retained six-v1 records PLUS one unchanged absent-format historical record; the next unique reservation fails without changing either count/history. No brute-force claims or sequential credential allocation |
| Inactive artifact graph / SW | PASS — `tests/n88-six-digit-artifacts.json`; fresh source/output identities and six-v1 contract, default OFF, private student graph excludes account/Auth/store; shell/private-route exclusions preserved. Static proof only |
| Hosted/provider/device/Production/PO acceptance | NOT_RUN — outside this inert source-only amendment |

The previous attempt stopped after two fixture setup failures at the unconditional
owner-context insert in `tests/fixtures/n88-integrated-class/seed.sql`. Candidate
`84906bea64dd102319d5f574fa8314ac26e37f8f` saved a different concrete correction:
only that synthetic context insert now uses `ON CONFLICT(owner_id) DO NOTHING`,
and both fixture phases use its exact canonical namespace. This resumed run
verified that saved correction with the complete focused security scenario once;
no constraint or ownership guard was weakened and no dynamic retry was needed.

Original failures remain in `tests/n88-six-digit-initial-history-fixture-failure.json`
and `tests/n88-six-digit-prior-attempt-security.json`; their failed/unrun results
are historical, not edited into PASS. Original transient lease failure remains in
`tests/n88-six-digit-initial-lease-failure.json`. Current successful security proof
is a fresh report with this run ID. Actual app journey/input/launcher and screenshots
are reused unchanged from run `5c861ddc-e8ec-4325-8be2-ef9c8ba7ca45`; this resumption
changes test/report identities and inactive qualification metadata, not the
certified Product JS/CSS, service, issuer or form behavior. The seed correction
has no effect on a fresh ordinary UI fixture with no preexisting context; its
new historical-reservation branch is exercised by the current security proof.

Earlier integrated scoring/projection/teacher-model/Auth/owner/CAS/lost-ACK proofs
at the supplied base are reused for unchanged implementations. Current journey
exercises their connected UI entry; old hashes do not certify modified artifacts.
Historical twelve-digit reports/screenshots and both old staged migrations remain
intact. Prior exact identities/manifest are saved as `activation/prior-six-amendment-*`.
All owned HTTP/PG/browser contexts and integration leases were cleaned up after
both successful and failed runs; no queue/status or controller files were edited.

## Exact inactive migration and review

Installed CLI help was inspected, then
`npm exec --offline -- supabase migration new n88_six_digit_staged` (CLI 2.120.0)
created `20261018110713_n88_six_digit_staged.sql`. No version was invented and
neither prior staged/applied history file was edited. This third proposal adds
format-aware payload constraints and serialized namespace capacity protection;
its twin is `drafts/n88-student-portal/six-digit-schema.inactive.sql`.
`activation/six-digit-preflight.inactive.sql` checks the prior catalog/history and
collision, before this amendment. Full prior metadata identity comparison and
fresh project/privilege/service/secret custody checks remain required at any
separately authorized hosted operation. Current successful native readback verified the exact current
`integrated-expected-identities.json` to the three-version chain. Generic frontend
publishing does not apply migrations or deploy the service.

Use the existing command for a fresh fabricated six-v1 review after source
integration:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1
```

It opens the actual class workflow; its `/student` entry uses the same signed
service/restricted local PG. Only the receipt owner may stop it with
`-Stop -Receipt <returned receipt>`. Tests use disposable loopback contexts,
Service Workers blocked, unique owned ports and finally cleanup; all worker-owned
HTTP/PG/browser phases and integration leases were released. No queue/status,
controller lock, unrelated process, personal browser or real account was touched.
