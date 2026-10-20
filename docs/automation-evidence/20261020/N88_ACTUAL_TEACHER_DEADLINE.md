# N88 — actual initial-read deadline cause and compact entry link

Task: continuous-n88-actual-teacher-deadline-cause-20261020
Run: bdbf83c0-795c-43cc-86ed-9a6994eb67e7
Base: 7a68241d47c4501b224ac237a36e9d44c4a377ea

## Proven source path and bounded correction

The browser's existing class-client deadline starts before its request enters the shared dispatch FIFO. On a genuine source/binding change, the runtime disposed the old view but did not cancel its HTTP request. The replacement initial class request therefore waited behind retired work while consuming its own deadline. The prior same-session stable-key repair correctly avoids harmless renewals; it does not cancel work retired by a real source revision.

tests/n88-actual-deadline-20261020/default-budget.json reproduces this with the actual 10000ms browser deadline unchanged. Both controlled database-acquisition dependencies take5500ms, each within the unchanged6000ms acquire cap. A real synthetic source revision occurs250ms after initial dispatch. The immutable base leaves the first request in the FIFO: its replacement then exceeds its own deadline before its second acquisition completes. The corrected runtime aborts only the HTTP work owned by the retired view; the new request is admitted within the SAME deadline. No retry, deadline increase, debounce, empty-data substitution or admission bypass is involved.

The test runs actual application DOM/handlers/CSS and the real class client -> signed Cloudflare entry -> Web Request entry -> official pinned Auth SDK -> integrated service/repository -> COMMIT-ACK path. Only provider responses, canonical rows, PG query results and the controlled acquisition wait are synthetic. It is not a native-PG certification or hosted account journey. The successful ACK contains one validated fabricated pupil. The actual store/owner guard immediately clears the view on owner change; late retired responses cannot restore it.

Cancellation does not claim that a remote transaction has rolled back. Existing server transaction/global lock/current-source/Auth/session/commit fences remain authoritative and unchanged. Real errors remain errors. A genuinely slow fresh same-binding service operation can still exceed the existing browser deadline; this source correction does not certify every backend latency cause.

## Exact failure diagnostics

The runtime now retains the actual finite last phase plus a finite safe client code and trusted-header service/transport stage. A timeout waiting for HTTP remains dispatch/timeout instead of being overwritten as generic failure. The actual acquire503 case remains http/rejected/acquire. Late responses after abort cannot overwrite the failure checkpoint. Initial binding denial is binding/unavailable.

The existing user-triggered Support sanitizer accepts only fixed source versions and finite phase/code/stage enumerations, HTTP status and bounded100ms timing buckets. It never captures identity, token, URL, roster, payload or raw exceptions. tests/n88-actual-deadline-20261020/support.json tests the actual sanitizer and submit handler with inert dependencies, including poisoned extra fields/codes/stages, bounds, optional capture failure and Auth/input guards. Real support sends are zero.

## Compact link

The portal's existing header now contains a compact secondary /student link using the existing Rakeez quiet-button style. It no longer inserts another h1 beneath the application title. The link remains mounted through loading, rejection and timeout. Actual DOM checks and inspected390px screenshots confirm one title, a44px link target and no horizontal overflow in ready and error states. Student claim, inline Previous session behavior and accepted identity styling are unchanged.

## New provider evidence and limits

Exactly ONE ordinary operational aggregate was read for08:59:02–09:17:00UTC, after the reported08:59 release. The exact existing N88 function/source filter matched zero entries. This is not proof of absent requests or zero latency, nor does it attribute the real timeout to ingress/Auth/SQL. See provider-window.json. No earlier window was replayed.

Actual authenticated teacher success and attribution of the reported hosted incident remain NOT_PROVEN. The browser ownership refusal was not retried or routed through another tab/actor. No user retry is requested by this worker. The source-causal fix and safe diagnostics are publisher-ready; whole N88 remains OPEN.

No service source changed: native49/SHA420a57e65cc242652f266693c5280f9b112791cdeb556910f90796c39d5b0253 remains the preserved baseline. No native deployment, source-pin/custody action, signed readiness, static carrier upload, SQL/Auth/RLS/role/key/fixture/account/pupil mutation or real send occurred. Student private compiled assets are byte-identical to base, so no carrier update is needed.

The unchanged server composition has repository16000ms, Web entry18000ms and ingress19000ms ceilings. These are application guards, distinct from provider platform limits documented at https://supabase.com/docs/guides/functions/limits. The changelog.md fetch returned unsupported Markdown content-type; no provider convention/dependency was changed on that basis.

## Evidence history and cleanup

ui.json contains the short controlled case and phase checks; default-budget.json uses production timing; layout.json checks the error toolbar. Earlier failed harness results remain unchanged:
- ui.initial-fail.json: attempted mutation of a frozen workspace fixture; corrected to a real canonical source revision/focus event.
- ui.composition-fail.json and ui.fixture-auth-fail.json: fixture SQL matching was narrowed, then the synthetic project reused one signing authority across cases to match the official SDK JWKS cache. No signature check was disabled.
- default-budget.wait-harness-fail.json: the harness's5-second locator wait was too short for a10-second deadline test; only the test wait was corrected.

All owned browsers/servers and browser leases were closed/released in finally. No live-mutation/integration lease or external service process was opened. Current observed origin/main191d9b28862b50fd20248c6e801b3cfb52dac729 has no overlapping changes to the three affected source files. The sole publisher owns integration and final served teacher source. See conclusion.json for the bounded required checks and unchanged live-journey limit.
