# N44 — notification settings simplification

AI-authored scoped source change, 26 October 2026.

- Task: `continuous-n44-user-settings-simplification-20261026`
- Run: `5bfa6d74-f0cf-4c82-b46e-549faef46dd1`
- Base: `89a3b1ddaef04e6a0fa6192b798e4ac2f073bcb3`; `git ls-remote origin refs/heads/main` observed the same revision during verification.
- Authority: activated source-only card and current N44 ledger note `[PO-20261026-USER-SETTINGS-CLARITY]`. No ledger, queue, service or private attachment changes.

## Result

The ordinary page shows a short bell/device explanation, truthful device availability and browser permission, existing cleanup/Stop, lesson and due preferences, quiet preference and local-save explanation. Disabled configuration and unsupported browsers have no activation button. Quiet settings retain the existing availability guard and show why the control is disabled.

One native **الدعم الفني** disclosure at the bottom contains the original current identity, configuration/HTTP result, manual reminder verification, authorization receipts, source ancestry/revisions and deletion receipts. Current identity remains available with no configuration result or sources. Deleted sources are grouped under a closed **مصادر سابقة محذوفة (count)** disclosure. No store rows, tombstones or receipt fields were removed. Pending/failed results remain visible outside Support. All original action implementations, scope guards, selector names and source tokens are retained.

Support starts closed. An explicit open choice survives same-context repaint; closing it remains closed. Workspace deactivation clears the private DOM synchronously, and a different owner receives closed Support. Route unmount drops the retained DOM reference and scope.

## Affected verification

`node --check src/views/notification-settings.js` — PASS.

`node tests/n44-settings-ux-20261026/browser.mjs` — all three required checks PASS; structured results and seven PNGs are in that directory:

1. `n44_settings_default_user_hierarchy_and_support_disclosure`: actual HTTP application DOM, account store and CSS; one closed Support, no visible identity/HTTP wall, 30 synthetic deleted sources collapsed, manual disclosure keyboard behavior and no automatic source/verification calls.
2. `n44_settings_cleanup_and_owner_context_fences`: synthetic disabled/unsupported runtime snapshots, no fake activation, unavailable activation with cleanupPending still invokes the original disable handler; manual source status, cleanup receipt and authorization receipt selectors exercised. Actual timing/category/due-day preferences and focus survive repaint. Quiet toggles through its original handler when available, retains its stored state when unavailable, and then becomes disabled. Normal subscribed Stop and busy-state disabling are also exercised through the original handler. Actual workspace deactivation clears private DOM synchronously; stale actions cause no runtime calls. A newly prepared synthetic owner gets closed Support without the previous identity. Identity is discoverable with no config outcome or sources. Failed/unknown/pending status remains visible with Support closed.
3. `n44_settings_actual_responsive_keyboard_no_extra_requests`: 320/390/1280 in light and dark, plus expanded Support at 320 dark; RTL, no horizontal overflow, visible interactive targets at least 44 CSS pixels. Focus remains on the category control after keyboard toggle and on Support after repaint. Scoped axe color-contrast, button-name and ARIA-value checks report zero violations. No service requests beyond the pre-interaction baseline, and manual read/verification counters advance only on explicit actions.

The test uses the canonical `withIsolatedLocalBrowser` helper: fresh disposable context, loopback-only ephemeral owned port, external requests and Service Workers blocked, no saved credentials, native subscription or permission request. The account fixture uses real ownership/provisioning guards and current-document owner/database/receipt checkpoint; runtime snapshots/manual results are synthetic ports, not service or delivery certification. Browser and server close in their respective `finally` blocks. This eligible isolated phase does not acquire the shared live-browser lease.

All seven screenshots were visually inspected: `default-{light,dark}-{320,390,1280}.png` and `support-dark-320.png`. The default page has readable status/preferences and one compact closed Support; technical source articles appear only after opening it. Existing shell navigation/read-only fixture notice remains visible. No clipping or horizontal scroll was observed; light/dark contrast also passed the scoped automated check.

The first harness attempt inspected an attribute before the application's scheduled repaint and failed (`false` versus `true`); the harness now waits for the actual DOM attribute. No Product guard was relaxed. A supplementary unchanged-handler assertion initially compared CRLF worktree text against LF Git text; normalization corrected that assertion. Normalized comparison confirms all action implementations/imports and the runtime/gateway match the pinned base. `git diff --check` — PASS. No full build or unrelated N44 suite was run.

## Limits and preserved prior evidence

This candidate proves only the settings presentation and affected synthetic interactions. Existing sourceDeleteACK, normal Stop/OFF and registration disposition evidence remains historical evidence, not a new live run. The recorded TLS failure and OS arrival NOT_PROVEN remain unchanged; no arrival, send or umbrella N44 closure is claimed. No real account, service, Auth, SQL, native push, permission, registration, source deletion or provider operation occurred.

The independent controller/publisher still owns integration, build, Pages publication and served-source proof. Those steps were NOT_RUN by this worker; this worktree is not claimed deployed or Product accepted.
