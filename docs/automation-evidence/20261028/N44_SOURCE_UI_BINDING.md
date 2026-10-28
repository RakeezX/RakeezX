# N44 — mounted source-readiness support binding

Task `n44-source-ui-binding-1028`, run `91ecdbed-1631-47c1-8fa3-73118518edd9`. Source-only prerequisite; N44 remains OPEN. No live grant operation, provider read/write, registration, source creation, preference change, send, push or deployment was performed.

## Delivered behavior

The actual teaching hub has a collapsed **تشخيص مصادر التذكيرات للدعم** disclosure. Select the trusted custodian's JSON challenge and press **حفظ تقرير مشفّر**. The module loads only on that action. No automatic capture, global store injection, clipboard access, telemetry, upload or arbitrary URL is introduced. The JSON download contains encrypted metadata; the operator must deliberately pass it to the original custodian. Errors disclose a bounded diagnostic code, not raw exceptions or identifiers.

The browser-safe module imports the mounted store, cloud context guard, fresh Sync summary and central date helpers. It checks the actual `getTeaching/getTerm/getYear/getSection/getSubject` signatures, `classOperationsStatus`, offline lease and `isSessionEligibleDate`. In particular, Sync uses `state` and `cloudSyncHealthy`, not the old private draft's assumed `status`. It fences the workspace, session object, notification context, mounted element, route, ancestry references/revisions and source identity set across asynchronous operations, and checks Sync again before releasing ciphertext. Pending/failed/blocked/rejected/queued work and lifecycle operations reject capture. Only selected ancestry metadata and existing source IDs are serialized; no student rows, names, scores, auth tokens, session objects or preference values.

The encrypted payload labels `captureDevice.role = read-only-capture` and `sendRecipientVerified = false`. A desktop capture is not represented as either authorized notification recipient.

The module is a dynamic, optional action dependency, not part of the startup import graph. The existing `sw.js` shell was inspected and is unchanged: first-use diagnostics require the module to be available online; import failure is caught in the disclosure without breaking startup or claiming offline diagnostic availability. This is not a Service Worker/offline certification.

## Exact public challenge interface

Original custodian generates the challenge in its existing protected scope; this task did not generate or export any real key/challenge. Deliver the file through the already trusted operator channel. A public key alone does not authenticate its sender: do not use an unsolicited challenge.

All keys below are required; extra keys are rejected:

```json
{
  "version": 1,
  "taskId": "n44-core-live-1028",
  "grantId": "efedbcea-f227-4a91-bbab-79cad814fc81",
  "runId": "<current original-core run UUID>",
  "nonce": "<32 random bytes as 64 lowercase hex characters>",
  "issuedAt": "<integer epoch milliseconds>",
  "expiresAt": "<integer epoch milliseconds, at most issuedAt + 300000>",
  "ownerHash": "<SHA256 UTF-8 original owner ID, lowercase hex>",
  "workspaceHash": "<SHA256 UTF-8 original workspace ID, lowercase hex>",
  "dueAt": "<future Riyadh midnight epoch milliseconds, within seven days>",
  "publicKey": {"kty":"RSA","n":"<original public modulus, base64url>","e":"AQAB"}
}
```

Placeholder timestamps must be JSON numbers, not strings. Export only `kty,n,e` from the existing original RSA public key (2048–4096 bits); never export private JWK members. Use the current canonical task/run/grant and expected protected owner/workspace, not values guessed from the visible desktop. Preserve the nonce and exact challenge in private custody. The browser additionally enforces actual selected term bounds/calendar, Riyadh timezone and a 00:15–00:45 test lesson (15-minute lead); this does not allocate any source or certify a feasible trial window.

Challenge digest is SHA256 of UTF-8 `JSON.stringify(parsedChallenge)` in received key order. Keep the exact file/order. One successful reservation per digest per document, bounded to 32; a failed/UNKNOWN encryption after reservation is not retried within that document. Durable one-use admission across reloads belongs to original custody, not browser storage.

## Receipt admission — required subsequent private compatibility change

