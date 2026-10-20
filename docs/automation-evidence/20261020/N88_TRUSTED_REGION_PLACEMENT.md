# N88 trusted list placement — bounded experiment

AI implementation, run `d2d77330-ce85-4c3c-af8a-3ff917051e52`, base `e225cb07e54ae6175ac7f641ad4027de1d330c07`.

The carrier owns a fixed `x-region: ap-south-1` wire header exclusively for `POST /api/n88/teacher/class/list`. Client headers, JSON region inputs and query parameters cannot select placement. The signed envelope, upstream URL, source pin, body, HMAC, identity/TLS guards, routes and deadlines are unchanged. Pinning removes automatic regional outage rerouting; this is a bounded placement experiment, not proof of the original failure's sole cause. [Official regional invocation documentation](https://supabase.com/docs/guides/functions/regional-invocation).

## Local qualification and exact promotion

`tests/n88-region-placement-20261020/qualify.mjs` intercepts the actual source and compiled carrier send. Forty before/after route/method comparisons pass; malicious header/body placement inputs cannot override the fixed region, query override remains denied, and unrelated routes/envelope bytes remain equivalent. No synthetic network call or real credentials. Syntax checks passed. No broad suite, frontend build, native publish or database operation.

Current main's carrier source predates already published N88 deadline/diagnostic fixes. To preserve those fixes, the deployment artifact is the immutable already-served carrier from candidate `9c658ade13bddc0289f3e2cf3a7769533280c2ae`, SHA `dc067be3b58d437d050ca57d2a3634f41f6b1c96d20cfe1114b8e3e988288088`, with only the equivalent fixed-header line inserted. The test checks the preimage hash and exact reversible byte delta. It does not rebuild an older main carrier or overwrite the original worktree/bundle. Sole-publisher Git integration must preserve this distinction; deployment artifact is `tests/n88-region-placement-20261020/carrier.mjs`.

Carrier SHA `3fbf524a87ac496fdebc9f74e2ab57ad810661d094d63a9c6148ae1c5d81fd3a` uploaded once through the existing sanctioned Cloudflare API route with inherited bindings. Exact source readback and settings/routes/subdomain equality passed; version `e699b953-5e67-4dc3-be1a-73f6cf85b0c4`, 100%. Source candidate at operation: `3ff84041bd8a19a6941302cb7095c9208cbddbcd`. Native/database/source pin unchanged. Markers and receipts are retained, no repeat upload authorized by this result.

Unchanged private static bytes and privacy handling are byte-identical to the prior carrier. Reuse prior PG17, 303/10, owner/ack/fence and asset evidence only for unchanged behavior. Historical private-HTML strict-byte FAIL, fresh-asset HTTPS timeout and prior actual source503/6600ms remain preserved; none was rerun or relabeled.

## Actual observation and unresolved placement proof

Existing original dedicated signed-in class portal context was valid. One normal reload, no account/class switch, Retry, second entry, support expansion or data write. Actual DOM showed a loaded roster of 4, 6 fields, 0 published fields and 0 task options. Loaded checkpoint was 9175ms after reload; this is an upper bound for visible completion, not a measured request duration. An initial DOM wait timed out before the later read-only checkpoint found the roster; no new request was triggered by that checkpoint.

The fixed-window metadata aggregation returned one version51/ap-south-1/200 record (516ms) and four version52/eu-central-2/200 records (7758–8051ms), rather than expected native version59. Expected-path and version59 aggregates were empty. One mistyped project-reference query returned INVALID_ARGUMENT and was corrected. No raw request URLs, IDs, personal content or credential/header values were selected. Automatic extra application request count and list-to-metadata correlation remain unknown. Do not claim that the ap-south-1 record proves this list's execution region or that metadata200 establishes the inner response status.

**BLOCKED/external:** actual class list loaded, but execution placement and request duration cannot be certified from the returned metadata. Preserve this candidate and completed one-use operations. Retry condition is a material, authorized correlation/readback of the already recorded window; no unchanged deployment or class-read retry. Product acceptance and full student/mutation journeys remain outstanding. Browser and integration leases released; no owned browser/server process was created.
