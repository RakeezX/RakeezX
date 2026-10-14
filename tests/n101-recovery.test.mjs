import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import * as db from '../src/lib/db.js';
import {createWorkspaceRegistry,accountWorkspaceDatabaseName} from '../src/lib/workspaces.js';
import {resolveWorkspaceForBoot} from '../src/lib/workspace-routing.js';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receipt={protocol:'CORE_V2',restoreId:'restore:B',manifestHash:'hash:B',completedAt:100};
async function fixture(){const factory=new IDBFactory();const registry=createWorkspaceRegistry({indexedDBFactory:factory});await registry.beginAccountRestore(B,{...receipt,phase:'RESTORE_FINALIZING'});await registry.finalizeAccountRestore(B,{...receipt,ownerId:B});return {factory,registry};}
async function alter(factory,change){const d=await new Promise((r,j)=>{const q=factory.open('rakeezx-workspace-registry');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});const tx=d.transaction('workspaces','readwrite');const done=new Promise((r,j)=>{tx.oncomplete=r;tx.onabort=()=>j(tx.error);});const q=tx.objectStore('workspaces').getAll();q.onsuccess=()=>{for(const row of change(q.result))tx.objectStore('workspaces').put(row);};await done;d.close();}
test('missing database recovery requires exact same-owner unambiguous valid receipt and never creates storage',async t=>{
 for(const [name,change,reason] of [
 ['valid',r=>r,'initial-restore-recovery-required'],
 ['invalid receipt',r=>r.map(x=>({...x,restoreReceipt:{...x.restoreReceipt,manifestHash:''}})),'claimed-workspace-database-missing'],
 ['foreign receipt',r=>r.map(x=>({...x,restoreReceipt:{...x.restoreReceipt,ownerId:A}})),'claimed-workspace-database-missing'],
 ['wrong database',r=>r.map(x=>({...x,databaseName:'rakeezx'})),'account-registry-mismatch'],
 ['duplicate',r=>[...r,{...r[0],id:'duplicate:B'}],'ambiguous-account-workspace'],
 ['malformed pending',r=>r.map(x=>({...x,ownershipState:'restoring',workspaceKind:'account-initial-restore',restore:{protocol:'CORE_V2'}})),'account-registry-mismatch'],
 ])await t.test(name,async()=>{const {factory,registry}=await fixture();try{await alter(factory,change);const result=await resolveWorkspaceForBoot({authUser:{id:B},registry,indexedDBFactory:factory});assert.equal(result.reason,reason);assert.equal(result.workspace,null);assert.equal((await factory.databases()).some(x=>x.name.startsWith('rakeezx-user-')),false);}finally{await registry.close();}});
});
test('restore import refuses occupied local storage and cancelled access atomically',async()=>{
 db.closeDB();globalThis.indexedDB=new IDBFactory();db.selectDatabase(await accountWorkspaceDatabaseName(B));
 const device={id:'device',initialRestoreReceipt:{...receipt,ownerId:B}},snapshot={students:[{id:'cloud:B'}]};
 try{await db.put('outbox',{id:'outbox:B',ownerId:B});await assert.rejects(db.importInitialRestoreSnapshot(snapshot,device),{code:'RESTORE_DATABASE_CONFLICT'});assert.deepEqual(await db.getAll('students'),[]);assert.equal((await db.getAll('outbox'))[0].id,'outbox:B');
 db.closeDB();db.selectDatabase(await accountWorkspaceDatabaseName(A));await assert.rejects(db.importInitialRestoreSnapshot(snapshot,device,{assertAccess(){throw Object.assign(Error('cancelled'),{code:'RESTORE_ABORTED'});}}),{code:'RESTORE_ABORTED'});assert.deepEqual(await db.getAll('students'),[]);assert.equal(await db.get('device','device'),undefined);
 }finally{db.closeDB();}
});
