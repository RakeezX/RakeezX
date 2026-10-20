# N36 popup Start idle: local candidate

Task: continuous-n36-actual-popup-start-idle-20261020
Run: df985944-0715-4d5f-8c25-8cb791715f26
Base: 07255db1b962499075bbe2602e8397945ec8df28

## Reproduction and correction

The immutable 0.5.21 popup, actual click handler, serialized runtime message and actual ESM worker reproduce the idle signature when the own-extension popup MessageSender lacks optional documentId/tab: JOB_REQUEST is rejected, while collection.stage stays idle, capability unknown, counts null and errors empty. This proves an admissible synthetic sender failure, not the PO's native sender shape or conclusive attribution of every native failure.

Chrome documents documentId as optional and tab/frame information as context dependent: [MessageSender](https://developer.chrome.com/docs/extensions/reference/api/runtime#type-MessageSender). The popup document is not the source authorization. The worker validates the exact own-extension popup URL/id, rejects foreign/opaque URLs and child frames, binds the selected active source tab in its actual window and last focused browser window, then obtains the real source document through the existing scripting boundary. Missing optional popup metadata is accepted; source/Rakeez document, owner and grant guards remain. Selection uses documented [tabs.query](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-query) filters without searching inactive school tabs.

A click immediately shows checking. Acceptance requires a durable valid job and bound receiver. Denial becomes stage error with a finite safe reason and actionable source/account guidance. Duplicate Start preserves job/batch identity. Delayed status/ACK cannot replace newer storage progress. Popup-open remains read-only; closure does not cancel work. No Madrasati path creates a tab/window/offscreen context or keepalive loop. Noor's separate manual path is unchanged.

## Affected evidence

Command: node --experimental-vm-modules tests/n36-popup-start-idle-20261020/browser.mjs
Result: tests/n36-popup-start-idle-20261020/browser.json PASS.

- n36_actual_popup_click_serialized_background_accept_or_actionable_denial: shipped popup HTML/CSS/modules and click over owned HTTP, actual worker/runtime handlers and application receiver/owner guard with v3 receipt; synthetic Chrome APIs. Original idle preserved. Corrected accepted Start and unsupported/source-access/selection/account denials exercised; denied starts perform no source reads.
- n36_popup_context_close_double_start_owner_fence: absent documentId/tab, non-tab frame metadata, unavailable currentWindow with valid lastFocusedWindow, binding checkpoint then popup closed before ACK, duplicate Start same job/batch and one delivery, late ACK retains completed view. Foreign extension/URL/frame and real foreign-owner receiver denied. Unchanged downstream source/document/nonce/receipt/recovery code reuses prior qualified proof.
- n36_changed_0522_package_permissions_parity: node tests/n36-popup-start-idle-20261020/package.mjs --prepare PASS, recorded in package.json. Syntax, exact source/ZIP/member/size/hash parity, all 27 files, same permissions/hosts/CSP, immutable .21 assets, unchanged app/store/receiver/SW and source/transport/receipt guard blocks. Version bumped once to 0.5.22.

Archive: assets/extensions/rakeez-teacher-import-helper-0.5.22.zip
SHA256: f1d0936757f8d0cb03b88cf7ac289ce4cb3cf858f34f850f91a239f1c19f78a9
Bytes: 128752; runtime files: 27. Companion manifest contains every file hash; package.json lists unchanged reused source.

Observed origin/main advanced to 1a68b7f249c761a6854c954cddbfe9adca6080ce during this run (N107/ops metadata); its extension/assets diff from the assigned base is empty. No src/** or sw.js writes; normal publisher integration preserves N107.

## Limits and disposition

Fresh canonical isolated browser contexts used only loopback HTTP 127.0.0.1:49628 with external requests/Service Workers blocked. Owned contexts/browser and HTTP server close in finally. Synthetic source HTML is input to unchanged real readers, not a replacement popup/application UI. Existing account and served-demo helpers exercise real receiver guards. No real portal/account operations, native installed-extension MV3 certification, 303 collection or whole Sync suite.

A combined PowerShell documentation-write/diff/port-inspection command was rejected before execution with CreateProcess: Rejected (... rejected: blocked by policy). It was not rerun. This report was subsequently added through the scoped patch API; no port/process inspection was retried and no tool/security setting changed. Browser/server cleanup evidence is the successful harness finally completion.

Provider/immutable/served archive verification, stable updater physical 27-file parity and actual Chrome reload are NOT_RUN here. They remain publisher/controller steps. Actual user journey and whole N36 acceptance remain unproven. Original failure and qualified prior background/profile/receipt evidence are preserved. No push, deployment or queue changes.
