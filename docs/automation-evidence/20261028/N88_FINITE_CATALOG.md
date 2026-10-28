# N88 finite V2 catalogue — executable, inactive source only

AI-authored 2026-10-28. Task `n88-finite-catalog-1028`; run `160ec8df-6fe8-44ba-85ba-6ebd8fa261da`; saved session `01a1822d-de76-76d3-89eb-78fb47247a17`.
Base `721077e475db7f92d64bc9c147e6ee8818f2033a`. Starting worktree was clean, with published canonical binding `503b735e` / immutable integrated source `6b6013e817ff4e782bd7c58713178756bb0dd8d9` already present. Candidate is the AI-labelled commit containing this document.

**Completed:** executable finite statement catalogue, typed parameter/result validators and request-bound one-use capabilities, qualified locally against the actual published durable adapter's generated SQL. **Inactive:** no hosted boundary edits, SQL submission, installation, service enablement, route, UI, positive issuance, account access or canonical lifecycle attachment. N88 remains OPEN. Only the three card paths changed; no queue/ledger/status edits, push or deployment.

## Callable contract and fences

`publication-v2-finite-catalog.inactive.mjs` exports the deeply frozen `publicationV2FiniteCatalog`, its SHA256 identity, and `createInactivePublicationV2FiniteCatalog`.

The factory requires `executionMode:'synthetic'`, trusted `verifyAdmission` and `executeFixed` ports. It has no driver, DSN, environment, network, route or existing hosted-boundary import. It neither opens nor commits a database transaction. `executeFixed` receives only a catalogue-owned literal SQL string, detached validated scalar parameters and an AbortSignal. It returns only `{command,rowCount,rows}`; a future trusted driver composition must strip driver metadata. The unit executor is in-process fabricated data, never a hosted substitute executor.

Usage within an already owned local transaction:

```js
const ticket = await finite.prepare(request, {operation:'owner-context', args:[verifiedOwner]});
const internalRows = await finite.execute(request, ticket);
// finally: finite.close(request); parent transaction owns COMMIT/rollback/client cleanup
```

- **Identity:** server-only `verifyAdmission(request,signal)` returns exactly `{ownerId,sessionId,role,expiresAt,numeric,storageWrite}`. Teacher/current numeric student authority must come from the original teacher SDK/current-session or numeric READ guard in the same locked transaction. This is an injected guard interface, not a new authenticator, browser lease or caller-owned permission. An explicit internal `storageWrite` grant is required for every fixed storage effect. It must follow the existing V2 service guard, including its internal source reconciliation; it must never be copied from request data or inferred merely from a student/teacher label.
- **Numeric bootstrap without circular Auth:** before the original numeric handler can authenticate, trusted ingress/cookie parsing may return `role:'locator'`, null owner/session, `numeric:{tokenHash,credentialId:null,studentId:null,version:null}` and `storageWrite:false`. Only the three fixed lookup reads are available. The locked, validated token row binds subsequent credential/context reads to its exact owner/session/credential/pupil/version. These rows grant no storage/publication authority. Only a subsequent **original numeric Auth** admission with exactly that tuple can upgrade this same request to current student. Foreign tuple, premature context read, storage under locator, and mismatched upgrade deny. The catalogue does not implement or claim to retest the Auth algorithm.
- **Request:** opaque WeakMap ticket bound to the exact request object, catalogue instance and detached command/admission. A ticket is spent before validation/await, including a wrong-request attempt. Changed owner/session/permissions/expiry deny before and after execution. Duplicate identical effects cannot be prepared twice within the same request. Failure poisons the request and invalidates every remaining capability; `close` also invalidates it. No retry or replay is exposed.
- **SQL:** exactly 14 fixed forms: three lookup reads, four bounded storage reads, seven insert/CAS statements. No arbitrary SQL/table/function/role, transaction-control dispatch, receipt UPDATE/DELETE, purge, trigger execution or source-deletion command. Exact parameter counts, primitive types, owner UUID, canonical JSON, safe revisions/positive bigint, hashes, tuple and scope identities are checked. `cas-item` requires increasing revision and no tombstone resurrection; high-water CAS cannot regress revision or clear retirement. Only immutable receipt INSERT exists, with the current session in a new receipt. Reading an immutable historical receipt correctly preserves its original session/outcome.
- **Output:** exact rows/keys/types, matching command/count, owner and numeric tuple; unknown scope references deny. Roots must be owner-validated before child rows/effects. Storage JSON must match the published row/payload codecs, with no raw score, total, rank or extra grade payload fields. Manual tasks reuse `manualTaskDraft`, central date semantics and safe HTTPS normalization, with no fetch/send. Fresh per-pupil projection remains the unchanged original service's responsibility; internal owner-wide storage rows are never a student HTTP response.
- **Budgets:** 5s default, configurable only by trusted construction within 10–10000ms; default/max20000 prepared operations, max20000 returned rows and4MiB returned body data per request. Storage SQL retains its exact overflow probe10001, per-row2097152-byte cap and remaining-byte argument1..4194304;10001 results/null overflow body fail rather than truncate. Lookup rows<=1, numeric payload4096/2048 bytes. Numeric JSON envelope overhead is bounded separately by32 bytes. Roots<=2MiB; publication/receipt payload<=16384 bytes; all arrays/manual tasks retain existing bounds. Admission/execute waits share the same deadline. A timeout aborts the owned signal and ignores late results; the parent must roll back/destroy its transaction/client on rejection or uncertain completion. SQL success alone is **not COMMIT acknowledgement** and is not converted into an applied receipt. The original durable adapter still owns immutable outcomes, CAS, UNKNOWN/no replay and durable tombstones.

