# Bounded recovery of exhausted source-parity receipts

The original publisher capped delivery verification attempts at 20. N24, N90 terminology and N44 obtained provider success and exact immutable asset proof but exhausted the older, now-corrected Cloudflare HTML-tail source matcher. Their durable journals remain at stage=pushed, not a service rejection.

The reviewed guard extension permits an existing inactive task with terminal receipt status=blocked ONLY when code=SOURCE_PARITY_PENDING, retryable=false, existing task failure matches source parity, existing provider is success with matching published SHA, immutable served source passes, worker result is LOCAL_READY with every check PASS, no live mutation, candidate/base/session/run/worktree/process absence match, and the previous receipt hash plus reviewed pinned fixture hash exactly match.

The existing pending-receipt recheck path is preserved. Other terminal errors, absent provider proof, NOT_RUN checks, failed checks, active workers, wrong candidate, unreviewed receipts and real service/security refusals are not made eligible. Focused synthetic tests: 12/12 PASS.

Only the canonical maintenance helper can perform a guarded queue update. Product publisher remains the sole operator for actual current source/build/provider/Production proof. This patch does not mark any delivery PASS, rewrite prior receipts or modify account/data permissions.
