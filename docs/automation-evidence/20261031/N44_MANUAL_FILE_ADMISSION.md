# N44 manual-file admission — source-only correction

Task n44-manual-file-admission-source-20261031; run267696b5-a7e2-412a-8289-fd3769b3da9b; base3a92ab77731e3a0c8e94f6f43d7cbc9c980015b3 (also observed local origin/main). Canonical card is running in original session01a14fcd-032c-7ec0-8b0c-0e0395862c61 with explicit gpt-6.1-sol/medium; Standard policy and operating contract read. No queue/model/controller edits or new workers.

## Corrected boundary and unchanged contract

The original public host required observation.reader=mcp__cua_repl. A normal phone-file transfer cannot truthfully satisfy that independent-tool observation. The existing admit method and all its observation checks remain byte-for-byte unchanged. Missing/false tool observations still reject before a nonce claim; a fabricated trusted-tool fixture also confirms legacy compatibility. That fixture is not an actual browser observation.

The exact gateway helper at571fc483d711780af666be4926c80ab00eeaba91 was read and hashed:SHA256992b2b36a63602767bf9eb4ba085a426afd7edad28c693044afc7b832a052099. Its complete admission input is bytes, challenge, observedSha256, scope, privateKey, claimOnce and optional now. There is NO observation argument. It verifies its digest against supplied bytes, scope/challenge lifetime, claims the nonce durably before JSON parsing/decryption, decrypts the v2 envelope, checks inner/outer owner/workspace/device/run/grant/nonce/checkpoint/date/Sync/clock fields and capture freshness, and clears plaintext/key material. The wrapper's reader requirement was a separate outer contract. No producer modification or alternate verifier was introduced.

The assigned base lacks the already qualified manual folder. Only the two allowed public files (host and manifest) were materialized from historical36a3e2e. The unchanged attestation dependency exists in the recorded integrated sourcec11d0569; tests load its exact immutable36a3e2e Git bytes because this isolated base does not contain that file. This is the actual HMAC validator, not a stub/alias. No unallowed attestation/backend/frontend/SW path was created or edited. Publisher integration must retain the existing qualified dependency and serialize the shared host scope.

## Executable intake API

ingestion.mjs defines createOwnedFileOpener and createManualFileIntake. The original custodian supplies its EXISTING authorized private receipt-directory root, assertOwnedRoot/assertOwned authority guards and fs/promises-compatible IO. There are no default file/network ports, mkdir, attachment watcher, share service or fallback root. These constructor dependencies are trusted original-host capabilities, never transferred report JSON.

The opener accepts only a UUID transfer reference and maps it to manual-TRANSFER_REF.encrypted.json inside that privately supplied root. It verifies canonical root ownership, exact resolved file location, regular/non-symlink file identity and metadata before/after opening. It opens read-only. The issuer rechecks ownership, reads at most262144 bytes (one extra byte detects overflow), verifies length/identity/metadata/owned path after reading, takes an independent immutable byte copy, computes SHA256 itself and records its own ingestion time. The owned file handle closes in finally even when validation fails. No private root/path is placed in a capability or public artifact.

ingest({transferRef,challenge,scope,slot}) returns a frozen manual-file-ingestion capability. A module-private per-issuer WeakMap binds object identity, content, exact encrypted bytes and full issued challenge/run/slot/nonce/scope. The host is configured with that exact issuer. A clone, edited receipt, arbitrary JSON/reader/digest, capability from another issuer or foreign binding cannot redeem it. Redemption is one-use even on binding failure. A later replacement of the underlying file cannot change the captured bytes. Capabilities intentionally do not serialize across processes; durable nonce history remains with the existing original claim journal.

The separately named host.admitManualTransfer({capability,challenge,scope,slot,privateKey}) accepts no caller bytes/digest/reader field and no replacement intake dependency. It redeems the configured issuer's snapshot, passes those exact bytes/computed digest to the actual immutable helper and original durable claimOnce, then retains signed manualContext before/after, slot, browser-outcome and admitted-entry validation. Failed decryption or later evidence failure leaves the original nonce consumed; no implicit replay. Reminting from the same file does not bypass the durable journal.

Its provenance is explicitly manual-file-ingestion, independentBrowserInspection=false and observedUiExecution=false. expectedVerifiedUiSourceSha is an expected independently verified delivery pin supplied by trusted host setup. It is not observed execution provenance. No mcp reader label is manufactured. HMAC authenticates the canonical server context/pair checkpoint; SW outcome, quiet/preferences and gesture remain client observations. Neither file custody nor encryption proves verified UI bytes actually ran or that an independent tool inspected a browser.

Actual assembly still uses the original HMAC evidence checks and immutable producer assembly, exact pair equality/currentness and original owner/run/grant guards. Browser UNKNOWN rejects after the original claim. Manual batches add the earliest exclusive freshness bound across BOTH capture/outcome timestamps, both before/after attestation timestamps/expiries and both challenge expiries. prepared() and manualTransferProvenance() check that bound again, preserving all sixty-second and five-minute limits. An ingestion timestamp never replaces or refreshes any of those timestamps. Entry/batch clones or content edits remain rejected.

## Original-custodial source composition

