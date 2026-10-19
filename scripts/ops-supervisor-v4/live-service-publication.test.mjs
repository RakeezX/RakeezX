// AI: regression for backend-only delivery and fail-closed service proof.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {verifiedLiveServicePublication} from './live-service-publication.mjs';
import {verifiedDeployment} from './controller.mjs';
import {verifiedLiveServiceDeclarationRepair} from './apply-reviewed-maintenance.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./test-fixtures/n44-live-service-publication.json',import.meta.url)));
const fresh=()=>structuredClone(fixture);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('actual backend delivery requires its explicit independently preserved service evidence',()=>{
 const {task,receipt}=fresh(),old=structuredClone(task);delete old.servicePublicationEvidence;
 assert.equal(verifiedDeployment(old,receipt),false);
 assert.equal(verifiedLiveServicePublication(task,receipt),true);
 assert.equal(verifiedDeployment(task,receipt),true);
 assert.equal(receipt.productSourceChangeObserved,false);assert.deepEqual(receipt.changedAssets,[]);
 assert.equal(task.servicePublicationEvidence.final.optionalDnsRead.status,'FAIL');
 assert.equal(task.servicePublicationEvidence.final.optionalDnsRead.retried,false);
});
const mutations={
 'another task cannot reuse the service exception':f=>{f.task.id='unrelated';},
 'undeclared live authority is rejected':f=>{f.task.liveMutation=false;},
 'another project is rejected':f=>{f.task.preparationAuthority.supabase.projectId='other';},
 'candidate mismatch is rejected':f=>{f.task.candidateSha='1'.repeat(40);},
 'base mismatch is rejected':f=>{f.task.baseSha='1'.repeat(40);},
 'publication mismatch is rejected':f=>{f.task.servicePublicationEvidence.publishedSha='1'.repeat(40);},
 'missing recorded source artifact is rejected':f=>{f.receipt.sourceOnlyPaths=[];},
 'changed manifest source is rejected':f=>{f.receipt.evidence.production.assets.find(x=>x.repoPath.endsWith('manifest.json')).observedSha256='1'.repeat(64);},
 'wrong role is rejected':f=>{f.task.servicePublicationEvidence.final.restrictedIdentityAndFullTls.roleExact=false;},
 'unencrypted upstream is rejected':f=>{f.task.servicePublicationEvidence.final.restrictedIdentityAndFullTls.upstreamSsl=false;},
 'untrusted client TLS is rejected':f=>{f.task.servicePublicationEvidence.final.restrictedIdentityAndFullTls.clientTlsAuthorized=false;},
 'missing source boundary is rejected':f=>{f.task.servicePublicationEvidence.final.restrictedIdentityAndFullTls.sourceBoundary=false;},
 'different Edge bytes are rejected':f=>{f.task.servicePublicationEvidence.edgeSource.downloadedSha256='1'.repeat(64);},
 'unverified Worker source is rejected':f=>{f.task.servicePublicationEvidence.workerSources[0].exact=false;},
 'fail-open route is rejected':f=>{f.task.servicePublicationEvidence.final.route.request_limit_fail_open=true;},
 'scheduler activation is rejected':f=>{f.task.servicePublicationEvidence.cloudflare.configuration[1].enabled='true';},
 'cron activation is rejected':f=>{f.task.servicePublicationEvidence.final.cron=['* * * * *'];},
 'real sends are rejected':f=>{f.task.servicePublicationEvidence.final.realSend=true;},
 'device registration is rejected':f=>{f.task.servicePublicationEvidence.final.devicePermissionOrRegistration=true;},
 'missing cleanup is rejected':f=>{f.task.servicePublicationEvidence.final.cleanup.plaintextTransientInputsAbsent=false;},
 'unverified configuration set is rejected':f=>{f.task.servicePublicationEvidence.final.providerSecretNamesAndDigestsMatched.pop();},
 'failed request isolation is rejected':f=>{f.task.servicePublicationEvidence.final.actualUnauthorizedHttp[0].httpStatus=200;},
 'worker logging enable is rejected':f=>{f.task.servicePublicationEvidence.cloudflare.privacy[0].configurationResponse.logs.enabled=true;},
 'invalid proof timestamp is rejected':f=>{f.task.servicePublicationEvidence.final.restrictedIdentityAndFullTls.recordedAt='invalid';},
 'expired proof at publication is rejected':f=>{f.task.servicePublicationEvidence.final.restrictedIdentityAndFullTls.recordedAt='2026-10-01T00:00:00Z';},
 'failed Pages provider remains rejected':f=>{f.receipt.provider.conclusion='failure';}
};
for(const [name,mutate]of Object.entries(mutations))test(name,()=>{const f=fresh();mutate(f);assert.equal(verifiedDeployment(f.task,f.receipt),false);});
function repairFixture(){
 const f=fresh(),task={...f.task,status:'blocked',lastFailure:'Publisher returned incomplete or mismatched deployment proof',deliveryReceipt:f.receipt};
 delete task.servicePublicationEvidence;
 const card=structuredClone(f.task);delete card.candidateSha;delete card.baseSha;
 card.completionMode='reconcile_live_service_publication';
 card.verificationRepair={kind:'reviewed-nonsending-service-evidence-v1',publishedSha:f.receipt.publishedSha,priorReceiptSha256:hash(Buffer.from(JSON.stringify(f.receipt,null,2)+'\n')),reviewedFixtureSha256:'1'.repeat(64),reason:'Actual named nonsending backend is deployed; preserve original provider receipts and apply strict source-bound declaration only.'};
 return {task,result:f.result,update:{card,expected:{resultState:'LOCAL_READY'}}};
}
test('read-only reconciliation preserves the actual delivery and unperformed device acceptance',()=>{
 const {task,result,update}=repairFixture();assert.equal(verifiedLiveServiceDeclarationRepair(task,result,update),true);
});
for(const name of ['receipt','scope','required-check','failed-check'])test('reconciliation rejects changed '+name,()=>{
 const {task,result,update}=repairFixture();
 if(name==='receipt')task.deliveryReceipt.verifiedAt='2026-10-19T05:00:00Z';
 if(name==='scope')update.card.allowedPaths=['**'];
 if(name==='required-check')result.checks=result.checks.filter(c=>c.name!==task.requiredChecks[0]);
 if(name==='failed-check')result.checks.push({name:'real failure',status:'FAIL',evidence:'must remain a blocker'});
 assert.equal(verifiedLiveServiceDeclarationRepair(task,result,update),false);
});

