# N99 actual collector verification

Task: `continuous-n99-collector-verification-20261013`  
Run: `1139702a-5d3b-4b53-941f-ce01510e47d1`  
Base: `4ec7840a3c2f40767003e1eff583aa7dcf46d83c`

## Result

A fresh, temporary headless Chromium context opened `https://rakeezx.com/` without query parameters. The public page returned HTTP 200. The actual application emitted one ordinary `landing_view` POST to `https://cloud.umami.is/api/send`; no Demo was started and no second event was generated. The observed payload was the existing allowlisted event with keys `website`, `hostname`, `url`, `title`, and `name`; `url` was `/` and `name` was `landing_view`. No Cookie header was sent. The browser received HTTP 200 and `Access-Control-Allow-Origin: *` from that collector endpoint. The response body was not read or logged because it may contain cache/session identifiers.

This establishes that the existing endpoint accepted the browser request at the HTTP/CORS boundary. It does not establish dashboard observation or visitor totals. No dashboard or API key was used. The official current [Umami Sending stats documentation](https://docs.umami.is/docs/api/sending-stats) names `https://gateway.umami.is/api/send`, while this actual public request to the existing `cloud.umami.is` endpoint returned HTTP 200 with permissive CORS. Per the activated card's conditional correction rule (correct only if the old endpoint is broken or redirects), source and CSP remain unchanged. The documentation discrepancy is retained for publisher consideration; this local evidence does not assert Production source parity or integration effectiveness.

## Safeguards and verification

- Used one real anonymous public landing visit in a newly launched browser/context; did not attach to a user browser/profile.
- Captured only host/path, event name, payload key names, root URL value, HTTP status, CORS result, and Cookie presence. No event response body or identifiers were exposed.
- The browser phase lease was acquired for the visit and released immediately afterward. Browser/context were closed.
- `n99-marketing.test.mjs` exercises the current endpoint constant, exact connect-only CSP, event allowlist/payload, credential/referrer protections and nonblocking privacy gates. The previous unchanged 12/12 N99 suite evidence remains applicable to unchanged app behavior.
- No source/CSP change, deployment, dashboard observation, account access, synthetic event, or real Demo event occurred.
