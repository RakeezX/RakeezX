---
name: rakeez-beta-readiness-auditor
description: Audit a fresh RAKEEZ X account's Beta readiness with synthetic identities, classifying each journey stage without enabling signup or altering real user data.
---

# Fresh-account Beta audit

Use an authorized disposable account and isolated browser/storage. Observe the real flow for signup/auth, OTP, profile, provisioning, defaults, class, students, schedule, attendance, scores, logout/login, second-device restore, and account isolation. Record action, observed result, persistence/reload where relevant, and runtime errors; avoid inventing a pass from code inspection alone.

Classify each stage as `PROVISIONED`, `EMPTY_BY_DESIGN`, `BROKEN`, `MISSING`, or `SECURITY_RISK`. Distinguish an intentionally empty workspace from a failed bootstrap. Treat cross-account exposure or lost data as fail-closed and stop.

Do not enable signup, create Production users, change Auth policy, or access Product Owner data unless a separate ticket explicitly authorizes that action. Use [TEST_MATRIX](../../../docs/TEST_MATRIX.md) for proportional automated coverage.