## Exact identities for future authorized installation

Catalogue identity is SHA256 of recursively key-sorted JSON for the exported descriptor array, in source order (UTF8, no trailing newline):

`373b98aa5f9594c267fed36523d6affecb58ce20c247704d2605b9510d64aad5`

Each SQL hash covers the exact UTF8 statement, no normalization/trailing newline. Full executable SQL, ordered parameter types, output descriptors and bounds are exported in source; future installation must read these literals, not reconstruct them from this table.

| Operation | Args | Exact SQL SHA256 |
| --- | ---: | --- |
| owner-context | 1 | `f8a1689cd78951d7fc52ef91eb51423510f98cbf717a42c162572b2c69bf692b` |
| numeric-session | 1 | `7874a827dae2373223bc8adc67a2a30d158ed7e1e40183e72a8cff2c1df55a90` |
| numeric-credential | 4 | `6d27c8049efec0665b9d1f91f20f631f036ebb8403a3301bcc211176a6d1c751` |
| read-scopes | 4 | `e1b1c0927f6164faeccb760bbe7678f49ff4bfec39ac0e057b7be9b754ec33bf` |
| read-items | 4 | `f46afed1e023d013cdabf257a722636fc6929997f1612d157d83327bae417a22` |
| read-high_water | 4 | `0dad27a56bfdc5bfab552235376bffb18292e9cfd59f29465272b0ba1bef11f3` |
| read-receipts | 4 | `71a3e914da47cf1053850671fc8c2835603b1bc3490153fbb1784e773e0417eb` |
| insert-scope | 3 | `74c4aa4d430911e99002af80476a8c2647e430d81bd66eff0ce4ca1c1d7ddf12` |
| cas-scope | 4 | `dbe074dae923ca8a3746d390240287893cd777e5f01b8b27fe07477aeda85df0` |
| insert-item | 6 | `a3e6d95cdff2d66f56ae84f6530f07f9bc970a014b2f3a25d31f548173d2c508` |
| cas-item | 8 | `5d62e77b02ab6a1fb4e97688aa1810d3559d998a42ab85a04435819f19017f21` |
| insert-high-water | 5 | `23ccfc1e16cd0b122d0cb3c342a2492cc10f5e108becfcd5b1955b3a42772c73` |
| cas-high-water | 7 | `94bb23dac56c2e002713130ac7ddb2c686561f7c1bbe1f1464a873629c5237fc` |
| insert-receipt | 5 | `3b143936c792a16ff5425c3dd129c1065921837cfaa15fdcc018734517196acf` |

Raw source SHA256 identities:

- New executable module `e9dec5fb83b1897a229e328c6b57ffd8a30ff7bf15f3c4a79bc7a98aa7f1f780`.
- New test `d0fd4a954b9820ba6ead123ba8225032a62263b2b293292fac63b77eff4eb9f4`.
- Unchanged canonical binding `69d502ed38d5fbfd32f5a2114b44d42156f7eae295f1ba408dc9285e4ae0440b`.
- Unchanged durable adapter `0b38130ae2ecf097d72b92722d5157621f6dfa932b80b6079889c22b7edc32e0` and UNAPPLIED V2 storage proposal `399f6d5f513bf0fd3bb3bb9f8a206018e451ed9d6cc5d9a9b7fa89b3a81525c0`.
- Unchanged integrated service `6348d080dc6364d8741be4699afe0f8e71954e3ff6ae4dfb4a1b3c0532caaf64` and existing hosted finite boundary `58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e`.

