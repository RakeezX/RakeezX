# N99 — campaign Event Properties candidate

Task: `continuous-n99-campaign-properties-20261013`  
Run: `478dba55-5aff-4a5a-b218-97d057480f84`  
Base: `97a6c54128954b6dfe2075d9210a598130581566`

Local implementation only; no push, deployment, real collector POST, dashboard observation or real account access. The controller owns integration and served Production verification.

## Changed behavior

The actual first-party analytics module attaches `payload.data` to both existing events. The actual public gate captures attribution synchronously before its paint callback and before the Demo click/reload. First eligible public entry fixes even empty attribution for the tab. Only the four sanitized values are saved in sessionStorage; subsequent query/internal-route changes cannot replace them. Page exit still aborts pending requests while preserving attribution for the ordinary Demo reload. Account/login entry replaces campaign data with a terminal `disabled` marker, including across reload/sign-out. The mini-hub login entry also stops measurement. Existing event triggers, website ID, collector, old `landing_view` dedupe and dispatch privacy guards remain.

Source and medium use explicit marketing vocabularies including `test`, Rakeez and common marketing channels. Campaign/content accept at most 48 ASCII characters, short lowercase readable word tokens and up to four-digit suffixes/year tokens. Email, URLs, controls, JSON punctuation, encoded input, duplicates, long digit runs, UUID/hex strings, opaque consonant strings and long high-uniqueness tokens are rejected. Saved data is re-sanitized at dispatch; arbitrary stored properties are not forwarded. Missing/rejected keys are omitted. No personal app data is consulted to populate properties; auth/workspace state remains an exclusion guard only. No new startup dependency, cookie, localStorage attribution, provider script, identifier, outbox or retry was added.

The public privacy details now explicitly describe these non-personal campaign tags, tab storage/reload and account disablement, while retaining provider IP/browser/session/region disclosures. Actual source CSS/DOM was inspected at desktop and 390px mobile widths; the mobile check reports no horizontal overflow.

## Exact synthetic outgoing bodies

For `/?utm_source=test&utm_medium=test&utm_campaign=tracking_check&utm_content=properties_check` (with extra forbidden email/term/session parameters in the test), the browser captured and structurally asserted:

```json
{"type":"event","payload":{"website":"a0f3bd66-07fc-4082-956d-70c17ff621c5","hostname":"rakeezx.com","url":"/","title":"رَكيز المعلم","name":"campaign_landing","data":{"utm_source":"test","utm_medium":"test","utm_campaign":"tracking_check","utm_content":"properties_check"}}}
{"type":"event","payload":{"website":"a0f3bd66-07fc-4082-956d-70c17ff621c5","hostname":"rakeezx.com","url":"/","title":"رَكيز المعلم","name":"demo_started","data":{"utm_source":"test","utm_medium":"test","utm_campaign":"tracking_check","utm_content":"properties_check"}}}
```

The browser removes all query tags with `history.replaceState` to `/#/classes` before clicking the actual Demo button. That handler reloads the document; the actual async Demo seed/store initialization renders `.layout` before `demo_started`. Existing `openReadyServedDemo` observes the ready Demo and more than 100 synthetic students. Subsequent reload/internal routes produce no extra attempts. No-tag events contain `data: {}`; partial tags contain only safe present keys.

## Affected verification

| Required check | Evidence |
| --- | --- |
| `n99_both_event_data_payloads` | Actual module unit test compares both four-key payloads through navigation/reload; actual app browser test compares both complete captured JSON bodies above. Forbidden query keys do not appear; constant URL/site/name envelope and credentials/referrer protection are asserted. Partial/no-tag and sanitizer adversarial cases pass. |
| `n99_campaign_survives_demo_navigation` | Actual app DOM/handlers/source CSS over intercepted synthetic HTTPS, supplied by an owned loopback HTTP server. Tags disappear before actual successful Demo/reload; both events retain identical data. Failed Demo emits no demo event. Old landing marker suppresses the renamed event while Demo retains attribution. Fresh tab has no campaign or Demo session; an empty first entry cannot be overwritten. |
| `n99_campaign_privacy_and_failure_guards` | DNT/GPC/offline/Preview/localhost and unknown/malformed/expired/authenticated identity remain no-send. Existing synthetic `bootSettings` helper verifies an actual account workspace with zero analytics. Actual inline login aborts a pending request, disables campaign data, and prevents later Demo sends after reload. Actual Demo exit then public login disables saved tags before account input. Collector rejection and marketing-storage refusal leave actual Demo ready, no errors/toast/outbox/retry. Unit storage read/write failures, timeout, dispatch eligibility race and tampered saved data are covered. |

Commands and results:

- `node --test tests/n99-marketing.test.mjs`: **11/11 PASS**.
- Initial `node --test tests/n99-public-integration.test.mjs`: **8/8 PASS**.
- After refining notice wording and adding storage/expired/login coverage, selected rerun with `--test-name-pattern='campaign_survives|unknown initial|blocked collector|marketing storage|mini-hub'`: **4 PASS, 1 FAIL**. Original failure was `locator.click: Timeout 30000ms exceeded` waiting for `[data-act="open-teacher-mini-hub"]` in Demo. Source inspection confirmed Demo exposes `[data-act="demo-login"]` instead; this was an invalid harness selector, not a failed Product behavior. No guard was disabled.
- Corrected actual path, `node --test --test-name-pattern='Demo exit then' tests/n99-public-integration.test.mjs`: **1/1 PASS**. It uses the visible real Demo exit, then actual public login button/OTP form. Other unaffected successful checks are reused; **all 10 distinct app scenarios now have successful affected evidence**. Page operation timeouts are bounded to 10 seconds.
- `node --check src/app.js`, `node --check src/lib/marketing-analytics.js`, `node --check tests/n99-public-integration.test.mjs`, `git diff --check`: **PASS**.
- Existing CSP/offline-shell module inclusion is asserted by the unit suite. No new dependency or Service Worker change; no broad build or historical suite.

Every browser phase acquired the shared browser lease for this exact run, used fresh synthetic contexts with Service Workers blocked and external requests intercepted/blocked, and released the lease after owned browser/context/server teardown. Final lease status: `FREE`. No user browser/profile, live data or queue/status file was touched.

Inspected rendered artifacts (original N99 screenshots preserved):

- [Desktop](../../../tests/n99-campaign-desktop.png): SHA256 `a2aa824c4a708b538de6d34f25fd807f73af4bb8372199379cdc64e829bf8b46`.
- [Mobile](../../../tests/n99-campaign-mobile.png): SHA256 `2d2b6bc97b55231cbfbd61121122ec5d65ebc0eb9ca9245f6272816b13ba9977`.

## Official contract and delivery limits

Reviewed [Umami Sending stats](https://docs.umami.is/docs/api/sending-stats) and [Event data](https://docs.umami.is/docs/event-data): additional properties belong in `payload.data`, and dashboard properties are viewed on the Events page. The current docs' newer gateway hostname does not replace the previously verified `https://cloud.umami.is/api/send`; unchanged transport evidence remains in `N99_COLLECTOR_VERIFICATION.md`. This run establishes exact synthetic outgoing properties, not new collector ingestion or dashboard visibility.

The authorized maximum one non-personal `tracking_check` public landing + actual Demo collector pair **has not been performed or consumed**. It may be verified only after publisher delivery is observed; no dashboard credentials/API or school account is authorized. This candidate does not claim Production verification or Product CLOSED.
