# D-087 Auth fixture capability — prepared, not activated

This directory contains a narrowly scoped Auth fixture capability for the existing N58 live A/B gate. No functions were deployed, accounts created, Product rows changed, real sessions opened, or live N58 checks executed during preparation.

The installed module path is:

    C:\Users\Abody\Projects\RakeezX\scripts\ops-supervisor-v4\capabilities\d087\run.mjs

Install the complete manifest-listed directory in Git, including its contract, source pins and required source evidence. The N58 worktree imports this canonical module by absolute path. Do not copy an old application tree into the current worktree or modify canonical runtime/queue files.

## What is established, and what remains work

The real capability inventory found official Supabase connector tools for SQL, migration and Edge Function operations in the existing signed-in Codex environment. It did not expose a direct Auth-admin tool or a key retrieval tool. This implementation uses the documented server-side Auth SDK inside two purpose-created protected Edge Functions. It never extracts or returns a service key.

Read-only Git comparison at main 8e2d4800396996be43868a71057412afccd2150b showed that N58 remains unintegrated: six source paths equal the historical base, calendar-runtime.js is absent, and five shared Product files contain later changes that must be preserved. The historical candidate is 4efaf2c7bb9112af931112f72ccf8a6c4a3744f2; its Preview is historical evidence only.

The existing n58-client-controls browser file deliberately runs local/Demo scenarios, fixes the clock and asserts that no Supabase/Auth requests occurred. Its selectors are reusable. It is not the required live gate.

The continuation card must first integrate the preserved four-commit N58 delta on fresh main and implement one bounded real A1/A2/B1 browser/client harness. Only after that code, current candidate/schema evidence and an immutable Preview are ready should it prepare and use the two accounts. These are implementation tasks under the existing authority, not a request for another user approval.

## Scope and source binding

The nonsecret fixture-contract.json contains the exact scope and evidence. D-087 authorizes two new dedicated synthetic Auth accounts and their purpose-created fixture closure. Current PO automation authority supplies routine execution and delivery authority. Existing users, their records, Auth policies, migrations, RLS and historical rejected outbox envelopes remain outside this fixture operation.

A uses the ordinary enforced new-account foundation: 77 rows including its profile/grant, one year, one calendar, two terms, one subject, four time profiles and 66 calendar-day records. It then needs one empty Section, one Teaching with the existing RPC's five empty default item definitions, one successful session and at most the unchanged client's empty roster snapshot. B needs an Auth identity only. No students, enrollments, grades, attendance or logs are seeded.

The live N58 migrations are already applied. Their exact historical source is retained as evidence; it is not an instruction to apply them again.

The actual N58 deployed guard blocks hard deletion of a selected year/calendar. The prepared disposition therefore retains the exact run-marked synthetic closure, attempts global sign-out of only these accounts, applies and independently verifies a fixed ban, records real password/refresh denial, and closes only the three owned browser contexts. It does not hard-delete, soft-delete or bypass that guard.

## Files

- handler-core.mjs: strict request/identity validation, official Auth method adapter, expiry and bounded responses.
- edge-entry.ts: pinned official SDK; reads existing server-only function environment after protected authorization.
- closed-entry.ts: deny-all 410 D087_CLOSED, with no SDK or environment access.
- private-state.mjs: already-ignored path requirement, private permissions, atomic state and exclusive process lock.
- run.mjs: private local intent journal, two deployment bundles, exact identity recovery, sign-in, retention and redacted receipt.
- fixture-contract.json and source-pins.json: fixed permitted scope and official source/package references.
- evidence/: exact read-only authority, source and schema metadata; no Auth records or credential values.
- handler.test.mjs and runner.test.mjs: targeted local mock tests.

## Fresh candidate input

The historical candidate is never the default live target. Prepare requires a separate nonsecret candidate-binding.json. Its author must first fetch/observe current main, commit the real live harness with the Product candidate, verify the exact immutable Preview and save the local preparation receipt. The binding fields are:

    version: 1
    purpose: N58-D087
    projectId: xlrubcwjqktzzunrvuns
    candidateSha: exact 40-character commit SHA
    treeSha: exact candidate Git tree
    baseSha: observed refs/remotes/origin/main used as an ancestor
    previewUrl: https://<8 hex characters>.rakeezx.pages.dev
    preparedAt: ISO UTC timestamp, at most 30 minutes old
    harnessPath: tests/n58-live-d087.e2e.mjs (or its scoped named variant)
    harnessBlob: exact committed Git blob of that harness
    preparationReceiptSha256: hash of the actual nonsecret preparation receipt

The runner checks the actual Git base/tree/harness objects and unchanged critical foundation/migration source blobs. The receipt hash identifies preparation evidence; it does not certify the live gate. If the actual foundation changes, reconcile the concrete fixture contract before activation rather than weakening this check or silently widening the seed.

## Bounded activation sequence

The N58 card owns the single harness and all following steps. The operator/worker uses the existing resource lease only during the live/function/browser phase. Neither a new scheduler nor a general privileged user-management interface is needed.

