---
name: rakeez-ticket-router
description: Classify a RAKEEZ X change by risk and select proportional existing test and release gates. Use at ticket intake or before final verification; do not use it to authorize deployment.
---

# Ticket routing

Read [TEST_MATRIX](../../../docs/TEST_MATRIX.md) and classify the requested change as `DOC/COPY`, `VISUAL`, `LOCALIZED_RUNTIME`, `CRITICAL_DATA_AUTH_SYNC`, or `PRODUCTION`. If multiple classes apply, use the highest relevant risk and explain any additional affected-domain gate.

Identify the changed files and behavior before selecting tests. Reuse repository runners and already-valid exact-tree evidence; do not run the full suite by reflex or call skipped tests passed. A promotion-only ticket verifies exact SHA, ancestry, deployment identity, and safe smoke rather than repeating local tests.

Stop at the ticket's authorization boundary. This skill chooses checks; it never grants permission to mutate Production, private data, Supabase, or Work-Active.
