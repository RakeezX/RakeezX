# N64 — automatic original-settings email status

Task: continuous-n64-automatic-pending-status-20261018  
Run: 6861a024-18c5-420c-8a43-3a7a3c198ff2  
Base: ca61990da9f65f7fffa2b2389ed65e7fc558c486

Removed the pending manual verification button. Pending instructions and the existing send dialog now explain automatic return-to-settings updates and page refresh as fallback. Every settings mount forces the existing owner-bound fresh read despite an unchanged context cache. Visible focus/visibility return keeps the existing single-flight and 30-second cooldown. Error retry remains an ordinary error-only control, with neutral guidance and a working busy attribute. Completion still requires fresh matching server email and cleared provider pending. No polling, token/storage policy or cloud guard changes. Service-worker cache generation advances v71 → v72 to refresh the changed shell source; no new startup dependency.

## Affected verification

`node --check src/views/settings.js`, `node --check sw.js`, and `node tests/n64-pending-status-browser.mjs` passed. Required checks and exact source hashes are in `tests/n64-auto-pending-evidence.json`. Actual app DOM, handlers, CSS and account workspace were exercised through HTTP loopback with fabricated provider responses and the canonical isolated helper. Widths: 390 and 1280. Screenshots in `tests/fixtures/n64-auto-pending/` show pending, completed and reloaded email fields; inspected for readable text, controls/status and no horizontal overflow.

The focused test covers mount freshness, first confirmation remaining pending, same email with nonempty provider pending remaining pending, later automatic completion in the original document, reload recovery, network failure/retry, in-flight event storm, cooldown, wrong owner, owner switch, no session and unmounted listener cleanup. Reload expected state is fresh current email without stale pending; boot may verify before settings captures the request, so a temporary success banner is not required after reload. The initial overstrict reload assertion failure is retained in the new evidence. Original-document success banner still must pass.

Unchanged `src/lib/cloud.js` normalized CRLF SHA-256 is `992bf9d6d26cdb49b582088275f4df7e5d7df99715ebebeedd2b28744948d08f`, matching `tests/n64-bounded-verification-evidence.json`: reuse its 12s timeout, late-result, refresh and owner safeguards. Existing incomplete synthetic Sync fixture warnings remain; the measured event baseline is 20 existing Sync schedules and one paint, with zero added read/write/paint/Sync fanout from settings during cooldown. This is not whole-Sync or offline certification. No external/service requests were executed. Browser, contexts and port 21664 server closed in finally; isolated local phase needs no shared browser lease.

## Remaining scope

PO reported the requested email became current successfully; that successful change is preserved. New-email sign-in and same-account/data proof still await the user's result. Existing refused callback/result-page/redirect/link/token/resend/cancel/provider operations remain untouched and excluded. No route, app, cloud, provider, real account or email change was performed. This local candidate does not close N64 or claim Production delivery; the independent publisher owns integration and served verification.