1. Complete fresh main integration and the deterministic harness first. Its finally/recovery path must be ready before provisioning. Preserve an exact candidate and local receipt on every failure.
2. Explicitly run prepare with the canonical repo and candidate-binding path. This allocates the run ID, two Auth IDs, exact Product fixture IDs, passwords and two independent capability values once, and saves them before any request. Nothing is printed except safe paths/IDs/status.
3. Render both provision and cleanup-only bundles. Deploy both new function names through the existing official connector, with verify_jwt=false only for these self-authenticating handlers. No global Auth configuration or secret extraction occurs.
4. Read the two deployed source/configuration records. Run protected probe for provision and probe-standby for cleanup-only. Provision refuses to create anything before the cleanup companion has been verified. The standby probe does not end provisioning.
5. Start one deterministic Node harness process, with durable intent before its first live call. It provisions/reuses the exact saved pair, opens only A1/A2/B1 and performs the declared real client/PostgREST gate. Tokens remain in the private state and never appear in traces, screenshots, command arguments or public receipts. Reuse the runner's three normal sign-in sessions through the existing official app session path, or have the harness durably record the same three normal login results; do not sign in twice by combining both methods.
6. In finally, directly activate the predeployed cleanup companion with a cleanup probe, attempt exact global sign-out, fixed bans and token-denial checks, close only owned contexts, and write the safe receipt. This requires no additional model turn or MCP redeploy, so an already-running harness can finish Auth disposition if Codex quota ends. Put live checks under a real deadline with time reserved for finally.
7. Render closed bundles for both new function names. Redeploy both to closed-entry.ts through the official connector, read back their source, then run confirm-disarmed. A status-only or expiry observation is not evidence that deny-all was deployed. If the model/connector is unavailable, persist DISARM_PENDING with both names and candidate; never claim disarm or LOCAL_READY.
8. The Product worker may return LOCAL_READY only when its required checks actually passed. The ordinary publisher then integrates and publishes Product source; it does not treat Auth setup alone as Product progress or close N58.

Example CLI shapes (paths are values, no secrets):

    node <canonical-run.mjs> prepare --repo <canonical-repo> --candidate-binding <binding.json>
    node <canonical-run.mjs> bundle --repo <canonical-repo> --private-dir <private> --phase provision
    node <canonical-run.mjs> bundle --repo <canonical-repo> --private-dir <private> --phase cleanup-only
    node <canonical-run.mjs> probe --repo <canonical-repo> --private-dir <private> --phase provision --live
    node <canonical-run.mjs> probe-standby --repo <canonical-repo> --private-dir <private> --phase cleanup-only --live

The deterministic harness calls the exported functions for the rest of the sequence, rather than depending on many separate model-driven CLI steps. These shapes are documentation; none was executed live during preparation.

## Private state and recovery

Private state is restricted to an already-ignored directory:

    artifacts/ops-supervisor-v4/capabilities/d087/<run UUID>/private

No ignore rule or allowed directory is added. On Windows the runner creates a protected ACL for the current SID and SYSTEM; on POSIX it requires 0700/0600. The Windows ACL branch is prepared source, not a claim of a live Windows test.

The same saved UUIDs and intent survive a lost create response. Only exact Auth 404 plus user_not_found permits creation. Every create and ban is independently reread. Mutations have at most one attempt plus two explicit retries. Sign-in with an uncertain result is not blindly retried. A process crash leaves RUNNING.lock as evidence; remove only that scoped stale lock after proving the recorded process is gone.

The two capability manifests expire after 90 minutes. Start this clock only after local preparation; use a substantially shorter live deadline and reserve cleanup time. Expiry prevents future privileged calls, but does not ban accounts, erase fixtures, invalidate old access JWTs, or redeploy deny-all by itself.

If the harness process is killed or the device goes down, there is no claim that finally ran. Recover the same private run and exact IDs. If its expiry already passed and disposition is incomplete, record CAPABILITY_EXPIRED_CLEANUP_PENDING with the exact IDs/function names/candidate. A separately bounded cleanup-only recovery window for that same pair is owned follow-up work under D-087; do not create a replacement pair or silently extend the provisioning window. This module does not automatically renew capabilities.

A successful sign-out acknowledgment is separate from refresh-token revocation proof. user_banned proves denial while banned; it does not prove a session row was deleted. Existing access JWTs may remain usable until exp. The receipt records maximum issued expiry and each exact outcome. Unexpected token issuance, an identity conflict or unverified ban remains an explicit failure. RETAINED_BANNED never means DELETED, CLEAN or N58 Production PASS.

Do not remove the private recovery material while disposition or disarm is pending. After the exact final receipts are secured, remove only this run's private files/owned browser profiles when recovery is no longer needed. Retain the nonsecret receipt and declared synthetic IDs/disposition in Git-backed evidence.

## Validation and limits

The final local check ran both test files: **23 passed, 0 failed, 0 skipped**. Tests cover unauthorized/expired/out-of-scope requests, wrong identity markers, exact create/ban response recovery, token owner verification, separate revocation/denial meaning, private path/lock safety, missing cleanup standby, redacted receipts/bundles, fresh candidate binding and no blind sign-in retry.

The package is pinned to npm:@supabase/supabase-js@2.117.3 and its immutable release/source commit in source-pins.json. No SDK installation, Deno cache, package download, provider compilation or live function invocation occurred here; no deno.lock was invented. Provider bundling and actual runtime configuration are checked before accounts are created. No broad repository test train is requested.

