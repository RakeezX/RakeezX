# N100 delivery completeness — scoped candidate

Task `continuous-n100-delivery-completeness-20261013`; run `dc97471f-5642-4ad4-93de-4404ef8981e0`.
Base/current origin main observed via `git ls-remote origin refs/heads/main`: `0076df007820ddac1dd54b23b2b3c97e821923bc`.
Original feature candidate: `de590a5f0c779aa667595d16c9a390d1a5760e5b`.
Authority: activated N100 completion card / `PO-20261013-N100-original-declared-migration-completion`.
The final runner result binds this evidence to the candidate commit.

## Service prerequisite: PASS, actually applied and read back

Project `xlrubcwjqktzzunrvuns`, schema `rakeezx`. The original file
`supabase/migrations/20261013101500_n100_preserve_target_marks.sql` is unchanged,
identical to the original candidate, SHA256
`a682af80aa8d12e34601ab2113c0ffaaf3b849b8eddff2ac63612679d8b4540f`.
Original native certification reused from
`C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n100-preserve-target-marks-20261013/test-results/n100-native/result.json`
and [original evidence](N100_TARGET_PRESERVATION.md). Its four native server gates remain successful; no repeat native provisioning.

Under the owned live-mutation phase lease, fresh provider migration history contained no N100 migration.
Exactly five current signatures and source preimages were present, owned by postgres, SECURITY DEFINER,
empty search_path, with original exact ACLs:
apply `986af8cf5fbbd0966cfc5aa34d15e49c`;
builder `3b72cb1b9c16b2d34baf6709ab40c70c`;
state `b6acbc0a1e59ae6ac54d0832723446dd`;
planner `870a4a5c96bd73241d8c2b6eb02248cf`;
capability `97cf6cdf2eb3518e78e7d1aae49ae185`.
Public planner/apply/capability ACL was `{postgres=X/postgres,authenticated=X/postgres}`;
private builder/state ACL was `{postgres=X/postgres}`.
Exact definitions also matched the original source; no overload or ambiguous prior application existed.

Supabase `apply_migration` executed the original file once, returned success.
This consumes the same original one-migration allowance; there is no additional allowance and no replay.
Actual history readback: `n100_preserve_target_marks`, version `20261013105436`,
stored statements MD5 `255c957e947c1e0decf48c4f6bbec5a0`.
Actual capability readback: `{"protocol":"N73_D119_V2","distributionApplyVersion":2,"targetPreservationVersion":1}`.
All seven complete provider definitions were compared byte-for-byte with the original native-certified result.
Every body MD5, ACL, security setting and search_path matched; every owner remains postgres:

| Signature | Actual body MD5 | Execute ACL |
| --- | --- | --- |
| `rakeezx.apply_score_distribution_plan(text,text,text,text,boolean)` | `d93b794d2c55bda0f499a3159a859b17` | postgres, authenticated |
| `rakeezx.n73_build_distribution(text,text[],text[],text)` | `31c658130e794add2190ffe121e2902c` | postgres only |
| `rakeezx.n73_build_distribution(text,text[],text[])` | `8f56076d22eb24ec4b6e483ab47f6496` | postgres only |
| `rakeezx.n73_distribution_state(text,text[])` | `b6acbc0a1e59ae6ac54d0832723446dd` | postgres only |
| `rakeezx.plan_score_distribution(text,text,text[],text[],text)` | `9958838e5061db463eb8a2de92b86720` | postgres, authenticated |
| `rakeezx.plan_score_distribution(text,text,text[],text[])` | `2bc9107e2958a80fa0a5a843e4ca690b` | postgres, authenticated |
| `rakeezx.score_distribution_capability()` | `5eb508bfd9583675cd8795163a72b1ef` | postgres, authenticated |

No real scores, student/teacher rows, Auth accounts, secrets, fixture pair or grade-copy transaction were read/written.
Only scoped migration metadata/function source/capability was queried. Service lease released.
The original evidence's delegation of SQL to the generic publisher was incorrect; this worker has now completed
that prerequisite. No Git/provider front-end deployment or Product acceptance is claimed here.

## Front-end prerequisite: PASS, minimal repair

`sw.js` follows the existing explicit shell convention: version v55 → v56 and adds exactly
`./src/lib/score-distribution-copy.js`. No cache/runtime redesign.
Original boot/store import graph really imports the new module; v55 omitted it.
The current source equals observed origin main; original feature source remains unchanged apart from
the necessary capability UI handling below. Existing N71 additions in cloud.js are preserved.

`src/views/items.js` now binds preservation availability to the supported distribution protocol/version
AND `targetPreservationVersion === 1`. It resets availability on mount, disables unsupported preservation,
and explains why. Demo remains supported. Definitions-only stays the default; existing legacy copy remains.
No cloud.js/store/engine migration changes were required. Actual store preflight still rechecks capability
and ownership before review/apply, so losing capability after selection cannot fall back to definitions.

## Actual affected checks

`node tests/n100-delivery-browser.mjs`: 7 PASS.
Shared browser lease; fresh disposable Chromium contexts, task-owned unique loopback HTTP port,
synthetic Demo/account IndexedDB and transport, no user's browser/profile.

- Original missing dependency reproduced: install the actual v55 shell from this immutable base over HTTP,
  before any app import can incidentally cache the new module; set context offline.
  The dependency is absent, actual app.js import fails, and application layout never boots.
- Corrected offline dependency: fresh v56 shell installs the module before initial app import.
  With networking offline, the actual source import graph boots into ready Demo with students.
  Actual items route, distribution-item DOM and source app.css CSS rules render.
  Screenshot `test-results/n100-delivery/offline-items.png` inspected.
- Five capability scenarios exercise actual account UI/store/cloud serialization.
  Known RPC URLs are fulfilled synthetically; all other external requests are aborted.
  Supported preservation sends explicit `p_mode: preserve-target`.
  Old capability disables preservation and definitions review still calls the legacy planner without p_mode.
  Missing RPC (404/PGRST202) and mismatched protocol offer the existing legacy copy with no preservation option.
  Capability loss after selection rejects before a new plan or apply, never silently downgrades.
  Each scenario also checks the real owner guard at the store entry after an auth/workspace mismatch.
  No real cloud request escapes the synthetic transport.
  Screenshot `test-results/n100-delivery/capability-old.png` inspected:
  disabled preservation and explanation, selected definitions and actionable review are visible.
- Result: `test-results/n100-delivery/result.json`, ownedBrowserClosed/ownedServerClosed true.

Original harness failure retained: offline items first assertion used a strict heading locator but the actual
app correctly renders two headings with the same title. Narrowed to the first visible heading, retaining
real route/DOM/CSS checks. No Product guard changed.

`node --check sw.js`, `node --check src/views/items.js`,
`node --check tests/n100-delivery-browser.mjs`, and `git diff --check`: PASS.

Original 15 actual account/UI/native/backup/owner/atomic tests, 3 preservation tests and 14 N73 checks are
reused as recorded in original evidence; no broad suite or repeated Preview. The sole UI change has the
new targeted capability checks above. cloud.js N71 additions do not change distribution serialization/guards.

## Disposition

Owned browser/server closed in finally and shared browser lease released before return.
No queue/status/controller/maintenance files changed; no push/deployment.
Service prerequisite and local front-end prerequisite are separately proven.
Independent controller/publisher integrates and verifies the minimal front-end candidate.
N100 umbrella remains open/awaiting PO; no Production delivery or PO acceptance claim.
