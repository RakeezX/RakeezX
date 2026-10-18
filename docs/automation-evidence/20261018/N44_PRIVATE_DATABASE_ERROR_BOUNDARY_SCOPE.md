# N44 private database error handling

This is the bounded implementation repair needed under the shared observed provider logging posture. No new OAuth, logging SET privilege or provider configuration change is requested. The original SQL migration remains immutable; at most one additional private error-boundary migration20261018191000 is authorized. Fixed typed operations must sanitize errors inside PostgreSQL, preserve native result types/counts and transaction/owner/source/ACK behavior, and be proven with actual local logs before hosted apply. Current source graph metadata may follow the actual repair while previous certified pins remain historical evidence.

No Auth/canonical/RLS/security/logging change, generic privileged SQL executor, new real-data fixture, actual notification registration/send or separate publisher is introduced. Preserve c2be760c and original session; helper installs only when no workers/publisher are active.
