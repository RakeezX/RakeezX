/** AI: local publication artifact integration only after actual successor receipt. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {taskId,custodianSession,priorSource,successorSource,hash} from './transition-guards.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
export async function integrateVerifiedSuccessor(run){
 if(!/^[a-f0-9-]{36}$/.test(run??''))throw Error('n88_denied_integration_run');
 const receiptPath='tests/n88-denied-read-activation-20261023/activate-version-bound-'+run+'.json',receipt=await json(receiptPath);
 assert.equal(receipt.status,'PASS');assert.equal(receipt.taskId,taskId);assert.equal(receipt.runId,run);assert.equal(receipt.sessionId,custodianSession);assert.equal(receipt.nativeUploads,1);assert.equal(receipt.pinUpdates,1);assert.equal(receipt.provider.source,successorSource);assert(receipt.provider.version>66);assert.equal(receipt.provider.downloadedBytesExact,true);assert.equal(receipt.provider.importMapExact,true);assert.equal(receipt.provider.pinDigest,hash(successorSource));assert.equal(receipt.oldHistoriesPreserved,true);assert.equal(receipt.migrations,0);assert.equal(receipt.carrierUploads,0);
 const dir='drafts/n88-student-portal/activation/',manifest=await json(dir+'manifest.json'),qualified=await json(dir+'denied-read-20261023/manifest.json');
 const native=(await readFile(dir+'denied-read-20261023/native66-successor.inactive.mjs','utf8')).replaceAll('\r\n','\n');assert.equal(hash(native),successorSource);
 const bundle=dir+'bundle/edge/index.mjs';assert.equal(hash((await readFile(bundle,'utf8')).replaceAll('\r\n','\n')),priorSource);
 const source='drafts/n88-student-portal/integrated-service.mjs';assert.equal(hash((await readFile(source,'utf8')).replaceAll('\r\n','\n')),qualified.integratedSourceSha256);
 manifest.outputs['edge/index.mjs']=successorSource;if(source in manifest.sources)manifest.sources[source]=qualified.integratedSourceSha256;
 manifest.deniedReadSuccessor20261023={taskId,runId:run,source:successorSource,priorSource,nativeVersion:receipt.provider.version,receipt:receiptPath,actualUserAcceptance:'NOT_RUN',productAcceptance:'OPEN',nativeUploads:1,pinUpdates:1,newMigrations:0,carrierUploads:0};
 await writeFile(bundle,native);await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
 return {status:'PASS',receipt:receiptPath,nativeSha256:successorSource,sourceSha256:qualified.integratedSourceSha256,providerOperations:0,actualUserAcceptance:'NOT_RUN'};
}
