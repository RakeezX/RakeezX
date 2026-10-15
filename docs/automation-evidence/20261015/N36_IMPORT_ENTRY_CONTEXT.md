# N36 reviewed-bundle entry relocation — local candidate

Task: continuous-n36-unified-import-entry-independent-20261015  
Run: ee2b9354-e23f-43ce-8731-2251203ea73e  
Base: 6b014cfa3d7a0bd883063b36559f2d604d86ae9a

The Settings data/help row and its action/cleanup are removed. The existing teaching grade-transfer panel now contains one secondary **بيانات مدرستي** action, with explicit JSON-only preview/no-save/no-direct-portal wording. Backup, account settings and notifications are unchanged. N90 mapping, confirmation and export code is unchanged.

The entry checks authenticated owner, actual workspace/lease and a valid owned teaching before and after lazy import. The receiver retains its own owner/snapshot/lease guards and now receives the exact teaching/navigation context rather than accepting the Settings route. Unmount invalidates pending requests and closes the receiver. No new listener is installed by the entry. Existing receiver subscriptions are disposed on close. No new asset or startup module is introduced; cloud.js is already part of the application shell.

## Affected verification

- `node tests/n36-import-location-browser.mjs`: PASS, six checks recorded in `tests/n36-import-location.json`. Canonical isolated-local-browser helper, fresh contexts, task-owned HTTP port 49361, actual app DOM/handlers/CSS, local synthetic account fixture with real store/ownership guards. External requests and Service Workers blocked. Server and owned contexts/browser close in finally; no shared browser lease needed for this eligible local phase.
- 320/390/768/1280 RTL: exactly one grade-panel entry and none in Settings, Backup/archive links retained, no horizontal overflow, entry >=44px high and <220px wide. JSON file parse/mapping/local unapplied plan works; Escape/cancel restores entry focus, back navigation removes modal. Visual inspection of generated 320/1280 grade-panel screenshots confirms secondary placement. Screenshots are generated under ignored `test-results/n36-import-location/`.
- Same-owner synthetic Auth refresh preserves valid preview; foreign owner closes it and cannot reopen; owner change while lazy module response is held prevents opening. Actual store workspace deactivation removes preview/private controls.
- N90 CSV read/review/cancel, CSV download and existing Noor 40/60 choices/confirmation guard exercised without applying any data. Checkpoints of all stores/outbox unchanged, zero IDB writes and zero service requests after fixture setup at all four widths. Fixture provisioning alone performs synthetic setup writes before counters start.
- `node --test tests/n36-receiver-limits.test.mjs`: 3/3 PASS; existing strict envelope/schema/provenance/privacy/size/ambiguity checks retained. Restricted JSON schema and 100000-byte cap unchanged.
- `node --check` on the three changed views and new browser test; `git diff --check`: PASS.

No live account, portal, RPC, SQL, Auth service, real student data, personal browser or Production operation was used. Historical receiver browser coverage targeting Settings is superseded for navigation by the new location test; unchanged receiver engine checks are reused. Full official extraction/account-save remains OPEN. Publisher integration/build/served-source parity and Production verification are NOT RUN by this worker and remain with the independent controller/publisher.
