# N135/N136 — mobile class identity and account notices

PR16 reference: `34a7cdb8f91f4309bf89638ab67b3be1a766c886` (28 October 2026).
Current qualification: [N136_ACCOUNT_UI_RELEASE.md](automation-evidence/20261030/N136_ACCOUNT_UI_RELEASE.md).

The narrow-screen N135 CSS is already present on the current base: at <=520px the status badge occupies a separate row below the class identity. It is preserved without duplicating or replacing newer CSS. Attendance, full accessible names and print semantics remain unchanged.

N136 transfers only the reviewed presentation changes: a pure auth-notice dedupe policy, initial shell and status repaint integration, and a direct class-verification button opening the existing login sheet. Dedupe applies only to the exact verification gate; non-auth Sync failures and ownership conflicts remain visible. Clicking login does not unlock the class or change the ownership, Auth, lease, data or write guards.

The current tests use the actual app over task-owned loopback HTTP with disposable Chromium contexts and external requests/Service Workers blocked by the canonical isolated helper. The release report records the executed checks and synthetic fixture limits. Historical PR test claims are not used as current evidence. Local qualification does not establish Production publication or resolution of an actual account-session failure.
