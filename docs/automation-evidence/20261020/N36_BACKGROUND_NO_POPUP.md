# N36 — background without an open popup or new runner tab

Task `continuous-n36-background-run-no-tab-or-open-popup-20261020`, run `b29c3ee4-665a-451f-9aa1-e332185eb04f`.
Base `91b12fa2c6488c74a8cda81650861cbe1b13e870`. Observed fetched origin/main `610aa754012d090131e26c59f50750365b6b8328`. Its N107 changes are independent manual class/grade import code; this candidate does not edit app/store/class-import-center or undo them. No queue, service, account or school operations.

## Result and limits

0.5.21 runs Madrasati collection in the existing MV3 worker. The action popup sends one explicit Start and shows session-backed progress/result/cancel. It can close immediately. No Madrasati runner tab, new app tab/window, offscreen document, foregrounding or new permissions. Existing source and authenticated Rakeez tabs must remain open and authorized. Necessary observed same-origin source navigation is retained; no new endpoint or school host is added. Noor remains the separate manual selected-column flow.

Job ownership and source document are captured at Start. The owner-ready app capability/batch is checked before source reading. Each phase checks the same app document/batch/owner/academic context and original source document/role/school; document-targeted injection prevents a changed document being read. Planned navigation is checkpointed first, with one role switch and an exact destination fence. An uncertain navigation is stopped, never replayed to drag the user back. Full browser restart clears session storage; continuation with the browser closed is not promised.

Private rows, finite Set/Map arrays, offsets and the original serialized v3 envelope/nonce are kept only in chrome.storage.session under fixed expiry. One pending-phase alarm plus actual tab/outcome events resumes an existing authorized job; startup/popup open without a job cannot collect. One runner prevents duplicate same-worker work. Source requests and transport records are cleaned only for this job. App-saved data remains intact.

Transport is called directly inside the worker using stored job authority, not runtime messages to itself or a fabricated popup sender. Envelope preparation precedes delivery. A receipt is stored before removing its claim payload. Success advances the checkpoint before consumed-receipt cleanup. Unknown stays on the same action/nonce/batch; only a genuine original-document schema-valid final receipt may resolve it. Final ACKs cannot be replaced/replayed. No missing receipt implies success. Unresolved setup fields remain optional finite labeled details; local save does not claim cloud Sync.

## Affected verification

- `n36_background_actual_handlers_popup_closed_complete`: PASS, `node --experimental-vm-modules tests/n36-background-no-popup-20261020/browser.mjs`. Real HTTP extension Start DOM/handler and source readers, actual global app receiver, owned IndexedDB profile/outbox, real Settings/header and detailed serialized v3 receipt. Popup destroyed after Start; supported report, profile and timetable completed using existing tabs. Reopened popup displays result without collecting. All new-tab/window/offscreen paths are unavailable/failing in the synthetic Chrome boundary. Actual calendar stays fixed; private names/values are absent from recorded receipt diagnostics.
- `n36_background_restart_unknown_receipt_cancel_owner_expiry`: PASS in the same affected check. Fresh ESM realms retain persistent synthetic Chrome session data after the collect checkpoint and after an actual unknown receipt. Original nonce resolves via the real final serialized receipt, one delivery/claim and zero duplicate durable writes. Cancellation, expiry, source URL/document, app document and foreign owner stop delivery and preserve profile/outbox; no subsequent source read on these invalidations. No-job bootstrap/status/alarm and rejected website/foreign/nonexact Start requests read nothing.
- `n36_background_changed_package_no_new_permissions`: PASS, `node tests/n36-background-no-popup-20261020/package.mjs --prepare`. Exact source/ZIP/SHA256/size parity, 27 runtime files (previous 25 plus two DOM-free coordinator modules), 0.5.21, same permissions/host/CSP, all packaged JS syntax, old 0.5.20 immutable. App/extension schema and previously qualified pipeline bytes reused unchanged.

Archive `rakeez-teacher-import-helper-0.5.21.zip`: SHA256 `aeef5c41efe6d16dff68055daed21e6400ff6b8d752eac671cea32dd181fa4b2`, 127128 bytes. See `tests/n36-background-no-popup-20261020/browser.json`, `package.json`, `settings-popup-closed.png`, `reopened-result.png`.

The original local failure is preserved in browser.json: the first composition stopped APP_CHANGED because busy receiver readiness was treated as lost authority after delivery. The corrected receipt phase waits without rereading source or reposting and still requires the same document and valid batch before advancing.

These are actual Product modules/DOM/handlers/CSS over owned HTTP with synthetic Chrome API boundaries and fresh worker realms, **not native MV3 lifecycle certification**. The canonical isolated browser helper blocks Service Workers; no security changes were made to obtain native proof. No real school/portal/account read or mutation, no old refusal retried. Native Chrome worker termination, actual user journey and Chrome reload: NOT_RUN. Owned contexts/browser/server closed in finally; no shared browser lease is used for this eligible isolated local phase.

## Reused proof / downstream gates

Prior qualified profile/source-wins/raw-year-term/owner/quiet pipeline and necessary-navigation evidence remains unchanged; no 303-row school, Sync, SQL, deletion/restore or old browser suite replay. Actual previous PO successes and failures remain open as recorded; this does not close N36.

- `source-adapter.js`: `d78773bba91bfcfb2620038d78f43823dfb7ba3cebf6cc7184e1ab8345585e9c`
- `source-roster.js`: `2bc76e92e5996ca3ad6579bd064cc33dbd0feca797929bd88fc05e02c998a067`
- `selection.js`: `c55a90a2845a64378ff815fac0140c93a12587945d29808d82f9921fcbfeba13`
- `navigation.js`: `fdcbb7e3a797e21f1d7e639a8ffa54be9a8631aaf39418a0dee36b46fc93e3ab`
- `route-diagnostics.js`: `8a37207837252e27d410a11d2d0b867368a2319077d055405a4e2e62da953e9a`
- `handoff-protocol.js`: `6fd9fb5321b9dc478135584a133a5663ddb940dbca0fd5905a7be62527e72802`
- `categories.js`: `fcd0b93335a605b1aba6b84651b11188528b9a556648d75bc3cf4a04a182acda`
- `categories-popup.js`: `85417c917501948fae76931c68532b39eba59ed1aaafcba366bd39edf93485d9`

- Existing `n36-stable-sync.mjs` read-only SHA256: `4b6604dbc45ecba96d0dc59629c5a1d9f83a1798e4336fc2bdea8b7b08377cd6`.
- Existing `n36-update-stable.mjs` read-only SHA256: `c0f6db3e19fdd346c2b1f5abca9736195b83df871266d8f942202328397db90b`.
- Existing `n36-extension-package-policy.mjs` read-only SHA256: `968398f5c4a60d34523cc76bbeb381a8af65aa278a250ec220c3a6f7e4ebce35`.

The existing updater accepts a manifest-defined 15–40-file set and enforces verified immutable/served publication, archive/file hashes, known local-file parity and no downgrade; 27 files fit unchanged safety. It was inspected, not invoked or rewritten.

Provider/immutable/served 0.5.21 archive verification and the existing stable updater's physical 27-file version/hash parity remain mandatory **NOT_RUN postdelivery**. The independent controller/publisher owns those steps and the companion published-download-label card. No push, deploy, stable install or Chrome reload was performed here.
