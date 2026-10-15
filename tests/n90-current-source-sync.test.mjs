import 'fake-indexeddb/auto';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import {createSyncV2Engine} from '../src/lib/sync-v2.js';
import {createSyncOwnershipGuard} from '../src/lib/sync-ownership.js';
import {REPAIR_PROTOCOL} from '../src/lib/session-recovery.js';
const OWNER='a9000000-0000-4000-8000-000000000001';
const history=()=>({id:'audit',protocol:REPAIR_PROTOCOL,ownerId:OWNER,state:'verified',original:{ownerId:OWNER,state:'rejected',recordId:'session'},replacementMutationId:'replacement',receipt:{mutationId:'replacement',outcome:'applied',canonical:{id:'session',owner_id:OWNER}}});
const make=()=>createSyncV2Engine({database:db,ownershipGuard:createSyncOwnershipGuard({workspace:{id:'account:current',type:'account',authUserId:OWNER,ownershipState:'claimed',syncEligible:true,databaseName:'current-local-only'}}),currentAuthenticatedUserId:()=>OWNER});
after(()=>db.closeDB());
test('N90 admits only receipt-bound completed same-owner N101 history, preserving it; every dirty or malformed audit blocks',async()=>{
 for(const change of [null,r=>r.state='pending',r=>r.ownerId='foreign',r=>delete r.receipt,r=>r.receipt.canonical.owner_id='foreign',r=>r.receipt.mutationId='other',r=>r.original.state='pending',r=>r.protocol='unknown']){
  await db.clearAll();const row=history();if(change)change(row);await db.put('outbox',row);const before=await db.getAll('outbox'),engine=make();
  const command=()=>engine.queueCommand({store:'items',recordId:'t',command:'score:grade_import',patch:{batch:{cells:[]}}});
  if(change){await assert.rejects(command);assert.deepEqual(await db.getAll('outbox'),before);}
  else {const queued=await command();assert.equal(queued.ownerId,OWNER);assert.deepEqual(await db.get('outbox','audit'),row);}
 }
});
test('N90 rechecks outstanding work during dispatch even after valid audit admission',async()=>{
 await db.clearAll();const audit=history();await db.put('outbox',audit);let calls=0;
 const engine=createSyncV2Engine({database:db,ownershipGuard:createSyncOwnershipGuard({workspace:{id:'account:current',type:'account',authUserId:OWNER,ownershipState:'claimed',syncEligible:true,databaseName:'current-local-only'}}),currentAuthenticatedUserId:()=>OWNER,transport:{applyReviewedGradeImport:async()=>{calls++;throw Error('must not send');}}});
 const queued=await engine.queueCommand({store:'items',recordId:'t',command:'score:grade_import',patch:{batch:{cells:[]}}});await db.put('outbox',{id:'dirty',protocol:'v2',ownerId:OWNER,state:'pending'});
 assert.equal((await engine.dispatchPending({onlyMutationId:queued.mutationId})).attempted,0);assert.equal(calls,0);assert.deepEqual(await db.get('outbox','audit'),audit);
});
