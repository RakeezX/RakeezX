/**
 * ONLY a separate IndexedDB research harness. Not imported by Product.
 * Requires explicit fake/test indexedDB and "rakeez-v2-research-*" database.
 * Demonstrates offline persistence/reload while the real owner/Sync/Lease
 * path remains untouched. Browser IndexedDB alone is NOT an auth boundary.
 */
import {
  evaluateSectionCurriculumScope,
  evaluateTeachingCourseBinding
} from '../../../../src/lib/curriculum-context-v2.js';
import {reconcileV2Research} from '../../../../src/lib/curriculum-v2-sync-contract.js';

export function openCurriculumV2ResearchStore({
  databaseName, indexedDB, currentOwner, clock=()=>Date.now(),
}={}){
  if(!/^rakeez-v2-research-[a-z0-9-]{4,120}$/i.test(databaseName||''))throw Error('RESEARCH_DB_ONLY');
  if(!indexedDB?.open||typeof currentOwner!=='function')throw Error('EXPLICIT_TEST_DB_AND_OWNER_REQUIRED');
  let dbPromise;
  const assertOwner=owner=>{
    if(!owner||currentOwner()!==owner)throw Error('OWNER_CONTEXT_CHANGED');
  };
  const req=(request)=>new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  const open=()=>dbPromise??=new Promise((resolve,reject)=>{
    const r=indexedDB.open(databaseName,1);
    r.onupgradeneeded=()=>{
      const db=r.result;
      const scopes=db.createObjectStore('sectionCurriculumScopes',{keyPath:'id'});
      scopes.createIndex('ownerSection',['ownerId','sectionId'],{unique:false});
      const bindings=db.createObjectStore('teachingCourseBindings',{keyPath:'id'});
      bindings.createIndex('ownerTeaching',['ownerId','teachingId'],{unique:false});
    };
    r.onerror=()=>reject(r.error);
    r.onsuccess=()=>resolve(r.result);
  });
  const transaction=async(stores,mode,op)=>{
    const db=await open();
    const tx=db.transaction(stores,mode);
    const complete=new Promise((resolve,reject)=>{
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error||Error('TX_ABORTED'));
      tx.onerror=()=>reject(tx.error||Error('TX_FAILED'));
    });
    let output;
    try{ output=await op(tx); }
    catch(error){try{tx.abort()}catch{}await complete.catch(()=>{});throw error}
    await complete;
    return output;
  };
  const all=async(name,owner)=>{
    assertOwner(owner);
    const list=await transaction([name],'readonly',async tx=>req(tx.objectStore(name).getAll()));
    assertOwner(owner);
    return list.filter(x=>x.ownerId===owner);
  };
  async function putScope(draft){
    if(draft?.state!=='draft'||draft?.writeAllowed!==false||!draft.identity||
      !draft.sectionId||!draft.scopeKey)throw Error('INVALID_V2_DRAFT');
    const owner=draft.ownerId;assertOwner(owner);
    return transaction(['sectionCurriculumScopes'],'readwrite',async tx=>{
      const store=tx.objectStore('sectionCurriculumScopes');
      const rows=await req(store.index('ownerSection').getAll([owner,draft.sectionId]));
      assertOwner(owner);
      if(rows.some(r=>!r.deleted&&r.id!==draft.identity))throw Error('ACTIVE_SECTION_SCOPE_CONFLICT');
      const existing=await req(store.get(draft.identity));
      assertOwner(owner);
      if(existing?.deleted)throw Error('TOMBSTONE_MUST_NOT_RESURRECT');
      if(existing&&existing.scopeKey!==draft.scopeKey)throw Error('SECTION_SCOPE_MUTATION_REQUIRES_REVIEW');
      const next={id:draft.identity,ownerId:owner,sectionId:draft.sectionId,
        yearId:draft.yearId,scopeKey:draft.scopeKey,program:draft.program,stage:draft.stage,
        level:draft.level,track:draft.track,edition:draft.edition,legacyGrade:draft.legacyGrade,
        deleted:false,updatedAt:clock(),sourceStatus:'edition_not_validated',
        syncStatus:'research_local_only'};
      await req(store.put(next));assertOwner(owner);
      return next;
    });
  }
  async function putBinding(draft){
    if(draft?.state!=='draft'||draft?.writeAllowed!==false||!draft.identity||
      !draft.sectionScopeIdentity||!draft.teachingId)throw Error('INVALID_V2_BINDING_DRAFT');
    const owner=draft.ownerId;assertOwner(owner);
    return transaction(['sectionCurriculumScopes','teachingCourseBindings'],'readwrite',async tx=>{
      const scopes=tx.objectStore('sectionCurriculumScopes');
      const bindings=tx.objectStore('teachingCourseBindings');
      const parent=await req(scopes.get(draft.sectionScopeIdentity));
      assertOwner(owner);
      if(!parent||parent.deleted||parent.ownerId!==owner||parent.sectionId!==draft.sectionId)
        throw Error('PARENT_OWNER_SECTION_SCOPE_MISMATCH');
      const existing=await req(bindings.get(draft.identity));
      const siblings=await req(bindings.index('ownerTeaching').getAll([owner,draft.teachingId]));
      assertOwner(owner);
      if(siblings.some(b=>!b.deleted&&b.id!==draft.identity))throw Error('ACTIVE_TEACHING_COURSE_CONFLICT');
      if(existing?.deleted)throw Error('TOMBSTONE_MUST_NOT_RESURRECT');
      if(existing&&(existing.courseKey!==draft.courseKey||existing.sectionScopeIdentity!==draft.sectionScopeIdentity))
        throw Error('COURSE_BINDING_CHANGE_REQUIRES_REVIEW');
      const next={id:draft.identity,ownerId:owner,sectionId:draft.sectionId,
        sectionScopeIdentity:draft.sectionScopeIdentity,teachingId:draft.teachingId,
        termId:draft.termId,subjectId:draft.subjectId,courseKey:draft.courseKey,
        name:draft.courseName,kind:draft.kind??'course',sourceUrl:draft.sourceUrl,edition:draft.edition,
        deleted:false,updatedAt:clock(),syncStatus:'research_local_only'};
      await req(bindings.put(next));assertOwner(owner);
      return next;
    });
  }
  async function retireBinding(owner,id){
    assertOwner(owner);
    return transaction(['teachingCourseBindings'],'readwrite',async tx=>{
      const store=tx.objectStore('teachingCourseBindings'),r=await req(store.get(id));
      assertOwner(owner);
      if(!r||r.ownerId!==owner)throw Error('FOREIGN_OR_MISSING_BINDING');
      const next={...r,deleted:true,updatedAt:clock()};
      await req(store.put(next));assertOwner(owner);return next;
    });
  }
  async function retireScope(owner,id){
    assertOwner(owner);
    return transaction(['sectionCurriculumScopes','teachingCourseBindings'],'readwrite',async tx=>{
      const scopes=tx.objectStore('sectionCurriculumScopes'),bindings=tx.objectStore('teachingCourseBindings');
      const r=await req(scopes.get(id));const allBindings=await req(bindings.getAll());
      assertOwner(owner);
      if(!r||r.ownerId!==owner)throw Error('FOREIGN_OR_MISSING_SCOPE');
      if(allBindings.some(b=>b.ownerId===owner&&!b.deleted&&b.sectionScopeIdentity===id))
        throw Error('ACTIVE_BINDINGS_PREVENT_SCOPE_RETIREMENT');
      const next={...r,deleted:true,updatedAt:clock()};
      await req(scopes.put(next));assertOwner(owner);return next;
    });
  }
  /** A synthetic remote-decoded row, NOT an authenticated cloud response. */
  async function importRemoteScope(snapshot){
    const owner=snapshot?.ownerId;assertOwner(owner);
    if(snapshot.syncStatus!=='research_adapter_only')throw Error('UNVERIFIED_RESEARCH_ENVELOPE');
    const verified=evaluateSectionCurriculumScope({
      ownerId:owner,sectionId:snapshot.sectionId,yearId:snapshot.yearId,
      program:snapshot.program,stage:snapshot.stage,level:snapshot.level,
      track:snapshot.track,legacyGrade:null
    });
    if(verified.state!=='draft'||verified.identity!==snapshot.id||
       verified.scopeKey!==snapshot.scopeKey||snapshot.edition!==verified.edition)
      throw Error('INVALID_SOURCE_SCOPE_IDENTITY');
    return transaction(['sectionCurriculumScopes','teachingCourseBindings'],'readwrite',async tx=>{
      const scopes=tx.objectStore('sectionCurriculumScopes');
      const siblings=await req(scopes.index('ownerSection').getAll([owner,snapshot.sectionId]));
      const existing=await req(scopes.get(snapshot.id));
      const courseRows=await req(tx.objectStore('teachingCourseBindings').getAll());
      assertOwner(owner);
      if(siblings.some(r=>!r.deleted&&r.id!==snapshot.id))throw Error('ACTIVE_SECTION_SCOPE_CONFLICT');
      let next=snapshot;
      if(existing){
        const decision=reconcileV2Research(existing,snapshot,{kind:'scope',expectedOwner:owner});
        if(decision.status==='conflict')throw Error('RECONCILIATION_REQUIRED:'+decision.reason);
        if(decision.accepted===existing)return existing;
        next=decision.accepted;
      }
      if(next.deleted&&courseRows.some(b=>!b.deleted&&b.ownerId===owner&&b.sectionScopeIdentity===next.id))
        throw Error('ACTIVE_BINDINGS_PREVENT_SCOPE_RETIREMENT');
      const record={...next,legacyGrade:existing?.legacyGrade??null,syncStatus:'research_cloud_confirmed'};
      await req(scopes.put(record));assertOwner(owner);return record;
    });
  }
  async function importRemoteBinding(snapshot){
    const owner=snapshot?.ownerId;assertOwner(owner);
    if(snapshot.syncStatus!=='research_adapter_only')throw Error('UNVERIFIED_RESEARCH_ENVELOPE');
    return transaction(['sectionCurriculumScopes','teachingCourseBindings'],'readwrite',async tx=>{
      const scopes=tx.objectStore('sectionCurriculumScopes');
      const bindingStore=tx.objectStore('teachingCourseBindings');
      const parent=await req(scopes.get(snapshot.sectionScopeIdentity));
      assertOwner(owner);
      if(!parent||parent.ownerId!==owner||parent.sectionId!==snapshot.sectionId||
        (parent.deleted&&!snapshot.deleted))throw Error('PARENT_OWNER_SECTION_SCOPE_MISMATCH');
      const draft=evaluateTeachingCourseBinding({
        ownerId:owner,sectionScope:{...parent,state:'draft'},
        sectionId:snapshot.sectionId,teachingId:snapshot.teachingId,
        termId:snapshot.termId,subjectId:snapshot.subjectId,
        name:snapshot.name,kind:snapshot.kind??'course',
        sourcePage:snapshot.sourcePage
      });
      if(draft.state!=='draft'||draft.identity!==snapshot.id||
         draft.courseKey!==snapshot.courseKey)throw Error('INVALID_SOURCE_COURSE_IDENTITY');
      const existing=await req(bindingStore.get(snapshot.id));
      const siblings=await req(bindingStore.index('ownerTeaching').getAll([owner,snapshot.teachingId]));
      assertOwner(owner);
      if(siblings.some(b=>!b.deleted&&b.id!==snapshot.id))throw Error('ACTIVE_TEACHING_COURSE_CONFLICT');
      let next=snapshot;
      if(existing){
        const decision=reconcileV2Research(existing,snapshot,{kind:'binding',expectedOwner:owner});
        if(decision.status==='conflict')throw Error('RECONCILIATION_REQUIRED:'+decision.reason);
        if(decision.accepted===existing)return existing;
        next=decision.accepted;
      }
      const record={...next,syncStatus:'research_cloud_confirmed'};
      await req(bindingStore.put(record));assertOwner(owner);return record;
    });
  }
  return Object.freeze({
    putScope,putBinding,retireBinding,retireScope,importRemoteScope,importRemoteBinding,
    scopes:owner=>all('sectionCurriculumScopes',owner),
    bindings:owner=>all('teachingCourseBindings',owner),
    close:async()=>{if(dbPromise){(await dbPromise).close();dbPromise=null;}},
    databaseName,
  });
}
