# N88 private database error boundary — scoped implementation repair

All Cloudflare metadata gates now pass. Candidatef28aa10c adds a fail-closed session guard but cannot meet it with the observed provider default/ddl logging. A read-only privilege check confirms the existing manager cannot SET the three relevant parameters; no setting write or refusal was attempted. Do not modify provider/global logging or grant privileges.

This correction authorizes implementing the required private error sanitization in the existing service/database code, and at most one exact new append-only private migration20261018185300_n88_private_error_boundary_staged.sql. Original six migration bytes/history stay immutable. The source/ACL/type/transaction and actual local server-log canary proof must establish the boundary before any hosted apply. Existing supported provider defaults are not simply declared safe; the guard remains fail-closed.

Existing private role/custody/TLS/owner/RLS/nonce/hosted fabricated validation and sequential publisher gates remain required. No canonical/Auth/schema/security/logging setting change, new credential grant, public SQL executor, data mutation test or message is authorized by this repair. Root performs only preparation/metadata bookkeeping; the existing controller resumes the exact saved Product session.
