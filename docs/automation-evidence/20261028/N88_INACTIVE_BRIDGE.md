# N88 finite service bridge — inactive local source

AI-authored 2026-10-28. Task `n88-inactive-service-catalog-bridge-20261028`; run `f062793f-0238-456c-a521-c28dc771f379`.
Base `a980406d3e38d92a6386aa459be984b4411be6a1`. Candidate is the AI-labelled commit containing this document.

Implemented only the three activated paths. The canonical operating contract, activated card, N88 OPEN Product row, item/manual-link contract and affected service/canonical/Postgres/catalogue source were read. No queue/status/ledger edits, push, deployment, service installation, database, real account, private-key access, notifications, SW or startup hook. N88 remains OPEN; this is not functional hosted acceptance.

## Bounded result

`createInactivePublicationV2FiniteBridge` composes the **actual unchanged** `createPublicationV2Service`, `createCanonicalPublicationV2Ports` (including its original teacher SDK/current-session and numeric READ guards), its Postgres state codec, and the exact 14-operation finite catalogue. Its only exported capability is a handler. It exports no query dispatcher, transaction, retirement/mutation capability, network listener or acquisition function.

- Default OFF and every non-synthetic mode return the original private denial before dependency construction. Only explicit construction with `enabled:true`, `executionMode:'synthetic'`, the exact catalogue hash and trusted local dependencies reaches the prototype. Body/query flags cannot enable it. It is not imported by application startup or the hosted boundary.
- Each handler invocation owns a distinct request/transaction closure and one finite catalogue state, including COMMIT guards. Admission and one-use tickets cannot be swapped between requests; a repository callback replay is rejected. All 14 SQL forms come from the imported catalogue, never browser fields or a new SQL copy. Request fields carrying SQL/operation names are rejected by the actual service envelope.
- The injected repository must own serial locking, rollback, bounded transaction/cleanup, COMMIT acknowledgement and release. Its original `query` remains the **existing independently finite Auth/canonical port**. The new mandatory `executePublicationV2(sql,args,signal)` is a named local synthetic port for catalogue-owned statements. Missing it fails before any query. No fallback forwards V2 SQL through the old hosted boundary. Unrecognized V2/context/numeric statements fail closed rather than falling through.
- Trusted `verifyAdmission(request,originalPorts,signal)` must revalidate original current identity in the same locked transaction; it is not a browser-supplied proof or a replacement authenticator. Its exact owner/session/role must also match the original service Auth result. Explicit internal `storageWrite` entitlement remains required. Effects additionally require successful original service Auth **and** original canonical snapshot validation. Numeric locator/upgrade rules remain inside the unchanged finite catalogue; the bridge does not authenticate a locator.
- The finite request retains existing operation, transfer, row, expiry and deadline limits. The bridge's outer deadline also fences original canonical calls and COMMIT; the underlying repository retains its own transaction timeout/cleanup responsibility. Any failed query poisons the finite request. Finally closes/revokes the owned catalogue; there is no retry, reconnect, provider construction or alternate SQL path.
- A narrow wire codec reconciles two existing numeric representations: the original session stores a positive safe **number** `membershipRevision`, while the finite internal representation uses text; the original credential stores `format:CREDENTIAL_FORMAT`, while the finite internal credential schema omits that marker. The codec bounds the raw payload, validates the original revision/known format, converts only those named fields, lets the unchanged catalogue validate every remaining field, then restores original numeric Auth types and rechecks bytes. Unknown fields/formats, strings in place of original numeric revisions and unsafe numbers deny. No payload is mutated in place and no original guard or catalogue type is relaxed. This is not new session provisioning or credential issuance.
- Immutable receipts, per-row/source CAS, high-water history, source/session COMMIT revalidation and UNKNOWN/no-replay responses remain implemented by the existing modules. Lost COMMIT ACK stays `{state:'unknown',retry:false}`. An explicit original-command status request can read the original receipt without another effect; later publication state cannot rewrite that receipt.

The original canonical retirement capability is deliberately not exposed or attached to real Sync/Delete. That separately authorized lifecycle integration and genuine hosted proof remain prerequisites to full activation.

## Actual affected verification

