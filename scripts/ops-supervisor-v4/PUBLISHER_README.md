# RAKEEZ delivery adapter

Exports from `publisher.mjs`:

```js
import { publishCandidate, observePublishedCommit } from './delivery/publisher.mjs';

const receipt = await publishCandidate({
  ticketId: 'N92', taskId: 'v5-n92-copy',
  cwd: 'C:/Users/Abody/Projects/RakeezX',
  candidateSha: '<full candidate commit SHA>', baseSha: '<full declared base SHA>',
  stateDir: '<existing runtime>/delivery/v5-n92-copy',
  repository: 'RakeezX/RakeezX', remote: 'origin', branch: 'main',
  productionUrl: 'https://rakeezx.com',
  validationTier: 'FAST', // FAST: metadata only. STANDARD: one integration build.
  acquireLease: async name => integrationLeaseToken,
  releaseLease: async token => releaseIntegrationLease(token),
  signal,
  onProgress: async event => recordControllerProgress(event),
});
```

The controller keeps its integration lane assigned to this delivery while the
result is `pending`. It calls the same request after `retryAfterSeconds`, without
starting another model. Return states are `deployed`, `pending`, and `blocked`.
`deployed` has `state: DEPLOYED_AWAITING_PO`, `closed: false`, and
`poPersonallyTested: false`; this adapter never closes the Product ledger.

## Permission and validation contract

The controller authorizes the candidate/ticket, owns scope checks and any affected
behavior checks, and holds the canonical integration resource lease. The adapter
does not infer those decisions from a worker writing PASS. Its own per-request
lock prevents duplicate journal writers; it is not a replacement resource lease.

`validationTier: FAST` runs only the existing metadata generator. `STANDARD`
additionally runs Vite once in the isolated integration checkout, using existing
dependencies. Set `dependencyDir` if the existing Vite cache cannot be located.
`verifiedBuildSha` may skip that Vite repetition only when it equals the actual
integration SHA and the controller has independently established that build.
An optional `{command,args}` `buildCommand` replaces the default commands; use
Node plus a script path on Windows, not an `npm.cmd` shell command. Only configured
`generatedPaths` (default: `src/generated/build-meta.generated.js`) may be modified
by the build. Those generated changes are committed before the main push.

No global test suite, dependency installation, browser, data mutation, forced
push, credential printing, checkout/reset of the canonical working tree, or paid
model/API call occurs in the adapter.

## Actual publication evidence

The deployment target has been observed to serve raw static source. Changed
`src/`, `assets/`, and the root `index.html`, `sw.js`, and `manifest.webmanifest`
are eligible source paths. Mandatory source proofs are `index.html`, `sw.js`, and
the generated metadata file. Additional `verificationPaths` are strings or
`{repoPath,urlPath}` mappings. Docs and scripts are recorded in `sourceOnlyPaths`;
their public availability is never assumed. `productSourceChangeObserved` excludes
metadata-only changes; publishing ops files cannot establish Product acceptance.

A final receipt contains:

- The original candidate and declared base; the observed main parent; integration
  and published SHAs; and verified ancestry connecting them.
- A Cloudflare Pages check with exact `head_sha`, app ID 85455 and the expected app
  slug. A preview check already present before a new main push cannot certify it.
- An immutable preview origin whose prefix matches the provider deployment ID
  parsed from the Cloudflare check metadata.
- SHA-256 byte parity on both the immutable deployment URL and the production
  origin. Deleted assets require 404/410 or the exact current HTML index fallback.
- The actual validation scope and command receipt. A content build digest is never
  interpreted as a Git commit SHA.

The live production check found one Cloudflare JSD script injected immediately
before `</body>`. For `index.html` only, a 200 `text/html` response from
`server: cloudflare` may have that exact observed script removed for hashing.
Only its 16-character ray ID and canonical base64-encoded numeric timestamp can
vary; a changed script, duplicate injection, challenge response, or any remaining
application-byte difference fails verification. This comparison does not execute
the script, access its endpoint, change Cloudflare settings, or modify responses.
The receipt retains `observedSha256` and `bytes`, and records
`normalization: cloudflare-jsd-v1`, `normalizedSha256`, `normalizedBytes`,
`removedProviderBytes`, and `removedSha256`. The controller may accept this
specific transform only when `expectedSha256 === normalizedSha256`; all other
nondeleted assets require `expectedSha256 === observedSha256`.
Cloudflare documents the provider behavior at
https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/.

The adapter writes a prepared commit journal before attempting a non-forced push.
After any interruption it reads main first: if the prepared commit is already an
ancestor, it verifies that publication without pushing again. If main changes
before acceptance, it prepares a new merge/build in another isolated worktree.
Conflicts and failed builds retain their worktree for the same worker to repair.

## Read-only live observation

```js
await observePublishedCommit({
  cwd: 'C:/Users/Abody/Projects/RakeezX',
  publishedSha: '<current main SHA already present locally>',
  repository: 'RakeezX/RakeezX', productionUrl: 'https://rakeezx.com',
  verificationPaths: ['src/lib/student-lifecycle-ui.js'],
});
```

Observation runs only `git ls-remote`, `git show`, `gh` reads, and HTTP GETs. It
makes no Git fetch, build, checkout, push, or file write. Its result is `verified`,
`pending`, or `blocked`, with `readOnly: true`.

CLI for a prepared JSON request: `node publisher.mjs --observe --request request.json`.
For publishing, omit `--observe`. Exit 0 means deployed/verified, 10 means pending,
20 means blocked. The controller should use the exported function for leases.

## Targeted local tests

Run `node --test publisher.test.mjs`. Tests use temporary real Git/bare repositories
inside this directory and mock only GitHub/HTTP. They exercise dirty canonical
preservation, metadata-only FAST behavior, history integration, non-forced push
races, build failure, recovery after a remotely accepted push, rejection of stale
preview/production evidence, and mutation-free observation. No production call is
made by tests. The captured `fixtures/cloudflare-jsd.html` also tests the narrow
HTML transform and refusal of changed application bytes or provider scripts.
