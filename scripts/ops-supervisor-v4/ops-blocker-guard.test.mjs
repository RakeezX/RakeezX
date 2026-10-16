import test from 'node:test';
import assert from 'node:assert/strict';
const source = process.env.RAKEEZ_REVIEW_HELPERS
  ? new URL('file:///' + process.env.RAKEEZ_REVIEW_HELPERS.replaceAll('\\','/'))
  : new URL('./controller.mjs',import.meta.url);
const {observeUnchangedParity,isHistoricalBlockedReceipt}=await import(source);
const sh='a'.repeat(64),published='b'.repeat(40);
const asset=(path,status=404)=>({repoPath:path,statusCode:status,expectedSha256:sh,verified:false,observedSha256:'c'.repeat(64)});
const receipt={
  status:'pending',errorCode:'SOURCE_PARITY_PENDING',publishedSha:published,
  provider:{conclusion:'success',headSha:published},
  evidence:{
    immutable:{passed:false,assets:[asset('public/n88-invite-preview.html')]},
    production:{passed:false,assets:[asset('public/n88-invite-preview.html')]}
  }
};
test('immutable and Production 404 parity failures park only after stable repeated evidence and one minute',()=>{
  const task={candidateSha:'d'.repeat(40)};
  assert.equal(observeUnchangedParity(task,structuredClone(receipt),'2026-10-16T21:00:00Z'),false);
  assert.equal(observeUnchangedParity(task,structuredClone(receipt),'2026-10-16T21:00:59Z'),false);
  assert.equal(observeUnchangedParity(task,structuredClone(receipt),'2026-10-16T21:01:01Z'),true);
  assert.equal(task.parityWait.count,3);
});
test('changed failure resets and provider pending never parks',()=>{
 const task={candidateSha:'d'.repeat(40)};
 assert.equal(observeUnchangedParity(task,structuredClone(receipt),'2026-10-16T21:00:00Z'),false);
 const changed=structuredClone(receipt);changed.evidence.immutable.assets[0].statusCode=200;
 assert.equal(observeUnchangedParity(task,changed,'2026-10-16T21:05:00Z'),false);
 assert.equal(task.parityWait.count,1);
 const pending=structuredClone(receipt);pending.provider.conclusion='pending';
 assert.equal(observeUnchangedParity(task,pending,'2026-10-16T21:10:00Z'),false);
});
test('existing immutable PASS / Production FAIL path still correctly handled',()=>{
 const task={candidateSha:'d'.repeat(40)};
 const old=structuredClone(receipt);old.evidence.immutable={passed:true,assets:[{...asset('index.html',200),verified:true}]};
 assert.equal(observeUnchangedParity(task,old,'2026-10-16T21:00:00Z'),false);
 assert.equal(observeUnchangedParity(task,old,'2026-10-16T21:01:05Z'),true);
});
test('historical blocked receipts separate from actionable current blockers',()=>{
 assert.equal(isHistoricalBlockedReceipt({status:'blocked',productId:'N58',lastFailure:'historical fixture'},['N36','N64']),true);
 assert.equal(isHistoricalBlockedReceipt({status:'blocked',productId:'N36',lastFailure:'SUPERSEDED_BY_VERIFIED_DELIVERY: already deployed'},['N36']),true);
 assert.equal(isHistoricalBlockedReceipt({status:'blocked',productId:'N36',lastFailure:'portal access still unverified'},['N36']),false);
 assert.equal(isHistoricalBlockedReceipt({status:'awaiting_po',productId:'N58'},['N36']),false);
});