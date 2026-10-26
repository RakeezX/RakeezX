/**
 * INERT Curriculum V2 cloud pull simulation. It is not imported by Product
 * Sync and never contacts a service. Requires an explicitly enabled demo
 * bridge and a synthetic PGlite receipt, not an authentication proof.
 */
import * as defaultDB from './db.js';
import { evaluateSectionCurriculumScope, evaluateTeachingCourseBinding } from './curriculum-context-v2.js';
import { v2ScopeFromCloud, v2BindingFromCloud, reconcileV2Research } from './curriculum-v2-sync-contract.js';

export const CURRICULUM_V2_SYNTHETIC_CLOUD_PROTOCOL = 'CURRICULUM_V2_SYNTHETIC_PGLITE_V1';
const error = code => Object.assign(new Error(code), { code });
const pendingId = (store,id) => 'curriculum-v2-synthetic:' + store + ':' + id;
const sorted = list => [...list].sort((a,b) => a.id.localeCompare(b.id));
const unique = list => list.length === new Set(list.map(r=>r.id)).size;

export function createCurriculumV2SyntheticCloudApplier({
  database=defaultDB, bridge, currentOwner,
}={}) {
  const guard = ownerId => {
    if(database.getActiveDatabaseName()!=='rakeezx-demo' ||
       typeof currentOwner!=='function' || currentOwner()!==ownerId ||
       !bridge?.snapshot) throw error('CURRICULUM_V2_SYNTHETIC_ONLY');
  };
  async function applyFullSnapshot(ownerId, rows, receipt) {
    guard(ownerId);
    if(receipt?.protocol!==CURRICULUM_V2_SYNTHETIC_CLOUD_PROTOCOL ||
       receipt?.ownerId!==ownerId || receipt?.verified!==true ||
       receipt?.fullSnapshot!==true ||
       !Array.isArray(rows?.scopes)||!Array.isArray(rows?.bindings))
      throw error('CURRICULUM_V2_UNVERIFIED_SIMULATION_RECEIPT');
    if(!unique(rows.scopes)||!unique(rows.bindings) ||
       rows.scopes.length>300||rows.bindings.length>1000)
      throw error('CURRICULUM_V2_INVALID_REMOTE_MANIFEST');
    // Also verifies bridge's synthetic-only flag, before DB changes.
    await bridge.snapshot(ownerId);
    const scopes=rows.scopes.map(row=>({
      ...v2ScopeFromCloud(row,ownerId),serverRevision:Number(row.server_revision),
    }));
    const bindings=rows.bindings.map(row=>({
      ...v2BindingFromCloud(row,ownerId),serverRevision:Number(row.server_revision),
    }));
    if([...scopes,...bindings].some(row=>
       !Number.isSafeInteger(row.serverRevision)||row.serverRevision<1))
      throw error('CURRICULUM_V2_REMOTE_REVISION_INVALID');
    const result={ scopes:0, bindings:0, acknowledgements:0, localPending:0 };
    await database.applyBatch({
      sectionCurriculumScopes:{},teachingCourseBindings:{},
      years:{},sections:{},teachings:{},subjects:{},terms:{},outbox:{},
    },{productWrite:true,prepare(current){
      guard(ownerId);
      const original=new Map([
        ...current.sectionCurriculumScopes.map(r=>[pendingId('sectionCurriculumScopes',r.id),r]),
        ...current.teachingCourseBindings.map(r=>[pendingId('teachingCourseBindings',r.id),r]),
      ]);
      const outbox=new Map(current.outbox.filter(r=>r.protocol==='curriculum-v2-synthetic')
        .map(r=>[r.id,r]));
      const removals=[],puts={ sectionCurriculumScopes:[],teachingCourseBindings:[] };
      function choose(store,remote,kind) {
        const id=pendingId(store,remote.id);
        const local=original.get(id),pending=outbox.get(id);
        const exactEcho=!!pending&&pending.updatedAt===remote.updatedAt&&
          pending.op===(remote.deleted?'delete':'upsert');
        let chosen=remote,status='remote_new';
        if(local&&Number.isSafeInteger(local.serverRevision)) {
          if(remote.serverRevision<local.serverRevision)
            throw error('CURRICULUM_V2_REMOTE_REVISION_REGRESSION');
          if(pending&&remote.serverRevision>local.serverRevision&&!exactEcho)
            throw error('CURRICULUM_V2_UNACKNOWLEDGED_LOCAL_CONFLICT');
          if(!pending&&remote.serverRevision>local.serverRevision&&
             remote.updatedAt<=local.updatedAt)
            throw error('CURRICULUM_V2_REMOTE_REVISION_TIME_CONFLICT');
          if(!pending&&remote.serverRevision===local.serverRevision&&
             remote.updatedAt!==local.updatedAt)
            throw error('CURRICULUM_V2_REMOTE_SAME_REVISION_CONFLICT');
        }
        if(local) {
          const decision=reconcileV2Research(local,remote,{kind,expectedOwner:ownerId});
          if(decision.status==='conflict')
            throw error('CURRICULUM_V2_REMOTE_CONFLICT:'+decision.reason);
          chosen=decision.accepted;status=decision.status;
          if(pending&&chosen!==local&&status!=='equal')
            throw error('CURRICULUM_V2_UNACKNOWLEDGED_LOCAL_CONFLICT');
        }
        if(pending&&pending.updatedAt===remote.updatedAt&&
           (status==='equal'||chosen===remote)&&
           pending.op===(remote.deleted?'delete':'upsert')) removals.push(id);
        const saved=(chosen!==local||status==='equal')
          ? {...chosen,syncStatus:'synthetic_cloud_confirmed',
             serverRevision:remote.serverRevision} : local;
        if(saved!==local) puts[store].push(saved);
        return saved;
      }
      const scopeMap=new Map(current.sectionCurriculumScopes.map(r=>[r.id,r]));
      for(const remote of sorted(scopes)) {
        const section=current.sections.find(r=>r.id===remote.sectionId&&!r.deleted);
        const year=current.years.find(r=>r.id===remote.yearId&&!r.deleted);
        if(!section||!year||section.yearId!==year.id||
           [section,year].some(r=>r.ownerId&&r.ownerId!==ownerId))
          throw error('CURRICULUM_V2_REMOTE_SECTION_MISMATCH');
        const validated=evaluateSectionCurriculumScope({
          ownerId,sectionId:remote.sectionId,yearId:remote.yearId,
          program:remote.program,stage:remote.stage,level:remote.level,
          track:remote.track,legacyGrade:Number(section.grade),
        });
        if(validated.state!=='draft'||validated.identity!==remote.id||
           validated.scopeKey!==remote.scopeKey||validated.edition!==remote.edition||
           validated.dataSource!==remote.sourceUrl)
          throw error('CURRICULUM_V2_REMOTE_SCOPE_MISMATCH');
        const chosen=choose('sectionCurriculumScopes',{
          ...remote,legacyGrade:Number(section.grade),
        },'scope');
        scopeMap.set(chosen.id,chosen);result.scopes++;
      }
      const bindingMap=new Map(current.teachingCourseBindings.map(r=>[r.id,r]));
      for(const remote of sorted(bindings)) {
        const scope=scopeMap.get(remote.sectionScopeIdentity);
        const teaching=current.teachings.find(r=>r.id===remote.teachingId&&!r.deleted);
        const subject=current.subjects.find(r=>r.id===remote.subjectId&&!r.deleted);
        const term=current.terms.find(r=>r.id===remote.termId&&!r.deleted);
        if(!scope||!teaching||!subject||!term||scope.ownerId!==ownerId||
           [teaching,subject,term].some(r=>r.ownerId&&r.ownerId!==ownerId)||
           scope.sectionId!==remote.sectionId||(scope.deleted&&!remote.deleted)||
           teaching.sectionId!==remote.sectionId||teaching.subjectId!==remote.subjectId||
           teaching.termId!==remote.termId||term.yearId!==scope.yearId)
          throw error('CURRICULUM_V2_REMOTE_BINDING_PARENT_MISMATCH');
        const checked=evaluateTeachingCourseBinding({
          ownerId,sectionScope:{...scope,state:'draft'},
          sectionId:remote.sectionId,teachingId:remote.teachingId,
          subjectId:remote.subjectId,termId:remote.termId,
          name:remote.name,kind:remote.kind,sourcePage:remote.sourcePage,
        });
        if(checked.state!=='draft'||checked.identity!==remote.id||
           checked.courseKey!==remote.courseKey||checked.edition!==remote.edition||
           checked.sourceUrl!==remote.sourceUrl)
          throw error('CURRICULUM_V2_REMOTE_COURSE_MISMATCH');
        const chosen=choose('teachingCourseBindings',remote,'binding');
        bindingMap.set(chosen.id,chosen);result.bindings++;
      }
      for(const [name,list,key] of [
        ['sectionCurriculumScopes',[...scopeMap.values()],r=>r.sectionId],
        ['teachingCourseBindings',[...bindingMap.values()],r=>r.teachingId],
      ]) {
        const alive=list.filter(r=>!r.deleted);
        if(new Set(alive.map(key)).size!==alive.length)
          throw error('CURRICULUM_V2_REMOTE_ACTIVE_DUPLICATE:'+name);
      }
      for(const binding of bindingMap.values())
        if(!binding.deleted&&scopeMap.get(binding.sectionScopeIdentity)?.deleted)
          throw error('CURRICULUM_V2_REMOTE_ORPHAN_BINDING');
      result.acknowledgements=removals.length;
      result.localPending=outbox.size-removals.length;
      return {
        sectionCurriculumScopes:{put:puts.sectionCurriculumScopes},
        teachingCourseBindings:{put:puts.teachingCourseBindings},
        outbox:{remove:removals},
      };
    }});
    guard(ownerId);
    return {...result,cloudActivated:false,receiptSource:'synthetic-pglite'};
  }
  return Object.freeze({applyFullSnapshot});
}
