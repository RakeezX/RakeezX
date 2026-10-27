# N44 task-scoped Astra execution — 27 October 2026

Latest direct PO attachment bd4ca890-9fdc-4344-9538-1a0094b83144 overrides older Sol/medium/Standard only for original N44 session.

Installed model cache explicitly supports Astra max and Ultra. Ultra description says automatic task delegation, therefore use max, the highest listed single-agent level. Installed feature list confirms fast_mode is supported. Model cache offers Fast as priority. Official https://learn.chatgpt.com/docs/agent-configuration/speed documents Fast for Astra; the 1.5 multiplier is specifically GPT-5.6, not a separate Astra control. No Ultrafast/subscription/API purchase.

Controller already maps task.model/task.effort into attempt.json. Wrapper now uses the exact original N44 task/session/PO profile only to add per-process Fast priority and disable recursive multi-agent tools. All other tickets keep existing wrapper settings. No global config, security, permission, controller, helper or capacity change. A checkpoint executionProfile plus actual child command line and session turn context must verify launched settings; this preparation does not claim launch.

Verification: installed CLI feature/config read accepted Astra max/priority with fast_mode=true and multi_agent=false. Read-only PowerShell AST parsing of the prepared wrapper returned zero syntax errors. The standalone new PowerShell profile regression script was NOT_RUN: Windows execution policy refused its -File invocation; no execution-policy change or alternate execution of that refused script was attempted. Retain that limit honestly. Exact task/session/profile condition and unchanged non-N44 default were inspected; actual launched process evidence remains required.

44 historical checks remain intact. Metadata read is complete, registration expiry excluded. Actual sixth Windows Supabase arrival/correct click and final cleanup remain accepted evidence; no repeat. New phase is local synthetic causal repair/mobile admission/D107/PR6 qualification with zero live allocations. Only original controller starts the saved worker. Product publication remains with sole publisher; current full Product is OPEN.
