# N88 response-region attestation preparation

AI preparation for task `continuous-n88-region-response-attestation-20261020`, run `b4752d59-74d2-4f26-9ea0-86cc7255d5a5`, original session `01a14fc3-b292-7390-9952-8549a286c80f`. Base `10a98fcbec350030c5b72a1ea9132cab196a9ae2`.

The bounded carrier change reads only documented `x-sb-edge-region` from its trusted native response. Only a supported finite region token on `POST /api/n88/teacher/class/list` becomes `x-n88-service-region` on the existing private/no-store response. Client placement/diagnostic headers are ignored. Missing or invalid metadata remains absent/unknown; original success and error bodies/statuses are preserved. The fixed upstream `ap-south-1`, HMAC, body, URL, privacy, identity and route guards remain unchanged. [Documented response header](https://supabase.com/docs/guides/functions/regional-invocation).

## Qualified local carrier artifact

`carrier-boundary.mjs` intercepts the actual source and compiled carrier send. Its 120 comparisons cover supported/missing/invalid region values, client poisoning, list success/service failure, upstream503 and unrelated route/method equivalence. PASS; source and artifact syntax checks PASS. These are transport checks, not rendered-UI or hosted region evidence.

Immutable live preimage is `tests/n88-region-placement-20261020/carrier.mjs` at base, SHA `3fbf524a87ac496fdebc9f74e2ab57ad810661d094d63a9c6148ae1c5d81fd3a`. The candidate artifact in `tests/n88-region-response-20261020/carrier.mjs` is SHA `2f96fdc067e3658f8105f1c6de73d730fd3d62100c98490bdd0d1604c1204b15`. Exact reversible edits preserve the already published deadline/diagnostic/static bytes absent from current main's older draft source. Do not rebuild an older main carrier over the live service. No carrier promotion or fresh provider preimage/readback occurred in this run.

## Concrete scope blocker

`src/lib/student-portal-runtime.js:104` wraps the actual authenticated response as `{ok, json}` and drops its response headers before the allowed class client sees it. At line127 this runtime mounts the class view only after initial list admission, reusing the first list; initial-failure DOM also belongs to this runtime. Thus editing only the allowed client/view cannot attest the real first response, especially its failure path. A second request, global fetch hook or private-state read is not a valid repair.

The exact missing allowed path is **`src/lib/student-portal-runtime.js`**. It needs a narrow finite-header hand-through and initial success/failure diagnostic binding while preserving current owner/lease/admission guards. Current card omits that path. `scope-guard.mjs` records the actual source hash and missing path; it is a local scope inspection, not a UI PASS. Client/view diagnostic work and synthetic rendered composition remain NOT_RUN pending this correction.

The operating instruction applies: “when a self-imposed card path prevents a necessary scoped repair, preserve the exact candidate/session and name the missing path and reason”. This is an inactive-card scope defect, not a provider/Auth/tool denial. The approved maintenance helper may correct the inactive card under its existing idle/ownership rules; this worker does not launch a helper or edit queue state. Resume the same session/candidate afterward, reuse unchanged carrier proof, complete frontend qualification, then use the still-unused authorized promotion exactly once.

Zero provider calls/uploads/readbacks, native/data/SQL/Auth changes, real class reads, browser/server phases or owned resources in this run. Historical source503/6600ms, prior blocked result/FAIL and log-attribution gap remain intact. The prior five regional records belong to other functions. N88 actual region, service time, cause and full Product acceptance remain unknown; a separate post-publication observation is still required.