## New affected verification and reused evidence

`node --test tests/n88-finite-catalog-1028/finite.test.mjs`: **17/17 PASS**. In-process tests exercise the actual new executable validators/capabilities. They include all14 positive operations and an unchanged actual `createPublicationV2PostgresPorts` flush/load composition generating every4-read/7-effect SQL form, retirement state and original receipt preservation. The fabricated executor is not PostgreSQL; it does not claim new concurrency or backend-role/RLS evidence.

Negative checks cover foreign owners/pupils, every argument position's object/coercion, missing/extra args and command fields, forbidden SQL/role/function, oversized/extra/foreign results, unknown scopes, row counts and byte limits, changed/spent/wrong request, duplicate effect, stale/changed admission, lookup-only bootstrap and mismatched upgrade, unsafe manual URLs/dates, regressing CAS/tombstones/high-water, receipt session mismatch, hung admission/execute and late ACK/no replay.

The actual original `assertVerifiedBoundary`/`privateQuery` are exercised against an **in-process synthetic existing-catalogue client**. All14 new SQL forms reject as `n88_database_unavailable`; the only transport invocation is the old identity read. No V2 SQL is forwarded, and no hosted client is constructed. Raw hashes also prove existing source/SQL/boundary bytes unchanged.

Reused unchanged native proof: `N88_CANONICAL_BINDING.md` main14/14 and separately targeted actual-binding UNKNOWN/restart evidence, with report hashes `96511d141e995b9b66e3cd2fa843c0d296229b5fe94bb582a57b21e80621216b` and `7c15959f1a9b7fbdecaa9cc12b92e9687fba15a0ffcf84c9f1b03b4ced07ad8c`. The source identities used there are checked unchanged here. Those tests were not rerun. Prior13/13 native proof is also retained. No claim that the new catalogue has been installed or qualified on real PostgreSQL is made.

`node --check` on the two new JS files and scoped `git diff --check`: PASS. No browser, HTTP server, local cluster or lease was started; there are no owned phase resources to release. No UI/Preview/build check is required by this source-only change. Applied the ticket-router and Postgres least-privilege skill guidance; official PostgreSQL17 PREPARE documentation and Supabase changelog reviewed, with no library/configuration change or provider operation.

## Remaining installation/readback gates — NOT_RUN, separate exact authority required

1. Authorize the exact backend storage proposal/hash above and finite operation installation with the original custodian. Preserve previous refusals; this synthetic factory is **not** a transport for denied hosted statements. It intentionally rejects non-synthetic construction. A future live composition needs its own explicit scoped implementation/authorization, not a mode-label trick.
2. Read back the exact V2 four table definitions, constraints/keys/immutable guards/tombstones, function definition hashes, private owner/search_path/ACL/effective backend grants/RLS and non-exposure. Preserve original installation history; no blind duplicate migration, public grants, new general SQL port or SECURITY DEFINER workaround.
3. Install and read back only the14 exact finite operation identities plus unchanged original Auth/canonical helpers. Verify parameter types/order, output types, row/byte/deadline limits and least privilege, exact role, allowed source pins/catalogue hash and default OFF. Existing hosted `private-error-boundary.mjs` must remain closed until that separately authorized change is qualified. The frontend publisher installs none of this.
4. Compose the exact original teacher/numeric admission and locks with a single owned transaction and fresh session checkpoints, including lookup-only bootstrap and current-Auth upgrade. Bind internal storage permission and capabilities server-side; close them in finally. On failure/timeout/lost ACK, roll back or destroy the owned connection and preserve UNKNOWN, no replay. Qualify genuine backend-role/RLS, independent native connections through the installed finite boundary and actual writer lock order; current local unit evidence is not that proof.
5. Attach original canonical capture/complete retirement to the actual Sync/Delete parent/child/receipt transaction, preserving legitimate dependencies and rollback/restore/no revival. This attachment remains missing. Read back actual service identity, verify current teacher/own-pupil privacy and fresh UI behavior under exact account authority, then deliberately enable a server-owned switch only if separately authorized. No positive issuance or real cancellation is authorized here.

LOCAL_READY refers only to this completed inactive catalogue implementation and affected local evidence; it is not service readiness, Production verification or full N88 acceptance.
