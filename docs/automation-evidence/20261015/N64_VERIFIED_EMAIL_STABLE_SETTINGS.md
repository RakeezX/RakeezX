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

## Saved-session continuation — validation blocked

Continuation run: `3cf675b5-92c2-4cdc-8b7b-c2c9e20f28e2`.
Preserved implementation candidate: `46ae6335dbe9b614f4865c89662dccb3483e3026`.

The previous LOCAL_READY result was rejected with: `Candidate validation: An affected check must pass and no recorded check may fail`. The additional account-profile suite's recorded report-branding failure remains FAIL. The N64 checks above passed; they do not erase that failure. This continuation confirmed the saved commit, clean worktree, existing machine evidence and empty base-to-candidate diff for the failed test and its account/report/brand dependencies. No Product source changed, and no successful browser scenario or failed suite was rerun.

Concrete scope blocker: `tests/account-profile-access.test.mjs` is outside this card's allowedPaths. Its line75 assertion requires `/تقارير المعلم/`, while the unchanged report header emits the Rakeez brand. The current N64 card does not authorize changing that report contract or test. Changing N64 presentation to inject the report phrase, suppressing the failed assertion, or omitting the known failed result would not repair it.

Retry condition: the approved maintenance path must first establish the correct report-branding expectation from its applicable Product contract and, if this is a stale assertion, grant the inactive saved card the exact missing test path `tests/account-profile-access.test.mjs` for that bounded correction. If the assertion reflects an actual report requirement, it needs an appropriately authorized report repair instead. Preserve this candidate, base and all existing evidence; resume this exact session only after the material correction/access decision. No queue, validator, lock or controller policy was changed by this worker. This is a factual BLOCKED result, not another unchanged test retry or a request for routine PM approval.

## Scope repair completed — current run

Run: `f0cc91ed-004e-412c-84b0-d05d917c2423`.
The updated activated card explicitly adds `tests/account-profile-access.test.mjs` and confirms the accepted N24 report uses Rakeez with the supplied report title. This materially resolves the previously documented scope blocker. The original FAIL and blocked continuation above remain historical evidence; they have not been relabelled.

The obsolete `/تقارير المعلم/` assertion was replaced with assertions for the actual supplied h2 title, school metadata, and the teacher's name in the feminine subject-teacher signature. Existing masculine/feminine presentation, Rakeez branding, profile, validation, and cross-owner assertions remain. No report application output or Product source was changed in this continuation. The N64 scope helper now accepts the newly authorized test and explicitly protects report-print.js and brand.js as unchanged. Browser helpers accept an explicit RAKEEZ_RUN_ID with this run as the default so isolation checks bind the activated attempt.

Current verification:

- `node --test tests/account-profile-access.test.mjs tests/n64-confirmed-email-state.test.mjs tests/settings-0397.test.mjs`: **19/19 PASS**, including the complete corrected account-profile suite (**11/11**). This is new passing execution after the concrete assertion correction, not suppression of the earlier failure.
- `node tests/n64-confirmed-email-ui.mjs`: **PASS**, actual app synthetic owner contexts at 1280/390px, verified completion and neutral reload, zero Access shift, focus/selection, manual toggle race, RTL/mobile, no Auth mutation requests. Machine evidence now identifies this run.
- `node tests/n64-stability-browser.mjs`: actual app stability regression rerun under this run's canonical task guard; its result is recorded below after completion.
- Scoped no-mutation assertions, syntax for the three changed Product JS files, and diff whitespace checks passed. The unchanged original Product-source implementation and earlier evidence remain preserved in commits `46ae6335dbe9b614f4865c89662dccb3483e3026` and `8858337481befcf6b34c62474ce676406af46de1`.

No live account, real email, callback token, provider operation, push or deployment was used. Production verification remains with the independent controller/publisher.

Final current-run stability result: **PASS at 1280 and 390px**, collapsed experience-section shift 0px at both widths; delayed reads, manual state, same-owner notifications, settled paints, modal keyboard/focus/inert behavior and route-return checks passed. All five rejected synthetic outbox rows remained byte-identical. Both owned server ports 19864/19865 were verified without listeners after finally cleanup; isolated contexts/browsers were closed by the canonical helper. The original scope blocker is resolved by the authorized test correction and the new complete passing execution.
