/** AI: scoped preparation guard, not a rendered-UI acceptance test. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const card=JSON.parse(readFileSync('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-region-response-attestation-20261020.json','utf8'));
const missingPath='src/lib/student-portal-runtime.js',source=readFileSync(missingPath,'utf8');
assert.equal(card.id,'continuous-n88-region-response-attestation-20261020');
assert.equal(card.attempt.runId,'b4752d59-74d2-4f26-9ea0-86cc7255d5a5');
assert.equal(card.allowedPaths.includes(missingPath),false);
assert.ok(source.includes('current(false);return {ok:response.ok,async json()'));
assert.ok(source.includes('handle=mountClassPortal(content,{client:admittedClient,getContext,subscribe,classLabel});'));
const report={status:'BLOCKED',kind:'inactive-card-path-correction-required',taskId:card.id,runId:card.attempt.runId,sessionId:card.sessionId,
 missingPath,observedRuntimeSha:createHash('sha256').update(source).digest('hex'),
 evidence:[{line:104,fact:'Actual authenticated request adapter returns only ok/json; trusted response headers are discarded before createClassPortalClient receives the response.'},{line:127,fact:'Initial admission owns the first list and mounts the view only after that list succeeds. Failure and first-list diagnostic attachment also require this runtime entry.'}],
 reason:'Allowed client/view files cannot recover a discarded trusted response header. Adding another fetch, global interception, or private-state access would violate this bounded task.',
 pendingRepair:'Add only src/lib/student-portal-runtime.js to the inactive card so the existing adapter can pass finite response metadata and bind initial success/failure diagnostics without changing ownership guards.',
 frontendDiagnostic:'NOT_IMPLEMENTED_PENDING_SCOPE',renderedUi:'NOT_RUN',carrierPromotion:'NOT_RUN',newProviderOperations:0,newBrowserOrClassReads:0,ownedResourcesCreated:0,
 continuation:'Preserve the exact candidate and original session; controller resumes after scoped inactive-card repair. Reuse unchanged carrier proof. No worker/helper/queue edits here.'};
writeFileSync(new URL('scope-blocker.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
