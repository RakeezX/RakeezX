# N88 availability and fast light entry — 19 October

AI-authored. Task continuous-n88-availability-fast-light-entry-20261019,
run fa7a7f6d-ad79-43d1-8bc0-e18312534dc2. Base/origin-main observed as
`df8e49362e79b488bcf56fbdca5c94e361bead7a` in the assigned clean checkout.

The actual current source has public teacher readiness. Its entry nevertheless
painted “لم تُفعّل الخدمة الخاصة بعد” before the first authenticated list reply,
then used that same message for local context failures and server failures. A
failed first request had no same-context retry. Successful initial admission
also caused the class component to request the same list a second time. The
student document eagerly read an HttpOnly session before accepting a code,
blocking the initial form even when there was no usable session. Immutable base
code reproduced both misleading teacher status and blocking student entry in
fresh actual app DOM/handler/CSS contexts over owned loopback HTTP.

The teacher now shows loading while admission is pending. Safe fixed categories
separate account, owner, source, lease, expired session, server denial, revision
and connection failures; no exception text, identity, credential or response
body enters diagnostics. Explicit retry repeats the actual account/store/owner-
bound dispatch/lease guards and still requires a valid server ACK. The component
reuses only that exact validated initial list, eliminating the duplicate read.
No private roster is shown before admission or after owner/lease invalidation.

The student code form is immediate, with zero initial requests. An explicit
“متابعة جلسة سابقة” action performs an authoritative read; session cookies are
never inspected or copied. Claim/read, expiry/revocation responses, generation
fences and clearing on hide/BFCache remain failclosed. The public student scope
is light under a dark OS or ancestor theme, without changing teacher theme or
preferences. Label “رمز الدخول”, one help “6 أرقام تبدأ بـ1”, visible field/button
gap and the existing brand remain. No new startup import or shared SW change.

## Bounded evidence

`tests/n88-review-1400.previous-pass.json` PASS: actual real account store and ownership guard,
delayed503/loading/same-key retry, 401/bad ACK, owner change and expired lease;
actual standalone document, source CSS and handlers at mobile/desktop sizes,
zero initial network reads, explicit expired-session denial, claim/read denial,
late response clearing and BFCache return. Screenshots are in
`tests/fixtures/n88-review-1400/`. The initial harness failure is retained in
`tests/n88-review-1400.initial-failure.json`: its expiry assertion lacked the
normal focus checkpoint. The repaired harness exercises that event and the
existing lease guard; no guard was disabled.

The live account observation was refused exactly:
`Tab 2005438362 is already part of browser session 01a14fcd-032c-7ec0-8b0c-0e0395862c61`.
No alternate actor, tab handle, account, browser profile or tool was used to
circumvent that refusal. The precise current live account's binding/lease/server
outcome therefore remains unobserved by this worker. The definite source defects
above are reproduced and corrected; no claim that the service was unpublished
or that this live account was newly certified is made. Prior unchanged actual
N88 service/crypto/schema/teacher/student acceptance remains preserved.

## Delivery boundary and cleanup

Only frontend source and its existing exact private ingress asset package change.
`activation/package-review-1400.mjs` reuses the existing packaging recipe and safe
asset allowlist; original Edge backend bytes, transport/routing/auth/logging,
keys, roles and all eight immutable migrations remain unchanged. No hosted
service/configuration/fixture/account mutation, deployment, push or live code
rotation/revoke occurs. No new service prerequisite or custodian operation is
introduced. The existing private document is embedded in the ingress Worker, so
publishing only the Pages teacher source cannot deliver the student change.
The sole controller/publisher must deliver both exact frontend source and the
updated existing ingress private asset bundle, retaining original bindings,
routes/privacy settings, then verify their actual served versions. This worker
prepares that package and does not claim those publication steps ran.

Owned fresh headless contexts and loopback HTTP server were closed in finally;
the parent-owned browser lease was subsequently released. User tabs and unrelated
resources were untouched. No blanket suite, full Vite build or activation replay.
LOCAL_READY means source/package readiness, not Production or Product CLOSED.

A later harness-only deadline/cleanup-reporting adjustment did not alter Product
source or functional assertions. Its attempted run did not acquire the browser
phase (held by the N44 worker) and did not start a browser/server. Its actual FAIL
process receipt remains in tests/n88-review-1400.json. No unchanged acquisition
retry or cleanup of the other lease occurred. The prior successful report and
exact executed harness were recovered against their already-recorded manifest
SHA256s, not relabeled or invented; see tests/n88-review-1400-reuse.json and the
previous-pass pair. Product source pins match that successful evidence exactly.