function transportFixture(){const f=fresh();f.task.id='continuous-n44-cloudflare-redirect-transport-fix-20261019';f.task.scopeKey='n44-existing-ingress-transport-compatibility';f.task.liveAuthorizationRef='PO-20261019-N44-CF-TRANSPORT-REPAIR';f.task.preparationAuthority.providers.keepBindingsRequired=true;f.task.preparationAuthority.providers.secretReadOrWrite=false;f.task.preparationAuthority.supabase.function.write=false;f.task.servicePublicationEvidence.final.taskId=f.task.id;f.task.servicePublicationEvidence.bundleHashes['cloudflare/worker.mjs']='a'.repeat(64);f.task.servicePublicationEvidence.manifest.outputs['cloudflare/worker.mjs']='a'.repeat(64);f.task.servicePublicationEvidence.final.transportCompatibility={version:1,platform:'cloudflare-workers',redirectMode:'manual',probeMethod:'POST',beforeHttpStatus:503,afterHttpStatus:401,rejectsRedirects:true,localForwardAttempted:true,upstreamSourceUnchanged:true,originalCustodyUntouched:true,bindingsPreserved:true,nativeSourceExact:true};return f;}
 test('exact ingress correction requires actual forwarding and retained custody',()=>{const f=transportFixture();assert.equal(verifiedLiveServicePublication(f.task,f.receipt),true);});
 for(const key of ['rejectsRedirects','localForwardAttempted','upstreamSourceUnchanged','originalCustodyUntouched','bindingsPreserved','nativeSourceExact'])test('ingress correction rejects missing '+key,()=>{const f=transportFixture();f.task.servicePublicationEvidence.final.transportCompatibility[key]=false;assert.equal(verifiedLiveServicePublication(f.task,f.receipt),false);});
 for(const key of ['redirectMode','probeMethod','beforeHttpStatus','afterHttpStatus'])test('ingress correction rejects altered '+key,()=>{const f=transportFixture();f.task.servicePublicationEvidence.final.transportCompatibility[key]='wrong';assert.equal(verifiedLiveServicePublication(f.task,f.receipt),false);});
 test('ingress correction cannot reuse known unsupported bundle',()=>{const f=transportFixture();f.task.servicePublicationEvidence.bundleHashes['cloudflare/worker.mjs']='438bc5721e43c3c179e44f5a18e9a748291b913f28ecd1bc1240d2c164188a40';assert.equal(verifiedLiveServicePublication(f.task,f.receipt),false);});
