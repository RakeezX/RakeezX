/** AI: bind the exact public port and affected actual-app evidence; no service operations. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const taskId='continuous-n44-deliver-qualified-optin-ui-20261024';
const runId='c5c31ece-d841-4dbd-802e-5cba29044561';
const base='f034a0e8c06be5b756b84def3cb746c53e0003a9';
const qualified='fedbfe15ee79f4f0a00594ea4b8720830327256c';
const observedMain='a4f57ac0b13786610d56e9b84dc6ade08fde2fb2';
const dir='tests/n44-device-20261024/';
const git=(...args)=>execFileSync('git',args);
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=(ref,p)=>{
  const entry=git('ls-tree',ref,'--',p).toString().trim();
  assert(entry,`Missing ${ref}:${p}`);
  return git('cat-file','blob',entry.split(/\s+/)[2]);
};
const files=['src/lib/notification-push-runtime.js','src/views/notification-settings.js'];
const allowed=[...files,dir+'eligibility-browser.mjs',dir+'eligibility-browser.json',dir+'eligibility-evidence.mjs',dir+'eligibility-evidence.json',dir+'ui-publication-provenance.json','docs/automation-evidence/20261024/N44_OPTIN_UI_DELIVERY.md'];
const source={};
for(const p of files){
  assert(fs.readFileSync(p).equals(blob(qualified,p)),`Exact qualified bytes: ${p}`);
  source[p]={sha256:sha(fs.readFileSync(p)),baselineSha256:sha(blob(base,p)),qualifiedBlob:git('rev-parse',qualified+':'+p).toString().trim()};
}
// Conservatively bind the entire app tree, shell, fixture and test helpers.
const dependencyPaths=git('ls-tree','-r','--name-only',base,'--','src','index.html','sw.js','package.json','package-lock.json','tests/helpers/served-demo-readiness.mjs','tests/n44-fixture.mjs','scripts/ops-supervisor-v4/isolated-local-browser.mjs').toString().trim().split('\n').filter(p=>!files.includes(p));
const dependencies={};
for(const p of dependencyPaths){
  const current=fs.readFileSync(p);
  assert(current.equals(blob(base,p)),`Preserve base dependency ${p}`);
  assert(current.equals(blob(observedMain,p)),`Observed main dependency ${p}`);
  dependencies[p]=sha(current);
}
const changedQualifiedDependencies=git('diff','--name-only',qualified,base,'--',...dependencyPaths).toString().trim().split('\n').filter(Boolean);
assert(changedQualifiedDependencies.length>0,'Material dependency drift requires the original affected app check');
const report=JSON.parse(fs.readFileSync(dir+'eligibility-browser.json','utf8'));
assert.equal(report.taskId,taskId);assert.equal(report.runId,runId);
assert.equal(report.status,'PASS');assert.equal(report.checks.length,13);
assert(report.checks.every(c=>c.status==='PASS'));
assert.equal(new URL(report.origin).hostname,'127.0.0.1');
assert.equal(report.cleanup.ownedBrowserClosed,true);assert.equal(report.cleanup.ownedServerClosed,true);
for(const flag of ['ownerMatches','receiptMatches','databaseMatchesGuard'])assert.equal(report.recoveredCheckpoint[flag],true);
assert.equal(report.actualDeviceRegistrations,0);assert.equal(report.actualPermissionPrompts,0);assert.equal(report.actualProviderSendAttempts,0);
for(const p of [...files,dir+'eligibility-browser.mjs',dir+'eligibility-evidence.mjs'])execFileSync(process.execPath,['--check',p]);
git('diff','--check');
const changed=[...git('diff','--name-only',base).toString().trim().split('\n'),...git('ls-files','--others','--exclude-standard').toString().trim().split('\n')].filter(Boolean);
assert(changed.every(p=>allowed.includes(p)),`Unexpected scope: ${changed.filter(p=>!allowed.includes(p))}`);
const provenance={taskId,runId,baseSha:base,qualifiedCandidate:qualified,observedRemoteMain:observedMain,source,
  qualification:'Exact two qualified frontend files; current-main dependency drift covered by original 13-case actual-app scenario through canonical isolated local helper.',
  changedQualifiedDependencies,dependencies,
  browserHarnessSha256:sha(fs.readFileSync(dir+'eligibility-browser.mjs')),
  browserEvidenceSha256:sha(fs.readFileSync(dir+'eligibility-browser.json')),
  originalPublicBrowserEvidenceSha256:sha(blob(qualified,dir+'eligibility-browser.json')),
  originalEvidencePreserved:true,privateOrBackendArtifactsCopied:false};
fs.writeFileSync(dir+'ui-publication-provenance.json',JSON.stringify(provenance,null,2)+'\n');
const evidence={taskId,runId,status:'LOCAL_READY',source,
  checks:[
    {name:'n44_ui_refresh_lifecycle_and_guarded_optin',status:'PASS',evidence:'Original affected actual-app scenario rerun on current-base dependencies: changed-binding recovery, delegated click, negative configuration/lease/ownership/SW gates.'},
    {name:'n44_ui_actual_app_dom_styles_and_disposal',status:'PASS',evidence:'13 actual app DOM/handler/source-CSS cases PASS over owned loopback HTTP; disposal and no automatic unchanged-failure retry covered; browser/server closed.'},
    {name:'n44_ui_candidate_scope_and_provenance',status:'PASS',evidence:'Exact immutable qualified frontend bytes, full app dependency hashes equal base and observed origin/main, syntax and scoped diff checks PASS.'}
  ],
  postPublicationGates:[
    {name:'publisher integration and served changed-app verification',status:'NOT_RUN'},
    {name:'current actual device registration',status:'NOT_RUN'},
    {name:'closed-page send',status:'NOT_RUN'},
    {name:'OS arrival',status:'NOT_RUN'}
  ],
  historicalLimitations:'Original parent actual opt-in failure and all original FAIL/NOT_RUN records remain unchanged at the immutable qualified candidate. Local synthetic qualification does not resolve them or prove N44 acceptance.',
  operations:{provider:0,realAccount:0,registration:0,send:0,push:0,deploy:0},
  solePublisherRequired:true};
fs.writeFileSync(dir+'eligibility-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:evidence.checks,dependencies:dependencyPaths.length,changedQualifiedDependencies:changedQualifiedDependencies.length}));
