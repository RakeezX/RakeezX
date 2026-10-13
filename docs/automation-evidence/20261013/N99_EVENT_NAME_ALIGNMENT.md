# N99 event name alignment — 2026-10-13

The public landing appearance event is now named `campaign_landing`; `demo_started` remains emitted only after successful Demo initialization. The collector, eligibility rules, payload, transport protections, and tracked triggers are unchanged.

Existing tabs that already hold `rakeezx-marketing-landing_view=true` are treated as counted and do not emit a second landing event after this update. The old session marker is retained. Previously collected `landing_view` provider records remain historical data under their original name; this change does not rename, delete, or resend provider history.