Download filename: `rakeez-source-readiness.encrypted.json`. Outer fields are `version,kind,taskId,grantId,runId,nonce,challengeDigest,observedAt,documentCheckpoint,envelope`. Kind is `n44-source-readiness`. Envelope contains base64url `key,iv,tag,ciphertext`: RSA-OAEP SHA256 wraps a 256-bit AES key; AES-GCM uses a random 12-byte IV and a separate final 16-byte tag. Original custodian can use its existing RSA/AES decryption, then erase temporary key/plaintext buffers.

The old `normalUiSourceReadiness` pin/producer cannot consume this format unchanged. The next original-core task must add a versioned admission entry that:

1. Requires original custody, canonical current task/run/grant, its owned phase leases and exact saved challenge; atomically claims the nonce once. Checks receipt size, challenge digest, issue/expiry, document checkpoint and a fresh observedAt (at most 60 seconds old).
2. Admits only the exact downloaded bytes independently observed through the approved UI/operator handoff, recording their hash and provenance. Encryption is confidentiality, **not sender authentication or a server attestation**. A self-supplied digest/envelope must not become an authenticated pin merely because decryption succeeds.
3. Decrypts and matches inner/outer binding fields, expected owner/workspace, positive ancestry revisions/links and source identities. Revalidates current source/calendar/Sync requirements and bounded timing before activation. The payload deliberately does not invent `peerUnchanged`, phone readiness or canonical server-read proof.
4. Accepts `captureDevice` only as read-only capture provenance under verified owner/workspace. Keeps the original two-device send/registration checks intact, in a separate recipient scope. Never replace `scope.devices.includes(...)` globally or relabel a desktop as a phone.
5. Writes a new versioned append-only DPAPI record and technical pin through original custody, then reads it back with the matching versioned validator. Do not merely rename this download to the old expected input. No private adapter was edited by this source-only task.

Source creation, generated cleanup IDs, fresh phone witness, real future event window, finite clock, sole install/scheduler and all live gates remain with the original core task after those compatibility checks. Prior failed/NOT_RUN history remains intact.

## Affected verification

Command: `node tests/n44-source-ui-binding-1028.test.mjs` — PASS.

Actual app HTML/DOM, delegated teaching-hub handler, source CSS, mounted synthetic account/store and real ownership/lease/Sync/calendar guards ran over task-owned loopback HTTP with the canonical isolated browser helper. Existing served-demo readiness and N44 account/engine fixtures were reused. The server used an allocated unique port; external requests and Service Workers were blocked by the helper. Owned browser contexts/server closed in finally.

- Default collapsed and no diagnostic module request before explicit action; missing file, expired/wrong-task/wrong-owner/private-key challenges rejected.
- Actual button downloaded a receipt encrypted to a disposable test key. Node decryption matched selected ancestry and read-only device provenance; no plaintext owner/source identifiers in the outer receipt, no student names/scores/tokens in the payload.
- Selected student/score/source/ancestry collections unchanged and zero additional API calls during capture. Synthetic background Sync timestamps are not claimed immutable.
- Replay rejected. Actual module entry rejected foreign owner, detached document, missing auth, invalid calendar, pending outbox row, revoked lease, and session replacement during asynchronous hashing. No guard was bypassed.
- Visible disclosure fits 320/390px. Screenshot inspected; file input overflow corrected. Temporary screenshot removed after inspection.

Preserved development failures: initial fixture kept the archived active term because `refreshSyncedState` does not reload device settings; corrected by the actual store initialization. The fixture's incomplete mock mutation port initially left Sync failures; completed its local transport. A subsequent pending Sync attempt was correctly rejected, then one explicit local capture succeeded once settled. This was not a provider retry or grant consumption. Test cleanup initially used nonexistent `db.del`; corrected to actual `db.remove`. Initial 320px file input overflow failed geometry and was fixed. Final affected test passes include these corrected fixtures and UI.

Publisher integration/served-source verification and actual approved-context readback are NOT_RUN here. No claim of phone state, service readiness, live receipt acceptance or Product CLOSED.
