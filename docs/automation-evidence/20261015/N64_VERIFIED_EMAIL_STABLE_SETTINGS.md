# N64 — verified email feedback and stable settings

Task: continuous-n64-verified-email-result-stable-layout-20261015
Run: b6290522-31b4-47ea-acf1-b52faf3d095b
Base: f5bbc185039e96acacfd3d8c360cee55958c75c3 (HEAD and observed origin/main at entry).
Authority: activated presentation-only N64 card and current canonical Product row, PO 2026-10-15.

## Result

Email feedback retains an in-memory owner-scoped requestedEmailChange identifier. Only the existing owner-checked Auth GET (verifyCurrentAuthIdentity) can match that request against the current account email, clear the stale identifier and show «تم اعتماد البريد الإلكتروني الجديد». A submit response, cached value, callback/query string or link cannot establish completion. The displayed email prefers the current cloud user over a possibly older same-owner contract. Contracts belonging to another owner are excluded. Missing completion evidence produces neutral guidance; an unchanged old email with a pending request stays pending. Success is neither stored nor repeated after a reload, and is cleared when leaving Settings.

The actual DOM open state is captured synchronously before replacement, closing the queued-toggle race. Detached details cannot overwrite the current manual choice. Attention and email-feedback slots reserve space, and confirmation guidance stays in the same position through pending/ready transitions. Existing validation can still expose invalid fields. No new startup module dependency was added.

## Affected evidence

- `node tests/n64-confirmed-email-ui.mjs`: PASS at 1280 and 390px using actual application DOM, handlers, source CSS and claimed synthetic account/store on task-owned loopback HTTP. Pending -> verified completion clears the stale pending indicator; Access displacement 0px at both widths. Focus/selection, immediate toggle + repaint race, repeated repaint, RTL, overflow and neutral reload passed. Auth mutation requests: none. Machine evidence: tests/n64-confirmed-email-evidence.json.
- `node tests/n64-stability-browser.mjs`: PASS at 1280 and 390px. Collapsed experience-section displacement 0px; delayed account reads, equivalent same-owner events, paint settling, instructions, modal keyboard/focus/inert cleanup, unchanged email validation, sound preference and route return passed. Five synthetic rejected outbox rows stayed byte-identical and rejected count stayed five.
- `node --test tests/n64-confirmed-email-state.test.mjs tests/settings-0397.test.mjs`: 8/8 PASS, including owner switch, no prior identifier, unverified email equality and completion invalidation after a different current email.
- `node tests/n64-stability-scope.mjs`: PASS. Email submit sheet and every settings action byte-identical to base. Auth, callback/router, store, Sync, ownership implementation and offline shell unchanged. The only app.js change invokes the optional beforePaint hook.
- Syntax checks for all three changed JS source files and `git diff --check`: PASS.
- Additional existing `node --test tests/account-profile-access.test.mjs`: 10 PASS / 1 FAIL. The unrelated report-branding assertion at line75 expects `/تقارير المعلم/`, while the existing report header renders the Rakeez brand. Test, account-profile, report-print and brand files are unchanged from base (empty scoped Git diff); preserve this failure, no report change is included. Cross-account contract rejection and Auth-email/validation tests passed.

Initial harness outcomes retained: the first new browser invocation could not import the helper's non-exported OWNER constant; corrected to obtain the synthetic owner from the live app document. The first stability run failed the existing route-return visibility assertion after a draft preserved collapse across navigation. Restored the original onUnmount reset; the corrected actual-app rerun passed. No acceptance assertion was removed. After the completion-invalidation guard changed, a browser rerun reported Access top 0 instead of 1066.796875; a diagnostic run then reported collapsed section top 254.1875 versus initial 0. The test used locator handles across asynchronous DOM replacement. Diagnostic toggle history stayed open during completion. The harness now queries the current connected node and its rectangle atomically inside one page.evaluate checkpoint; the complete delayed/reload scenario passed at both widths with that correction. Both original failures are preserved here; no tolerance or acceptance assertion was relaxed. Unchanged stability evidence is reused.

Synthetic harness warnings: Service Workers are deliberately blocked by the approved isolated helper; the existing fixture's incomplete Sync read emits warnings. These are not live/offline/Sync certification. No real account, token, callback URL, one-time link or message was accessed. The isolated helper owns browser/context finally cleanup; both Vite servers close in finally. No shared browser lease is required for this approved isolated phase.

## Separate requirements and delivery

A dedicated hosted Auth-return UX could explain the result on the email-link return surface, but requires its own explicit callback/token-handling card. No callback support, email template, double-confirmation, SMTP, schema or service administration is implemented or accepted here. This view-only result does not close the broader N64 message/return contract.

No push, integration, Preview or Production deployment was performed. The independent controller/publisher must bind the integrated revision and served changed client assets before awaiting_po; local readiness is not Product acceptance.
