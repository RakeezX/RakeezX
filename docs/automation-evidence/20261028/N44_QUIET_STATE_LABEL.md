# N44 — saved quiet state label

Task: n44-quiet-state-label-1028. Run: c4e9e85b-c2b6-409d-92d9-35c0048960ca.
Base: 98e28c9236c8a9e55f9308773d725ffbd728b9ea.

Added one visible Arabic paragraph beside the existing quiet control, derived from the same `quiet = readPushQuiet(context)` value as aria-checked. It says `وقت الهدوء المحفوظ: مفعّل` or `وقت الهدوء المحفوظ: غير مفعّل`. Existing editing-unavailable explanation, button, toggle handler and custom stored time semantics remain unchanged.

Validation PASS: `node --check src/views/notification-settings.js`; `node tests/n44-quiet-state-label-1028.test.mjs`. The focused test uses the existing served-demo and synthetic-account helpers, actual application DOM/store ownership checkpoint/handlers/CSS over a task-owned loopback HTTP server, and the canonical isolated browser helper. Null, default quiet and custom quiet states show the correct visible label while service availability is false at 320px and 390px. Render and direct invocation of the existing unavailable-service handler preserve each saved value, make zero runtime preference/enable/disable calls, and add no API requests. A cropped actual-app screenshot was visually inspected: label readable, control disabled, editing explanation separate, no clipping. Temporary screenshot removed after inspection.

The test seeds only a fresh synthetic context. No live account settings, registration, permissions, notifications, private custody or cloud inventory touched. Owned server/browser closed in finally. No full build required for this one-line UI change. Exact served source verification remains with the independent publisher; actual phone saved state and N44 live acceptance are not claimed. N44 remains OPEN.