composition.mjs exports createManualFileCustodyComposition. It binds the exact opener/issuer to the actual host, routes mint/admit/assemble, and calls the original trusted sealPreparedRecord callback with phone plus its separate admissionProvenance. The callback owns the existing protected preparation-record path, source hashes, current original session/card/authority checks and append-only write semantics. No wire input can choose a path or callback. sealPrepared checks current ownership and freshness before and after its awaited callback and consumes its local batch sealing attempt. Original preactivation consumers must retain their freshness/authority/archive/clock checks; sealing a record is not activation.

Future original-host setup, privately (illustrative variable names, no actual path/key):

```js
const intake = createManualFileCustodyComposition({
  root: originalOwnedReceiptDirectory,
  io: originalFilesystemPorts,
  assertOwnedRoot: originalOwnershipAndCurrentAuthorityGuard,
  hostOptions: {
    ingressKey: originalExistingIngressKey,
    serviceSourceSha: independentlyVerifiedServicePin,
    uiSourceSha: independentlyVerifiedUiDeliveryPin,
    producer: exactPinnedProducer,
    claimOnce: originalDurableAppendOnlyNonceClaim,
    clock: Date.now,
  },
  sealPreparedRecord: originalProtectedPreparationRecordSeal,
});
// ONLY after a separately verified channel deposits the original encrypted file
// in the existing owned receipt directory under its trusted UUID mapping:
const capability = await intake.mint({ transferRef, challenge, scope, slot });
const report = await intake.admitManualTransfer({
  capability, challenge, scope, slot, privateKey: originalNonExportedKey,
});
// After both original slots are fresh and verified:
const batch = await intake.assemble([androidReport, iphoneReport], originalPair, runId);
await intake.sealPrepared({ batch, runId });
```

That root must come from the original custody binding and remain private; it is not an upload-specified path. The operator receives public challenge text only after the supported path is legitimately ready; each original Home-Screen PWA performs its normal support export. An original-custodial receiver must obtain the unchanged downloaded encrypted file through a supported channel and deposit it at that existing guarded boundary. The existing local process then invokes mint/admit as above. No phone executable context handle, token, console access or independent-browser observation is requested.

This source defines the receiver API; it does NOT establish the missing real transport into that boundary. Actual transfer-channel readiness and latency are FALSE/UNVERIFIED. channelStatus() always reports false in this source milestone. ChatGPTweb attachment upload, model processing or relay has no established sixty-second bound; no such promise is made. Do not issue an expiring challenge while waiting, reset a capture clock, extend a deadline or assume owner availability solves the transport problem. Actual channel qualification and service/UI prerequisites must be independently observed before operational intake. OS arrival/tap remains separate finite-trial evidence.

No private SOURCE glue needed editing for this generic DI composition; no private dispatcher was read/invoked and no runtime/key/DPAPI/protected record or actual report was opened. There are therefore no changed private-source hashes to publish. Existing original-custody guards and protected journal remain mandatory trusted dependencies rather than being replaced by source fixtures.

## Scope, evidence and separate dispositions

New manifest.json binds actual canonical-LF adapter/host/test inputs, the immutable dependency/helper identities, limits, explicit provenance and source-only qualification. The old manifest's historical hashes/receipts remain intact with a separately named manualFileAdmissionSupplement; it is not silently resealed as the old qualification. This correction obtains its own candidate identity. It claims no service/UI deployment or installed end-to-end readiness.

The public saved service result89099d9f was read once at intake:BLOCKED, candidateca815af83fd4a06605fd67af4529e71b6ac39b30 (policy reconciliation and served-source404). That is a separately observed disposition, not a dependency of these source tests and not an inference of service success. No service result/card/status was changed or retry run. The controller owns file-scope serialization against service/UI work.

Focused new qualification:21 admission cases PASS, plus1 manifest/history case PASS. Actual functions used with fabricated in-memory file IO, identities and keys: new custodial opener/issuer, actual admitManualTransfer, unchanged old admit, actual immutable decryption/admission/browser/assembly helpers, original HMAC validator and new source sealing composition. Cases cover old observation guard and compatibility; forged/cloned/edited/cross-issuer capabilities; immutable snapshot after replacement; foreign run/challenge/scope/slot/digest substitution; replay/remint; failed-decrypt nonce consumption; stale capture/pair despite fresh ingestion; browser UNKNOWN; batch identity and earliest prepared deadline; file bounds/traversal/symlink/change/ownership and handle cleanup; truthful source sealing and channel-pending status. Unchanged old19 and historical29/14/11/15 proof campaigns were not rerun.

Commands: admission.test.mjs19/19 PASS after concrete dependency fix; two newly added cases passed with test-name filtering; the renamed old trusted-tool fixture passed again using a synthetic tool-side digest; manifest.test.mjs1/1 PASS. Preserved initial failure: the new constructor initially omitted manualIntake and raised ReferenceError; fixed the constructor dependency, with all guards retained. Manifest verifies the old admit method's exact unchanged bytes as well as actual new input hashes. Syntax and diff checks PASS. No rendered UI PASS is claimed.

No live/private intake, real challenge, phone capture, browser/server/lease, provider/config operation, account/student/source/registration mutation, notification/send/cron or finite operation occurred. All IO fixtures are fabricated and held in memory. No owned external resource remains. Original efedbcea grant, c137 archive/history and historical unspent disposition remain untouched; no fresh private-state audit restated them. All actual finite-trial acceptance checks remain NOT_RUN. No push/deploy, Product CLOSED or transfer-readiness claim.
