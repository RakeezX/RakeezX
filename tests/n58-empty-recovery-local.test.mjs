// AI: meaningful exclusions against preserved actual old-source snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {localFoundationReview,schoolStores,foundationSnapshot} from '../src/lib/calendar-recovery.js';
const old=JSON.parse(fs.readFileSync(new URL('./n58-fresh-account-baseline.json',import.meta.url))).checks[0].snapshot.local;
const fresh=()=>({...structuredClone(old),...Object.fromEntries(schoolStores.map(n=>[n,[]]))});
const owner=old.outbox.find(r=>r.store==='years').ownerId;
test('exact old rejected group is reviewable; visible empty/generic errors are insufficient',()=>{
 assert.equal(localFoundationReview(fresh(),owner).status,'review');
 const generic=fresh();generic.outbox.find(r=>r.lastError?.message==='N58_EXISTING_TERMS_REQUIRED').lastError.message='REJECTED_UNCLASSIFIED';assert.equal(localFoundationReview(generic,owner).status,'blocked');
 assert.equal(localFoundationReview(fresh(),'wrong-owner').status,'blocked');
});
test('school content and tombstones, customized calendar and missing dependency stay blocked without mutation',()=>{
 for(const store of schoolStores){const current=fresh();current[store]=[{id:'retained',deleted:true}];const before=foundationSnapshot(current);assert.equal(localFoundationReview(current,owner).status,'blocked',store);assert.equal(foundationSnapshot(current),before);}
 const custom=fresh();custom.calendarDays[0].label='Teacher custom holiday';assert.equal(localFoundationReview(custom,owner).status,'blocked');
 const changed=fresh();changed.terms[0].startDate='2026-08-31';assert.equal(localFoundationReview(changed,owner).status,'blocked');
 const disconnected=fresh();disconnected.outbox.find(r=>r.store==='terms'&&r.op==='create').dependencies=[];assert.equal(localFoundationReview(disconnected,owner).status,'blocked');
});
test('unrelated diagnostics remain outside the precise reviewed group; historic session intent excludes repair',()=>{
 const unrelated=fresh();unrelated.outbox.push({id:'unrelated',protocol:'v2',ownerId:owner,store:'profile',state:'rejected',lastError:{message:'Retained independent error'}});
 const result=localFoundationReview(unrelated,owner);assert.equal(result.status,'review');assert.ok(!result.review.originals.some(r=>r.id==='unrelated'));
 const historic=fresh();historic.outbox.push({id:'retired-session',protocol:'v2',ownerId:owner,store:'sessions',state:'rejected',dependencies:[{store:'terms',recordId:historic.terms[0].id}]});assert.equal(localFoundationReview(historic,owner).status,'blocked');
});
