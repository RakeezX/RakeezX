import test from 'node:test';
import assert from 'node:assert/strict';
const source = process.env.RAKEEZ_REVIEW_HELPERS
  ? new URL('file:///' + process.env.RAKEEZ_REVIEW_HELPERS.replaceAll('\\','/'))
  : new URL('./controller.mjs',import.meta.url);
const {observeUnchangedParity,isHistoricalBlockedReceipt,summarizeQueueHealth}=await import(source);
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
test('exact N88 failed static asset is historical only with separately verified successor release', () => {
  const original = {
    id:'continuous-n88-public-preview-reachability-20261016',status:'blocked',productId:'N88',
    updatedAt:'2026-10-16T21:13:00.150Z',lastFailure:'SOURCE_PARITY_PENDING: Provider succeeded but exact served-source verification has not passed',
    deliveryReceipt:{status:'blocked',publishedSha:'a'.repeat(40)}
  };
  const successor = {
    id:'continuous-n88-guest-hash-entry-20261017',status:'awaiting_po',productId:'N88',
    baseSha:'a'.repeat(40),deliveryReceipt:{
      status:'deployed',publishedSha:'b'.repeat(40),verifiedAt:'2026-10-16T21:15:44.310Z',
      provider:{headSha:'b'.repeat(40),conclusion:'success'},
      evidence:{immutable:{passed:true},production:{passed:true}},
      changedAssets:['index.html','src/views/n88-public-guest.js']
    }
  };
  assert.equal(isHistoricalBlockedReceipt(original,['N88'],[original]),false);
  assert.equal(isHistoricalBlockedReceipt(original,['N88'],[original,successor]),true);
  assert.equal(isHistoricalBlockedReceipt(original,['N88'],[original,{...successor,baseSha:'f'.repeat(40)}]),false);
  assert.equal(isHistoricalBlockedReceipt(original,['N88'],[original,{...successor,deliveryReceipt:{...successor.deliveryReceipt,evidence:{immutable:{passed:false},production:{passed:true}}}}]),false);
  assert.equal(isHistoricalBlockedReceipt({...original,productId:'N36'},['N36','N88'],[original,successor]),false);
});
test('work portfolio counts unique genuinely unresolved products without misreporting old attempts', () => {
  const tasks=[
    {id:'x1',status:'blocked',productId:'N36',lastFailure:'missing real teacher authorization'},
    {id:'x2',status:'blocked',productId:'N36',lastFailure:'SOURCE_PARITY_PENDING: old asset discrepancy'},
    {id:'x3',status:'blocked',productId:'N64',lastFailure:'auth service outside provider access'},
    {id:'x4',status:'blocked',productId:'N58',lastFailure:'retired fixture'},
    {id:'x5',status:'blocked',productId:'N36',lastFailure:'SUPERSEDED_BY_VERIFIED_DELIVERY: current release'},
    {id:'x6',status:'awaiting_po',productId:'N104',createdAt:'2026-10-16T21:00:00Z',
      deliveryReceipt:{status:'deployed',publishedSha:'b'.repeat(40),verifiedAt:'2026-10-16T21:30:00Z',
        provider:{headSha:'b'.repeat(40),conclusion:'success'},
        evidence:{immutable:{passed:true},production:{passed:true}}}}
  ];
  const info=summarizeQueueHealth(tasks,['N36','N64','N104'],'2026-10-16T21:31:00Z');
  assert.equal(info.blockedAttempts,5);
  assert.equal(info.historicalBlockedAttempts,2);
  assert.equal(info.actionableBlockedAttempts,3);
  assert.equal(info.actionableBlockedProductCount,2);
  assert.deepEqual(info.actionableBlockedByProduct,[{productId:'N36',attempts:2},{productId:'N64',attempts:1}]);
  assert.equal(info.verifiedPublicationReceipts,1);
  assert.equal(info.verifiedPublishedProductCount,1);
  assert.equal(info.medianMinutesFromCardToVerifiedPublication,30);
});