`node --test tests/n88-inactive-service-bridge-20261028/bridge.test.mjs`: **11/11 PASS** (in-process fabricated ports; actual service handlers and unchanged canonical/storage/catalogue code).

| Card check | Evidence |
| --- | --- |
| `n88_finite_catalogue_exact_service_adapter_parity` | Actual signed synthetic teacher SDK/current-session entry, canonical 13-family reader, storage load/flush, CAS/high-water source advance and original numeric READ exercise **all 14 exact catalogue operation identities** through the bridge. Original numeric number/format round trip is tested. Current own student receives only `{work,grades}` and its selected grade. Original receipt survives exact repeat, changed-command mismatch and subsequent publication revisions. |
| `n88_inactive_no_hosted_calls_owner_session_limits` | OFF/non-synthetic gates, wrong catalogue hash, missing named port (zero queries), foreign owner/session, expired admission, denied Auth/ingress, wrong source/owner, extra request SQL, numeric revocation/foreign identity/unknown fields/format/unsafe type, overlapping request closures, transaction callback replay, oversized output, stale storage CAS, absent storage entitlement, operation/deadline caps, COMMIT session/source races and lost ACK with exactly one receipt effect. No external fetch/hosted executor is installed; Auth uses the existing fabricated provider fixture only. |
| `n88_source_only_no_status_or_data_mutation` | Only three new allowed files; existing source/boundary and prior finite test hashes unchanged. No app startup import, route registration, old-boundary edit, provider client, real data, queue/status edit, schema/Auth/RLS, SW, push or deploy. Syntax and scoped diff checks pass. |

`node --check drafts/n88-student-portal/publication-v2-finite-bridge.inactive.mjs` and `node --check tests/n88-inactive-service-bridge-20261028/bridge.test.mjs`: PASS. `git diff --cached --check`: PASS after staging the exact three paths.

Preserved initial new-harness failure: after adding callback-replay coverage, 10/11 passed; its assertion expected two owner-context calls, but replay is rejected **before** COMMIT guards, so the observed count was one. Corrected that assertion to one; the implementation and guards were unchanged by this correction. The final 11/11 run covers the correction.

No browser/server/Preview/build, native PostgreSQL process or phase lease was needed or started. No rendered-UI, hosted database, RLS or Production claim is made. No owned phase resources remain. Ticket-router and Supabase guidance were applied; no SDK/config/provider changes were needed. A read-only attempt to fetch the Supabase Markdown changelog returned `Unsupported content-type: text/markdown`; no service/tool denial was bypassed or alternate service operation attempted.

## Reused immutable evidence

The prior **17/17** finite-catalogue proof is reused from [N88_FINITE_CATALOG.md](N88_FINITE_CATALOG.md), not rerun. The new focused suite verifies unchanged raw SHA256 identities:

| Existing file | SHA256 |
| --- | --- |
| finite catalogue | `e9dec5fb83b1897a229e328c6b57ffd8a30ff7bf15f3c4a79bc7a98aa7f1f780` |
| prior finite test | `d0fd4a954b9820ba6ead123ba8225032a62263b2b293292fac63b77eff4eb9f4` |
| canonical binding | `69d502ed38d5fbfd32f5a2114b44d42156f7eae295f1ba408dc9285e4ae0440b` |
| Postgres adapter | `0b38130ae2ecf097d72b92722d5157621f6dfa932b80b6079889c22b7edc32e0` |
| original hosted boundary | `58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e` |

Prior native canonical/storage and retirement evidence referenced by that document is retained unchanged. This new in-process bridge proof does not replace its isolation, native contention or restart evidence, and does not extend it to hosted installation.

## Remaining separately authorized outcome

The sole controller/publisher may deliver this **inactive source** candidate and verify its revision. This worker performs neither step. A later exact service card must qualify the real trusted admission and named executor, install/read back the authorized storage and finite backend identities/grants once, retain the original denied hosted boundary until qualified, attach genuine canonical lifecycle/receipt transactions, and prove controlled real teacher/own-student operation and readback before deliberate server enablement. The generic frontend publisher cannot perform those service steps. No new live pair, secret access, migration, hosted SQL or Product closure authority is inferred here.
