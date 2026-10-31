// AI: public-source identities only. No custody/runtime/file intake or network.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const dir='drafts/n44-push/activation/manual-file-admission-1031/';
const sha=b=>createHash('sha256').update(b).digest('hex'),textHash=b=>sha(b.toString().replace(/\r\n/g,'\n'));
const source='36a3e2e98097038bbb33002b3f8e6967ba86426d',producer='571fc483d711780af666be4926c80ab00eeaba91';
const gateway=execFileSync('git',['show',producer+':src/lib/notification-push-gateway.js']);
if(sha(gateway)!=='992b2b36a63602767bf9eb4ba085a426afd7edad28c693044afc7b832a052099')throw Error('producer_identity');
const inputs={};
for(const p of [dir+'ingestion.mjs',dir+'composition.mjs',dir+'make-manifest.mjs','drafts/n44-push/activation/manual-phone-handoff-1031/host.mjs','tests/n44-manual-file-admission-1031/fixture.mjs','tests/n44-manual-file-admission-1031/admission.test.mjs'])inputs[p]=textHash(await readFile(p));
const manifest={version:1,kind:'inactive-source-only',taskId:'n44-manual-file-admission-source-20261031',runId:'267696b5-a7e2-412a-8289-fd3769b3da9b',baseSha:'3a92ab77731e3a0c8e94f6f43d7cbc9c980015b3',sourceTextNormalization:'git-lf',
 historicalStaticQualifiedSourcePin:source,producer:{sourceSha:producer,path:'src/lib/notification-push-gateway.js',sha256:sha(gateway),observationArgument:false},
 unchangedDependency:{path:'drafts/n44-push/activation/manual-phone-handoff-1031/attestation.mjs',sourceSha:source,sha256:sha(execFileSync('git',['show',source+':drafts/n44-push/activation/manual-phone-handoff-1031/attestation.mjs'])),recordedIntegratedMain:'c11d0569c8a878fbf073a6e5f7aa4089cd8412a3',testResolution:'exact immutable Git bytes; no substitute verifier'},
 inputs,entrypoints:{issuer:'createManualFileIntake.ingest',opener:'createOwnedFileOpener',admission:'createManualHost.admitManualTransfer',composition:'createManualFileCustodyComposition'},
 limits:{bytes:262144,challengeMs:300000,captureMs:60000,pairMs:60000,ingestionRefreshesCapture:false},
 provenance:{kind:'manual-file-ingestion',independentBrowserInspection:false,observedUiExecution:false,verifiedUiPinIsExpectedDeliveryOnly:true},
 qualification:{focusedCases:21,status:'PASS',mode:'fabricated file IO/keys/identities; actual host and immutable helper',previousSource19Reused:true,liveProof:'NOT_RUN'},
 actualTransferChannelReady:false,latencyVerified:false,challengeIssued:false,serviceDeliveryClaim:false,uiDeliveryClaim:false,
 serviceDisposition:{taskId:'n44-manual-phone-readonly-service-20261031',runId:'89099d9f-6254-4f1d-8ce9-cf502dee64b1',state:'BLOCKED',candidateSha:'ca815af83fd4a06605fd67af4529e71b6ac39b30',relationship:'separate disposition; not a dependency of source qualification'},
 operations:{provider:0,privateRuntimeReads:0,credentialReads:0,actualFileIngestions:0,actualPhoneCaptures:0,finiteGrant:0},
 original:{grantId:'efedbcea-f227-4a91-bbab-79cad814fc81',archiveSha256:'c13728f73a049135f337bd2c4856132b317c1413d70ad71a4eeda3600332d12c',disposition:'historical unused disposition preserved; not reread'},privateSourceEdits:false};
await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
const oldPath='drafts/n44-push/activation/manual-phone-handoff-1031/manifest.json',old=JSON.parse(execFileSync('git',['show',source+':'+oldPath]));
old.manualFileAdmissionSupplement={kind:'source-only',manifestPath:dir+'manifest.json',historicalQualifiedSource:source,currentHostSourceSha256:inputs['drafts/n44-push/activation/manual-phone-handoff-1031/host.mjs'],historicalStagedHashesRetained:true,actualTransferChannelReady:false};
await writeFile(oldPath,JSON.stringify(old,null,2)+'\n');
console.log(JSON.stringify({sourceManifest:dir+'manifest.json',focusedCases:21,actualTransferChannelReady:false}));
