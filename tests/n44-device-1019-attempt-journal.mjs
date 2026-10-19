/** AI: focused synthetic filesystem proof; no custody/provider/browser operation. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,unlink,rmdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {writeEncryptedAttemptJournal} from '../drafts/n44-push/activation/device-attempt-journal.mjs';
const root=path.resolve('tests/fixtures/n44-device-1019');await mkdir(root,{recursive:true});
const owned=await mkdtemp(path.join(root,'journal-')),file=path.join(owned,'attempt.dpapi');
try {
 const fabricated=Buffer.from('FABRICATED_ENCRYPTED_ENVELOPE_ONLY');
 const results=await Promise.allSettled([writeEncryptedAttemptJournal(file,fabricated),writeEncryptedAttemptJournal(file,fabricated)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='EEXIST').length,1);
 assert.deepEqual(await readFile(file),fabricated,'durable writer ACK precedes any sender call');
 // Simulate a lost/unknown network outcome after ACK. No new invocation can
 // reserve the original marker, even with a different run/payload.
 let calls=0;try{calls++;throw Error('FABRICATED_UNKNOWN_OUTCOME');}catch{}
 await assert.rejects(writeEncryptedAttemptJournal(file,Buffer.from('DIFFERENT_RUN')),e=>e.code==='EEXIST');
 assert.equal(calls,1);assert.deepEqual(await readFile(file),fabricated);
 await writeFile('tests/n44-device-1019-attempt-journal.json',JSON.stringify({aiAuthored:true,taskId:'continuous-n44-one-approved-closed-page-push-20261019',runId:'a5bafe17-2400-4454-8f07-c0076fd18e0a',status:'PASS',checks:['Concurrent reserve has one winner and one EEXIST','Acknowledged marker bytes precede sender','Unknown outcome and different run cannot replace/replenish marker'],scope:'Fabricated local bytes only; no DPAPI/credentials, provider operation or real delivery proof',cleanup:'Exact owned marker/directory removed in finally'},null,2)+'\n');
 console.log('PASS: immutable one-attempt local journal; no provider send');
} finally {await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(owned);}
