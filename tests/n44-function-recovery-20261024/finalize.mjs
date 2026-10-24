// AI: finalize existing affected proofs; does not repeat browser/PG/live phases.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const taskId='continuous-n44-projection-and-preference-recovery-isolated-20261024',runId='307de1f7-0481-4f93-b3ca-8b3d69c5bae1';
const baseSha='aa761cc6583385d0a5215c49324f68d20b0f8ba0',folder='tests/n44-function-recovery-20261024/';
assert.equal(process.cwd().replaceAll('\\','/'),'C:/Users/Abody/Projects/RakeezX/.worktrees/'+taskId);
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true});
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const normalized=raw=>hash(String(raw).replaceAll('\r\n','\n'));
const sources=['drafts/n44-push/backend.mjs','src/lib/notification-push-gateway.js','src/lib/notification-push-runtime.js','src/views/notification-settings.js'];
const proofs=Object.fromEntries(await Promise.all(['app-before.json','app.json','backend-before.json','backend.json'].map(async file=>[file,JSON.parse(await readFile(folder+file,'utf8'))])));
for(const p of Object.values(proofs))assert.equal(p.status,'PASS');
assert.equal(proofs['app-before.json'].checks.length,5);assert.equal(proofs['app.json'].checks.length,9);
assert.equal(proofs['backend-before.json'].checks[0].name,'reproduced zero-event CAS dead end');
assert.equal(proofs['app.json'].cleanup.browserClosed,true);assert.equal(proofs['app.json'].cleanup.serverClosed,true);
assert.equal(proofs['backend.json'].cleanup.exactPidAbsent,true);assert.equal(proofs['backend.json'].cleanup.exactPortReboundAndReleased,true);
for(const [file,expected] of Object.entries(proofs['backend.json'].sourceHashes))assert.equal(hash(await readFile(file)),expected,'changed after native proof: '+file);
const syntax=[];
for(const file of [...sources,...(await readdir(folder)).filter(f=>f.endsWith('.mjs')).map(f=>folder+f)]){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);syntax.push(file);
}
const dependencies=['src/lib/notification-push-client.js','src/lib/notification-push-browser.js','src/lib/notification-events.js','src/lib/notification-state.js','src/lib/offline-lease.js','src/store.js','src/app.js','src/lib/sync.js','sw.js','drafts/n44-push/postgres-repository.mjs','drafts/n44-push/auth-verifier.mjs','drafts/n44-push/canonical-source.mjs','drafts/n44-push/session-policy.mjs','drafts/n44-push/one-device-test.mjs'];
const unchanged={};for(const f of dependencies){const actual=normalized(await readFile(f,'utf8'));assert.equal(actual,normalized(git(['show',baseSha+':'+f])));unchanged[f]=actual;}
const original=git(['rev-parse','afe9328']).trim();
const reused=['tests/n44-device-20261024/new-owner-capsule.json','drafts/n44-push/activation/new-owner-capsule-9bf1346b-a235-4411-86f1-24a4dfcf5c98/manifest.json','docs/automation-evidence/20261024/N44_CURRENT_ELIGIBILITY_OUTCOME.md'].map(file=>({commit:original,file,normalizedSha256:normalized(git(['show',original+':'+file]))}));
const sourceHashes={};for(const f of sources)sourceHashes[f]={sha256:hash(await readFile(f)),normalizedSha256:normalized(await readFile(f,'utf8')),baseNormalizedSha256:normalized(git(['show',baseSha+':'+f]))};
const changed=[...git(['diff','--name-only',baseSha]).trim().split('\n'),...git(['ls-files','--others','--exclude-standard']).trim().split('\n')].filter(Boolean);
for(const f of changed)assert.ok(sources.includes(f)||f.startsWith(folder)||f==='docs/automation-evidence/20261024/N44_FUNCTION_RECOVERY.md','outside activated scope: '+f);
git(['diff','--check']);
const checks=[
 {name:'n44_zero_event_projection_cas_recovery',status:'PASS',evidence:folder+'backend-before.json + backend.json: real PostgreSQL17.6/backend/Auth locks/source revisions/outer COMMIT loss; app.json: actual runtime null/UNKNOWN CAS retention.'},
 {name:'n44_cleanup_pending_actual_settings_retry',status:'PASS',evidence:folder+'app-before.json + app.json: actual HTTP application DOM/handlers/CSS, owned failed revoke/update/lost ACK retry; foreign owner refuses. gateway.test.mjs actual15s timeout PASS.'},
 {name:'n44_preference_edit_consent_and_subscription_stability',status:'PASS',evidence:folder+'app.json: all four real preference handlers explicitly stop, preserve latest choices, no automatic opt-in/registration; fresh gesture creates new identity. Existing5 client +5 delivery/quiet/canonical/UNKNOWN guards PASS.'},
 {name:'scope_syntax_and_owned_cleanup',status:'PASS',evidence:`${syntax.length} syntax checks; diff/scope and unchanged dependency hashes PASS. Browser/server closed; native PG PID absent and port rebound. No build/live/service/publish operation.`}
];
const observedUnitRuns=[
 {command:'node --test tests/n44-function-recovery-20261024/gateway.test.mjs',status:'PASS',tests:4,evidence:'Includes actual15000ms response abort; committed stop read-only reconciliation; unchanged CAS retry; new consent/session/registration/preference rejection.'},
 {command:"node --test --test-name-pattern='payload|explicit_consent|owner/workspace|cleanup failures|action independently' tests/n44-push-preparation.test.mjs",status:'PASS',tests:5},
 {command:"node --test --test-name-pattern='disabled by default|due category|revocation/expiry/preference|uncertain exceptions|cleanup/revoke: commit' tests/n44-server-preactivation.test.mjs",status:'PASS',tests:5}
];
const historicalFailures=[
 'Before repair, real source defects reproduced in app-before.json and backend-before.json; these are expected defect observations, not acceptance passes.',
 'Initial UI harness read transitional subscribed/unsubscribed render before the full handler/projection completed. Replaced asynchronous import readiness predicates with synchronous same-document runtime snapshots, exact stop responses and existing bounded projection-quiescence helper pattern. Guards were not changed.',
 'Initial private-service test import lacked task-local pinned SDK; installed unchanged private package/lock in this test scope only. Test-only module resolver first recursed, then used Windows path instead of module URL; both corrected before any PG start.',
 'First task-local initdb exceeded native Windows path length; no server started, owned failed directory retained. Short unique pg directory then passed PID/birth/data-directory/port ownership and shutdown proofs.',
 'Lost HTTP ACK fixture initially omitted existing context CAS, allowing transport-level retry to commit twice. Corrected fixture to reject stale expectedRevision before mutation; actual app UNKNOWN/readback now passes.',
 'Outer-COMMIT proof refined to inject loss on authenticated projection transaction after its actual commit, excluding separate rate-debit commit; persisted changed stamp and withheld ACK both proven.'
];
await writeFile(folder+'provenance.json',JSON.stringify({taskId,runId,baseSha,observedOriginMain:git(['rev-parse','origin/main']).trim(),sourceHashes,unchangedDependencies:unchanged,reusedOriginalCapsule:reused,checks,observedUnitRuns,syntax,historicalFailures,operations:{realAccount:0,service:0,realSource:0,realRegistration:0,sends:0,publish:0},limits:'Source-only candidate. Original custodian must integrate exact backend delta into native composition and verify hosted parity before a separately authorized live journey. Original UNKNOWN/FAIL/NOT_RUN, capsule and send budget unchanged.'},null,2)+'\n');
console.log(JSON.stringify({checks,sourceHashes,changedPaths:changed}));
