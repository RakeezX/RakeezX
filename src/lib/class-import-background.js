// AI N107: owner-device plans, one Web Lock runner, existing canonical commands only.
import * as store from '../store.js';
import * as db from './db.js';
import * as cloud from './cloud.js';
import * as sync from './sync.js';
import {createSyncV2Engine,blocksGradeImport} from './sync-v2.js';
import {runtimeSyncOwnershipGuard} from './sync-ownership.js';
import {defaultItemsFor} from '../models.js';
import {gradeNameKey,isTransferItem} from './grade-transfer.js';

export const academicImportBinding=row=>JSON.stringify(row,(key,value)=>['serverRevision','syncCreatePending','ownerId','updatedAt','canonicalId','serverCanonical','fieldRevisions','syncConflicts'].includes(key)?undefined:value);
const itemSemantics=items=>JSON.stringify(items.map(i=>[i.name,i.max,i.auto??null,i.scoreMode??'direct',!!i.deleted]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const semantics=r=>JSON.stringify({entries:r.entries.map(({row,student,item,max,old,original,value})=>({row,student,item,max,old,original,value})),items:r.newItems,overwrites:r.overwrites,rejected:r.rejected});
const reviewChanged=()=>Object.assign(Error('Import plan needs review'),{code:'IMPORT_PLAN_REVIEW'});
export function localImportPlans(){
 const w=store.getActiveWorkspace();if(w?.type!=='account'||cloud.user?.id!==w.authUserId)return [];
 return Object.values(store.state.device?.classFileImportPlans??{}).filter(p=>p.ownerId===w.authUserId&&p.databaseName===w.databaseName);
}
export async function persistLocalImport({input,proposal,created,classReview=null,overwriteConfirmed=false},verifyCurrent){
 const w=store.assertClassImportAccess();
 // Only consumed columns are retained. Filenames and ignored file metadata never enter the plan.
 const columns=[input.nameColumn,...input.mappings.map((m,i)=>i).filter(i=>i!==input.nameColumn&&input.mappings[i].kind!=='ignore')];
 const mapped={rows:input.rows.map(row=>columns.map(i=>row[i]??'')),nameColumn:0,idColumn:-1,mappings:columns.map((i,n)=>n===0?{kind:'ignore'}:structuredClone(input.mappings[i])),studentChoices:{},newStudentIds:{}};
 if(created.existing&&proposal){const roster=store.teachingContext(created.teachingId).roster,column=mapped.rows[0].length;mapped.idColumn=column;mapped.rows=mapped.rows.map((r,i)=>{if(!i)return [...r,'saved-id'];const entry=proposal.entries.find(e=>e.row===i+1),exact=roster.find(s=>s.id===entry?.studentId),matches=roster.filter(s=>gradeNameKey(s.name)===gradeNameKey(entry?.student??r[0]));return [...r,exact?.id??(matches.length===1?matches[0].id:'')];});mapped.mappings.push({kind:'ignore'});}
 const plan={id:crypto.randomUUID(),version:1,state:'local_ready',ownerId:w.authUserId,databaseName:w.databaseName,yearId:store.activeYear().id,termId:store.activeTerm().id,year:academicImportBinding(store.activeYear()),term:academicImportBinding(store.activeTerm()),created:structuredClone(created),classReview:classReview?structuredClone(classReview):null,input:mapped,proposal:proposal?structuredClone(proposal):null,createdItems:itemSemantics(store.teachingContext(created.teachingId).items),overwriteConfirmed:overwriteConfirmed===true};
 await store.saveLocalImportPlan(plan,{verifyCurrent});installImportBackground();requestImportBackground();return plan.id;
}
function context(){const w=store.assertClassImportAccess(),session=cloud.session;const fence=cloud.captureOwnedMutationContext();return ()=>{fence();store.assertLeaseWritable();if(store.assertClassImportAccess()!==w||cloud.session!==session||db.getActiveDatabaseName()!==w.databaseName)throw Error('IMPORT_PLAN_CONTEXT');};}
async function setState(id,state,guard){const current=(await db.get('device','device'))?.classFileImportPlans?.[id];if(!current||current.state===state)return;await store.updateLocalImportPlans(plans=>({...plans,[id]:{...plans[id],state}}),{verifyCurrent:guard});}
async function useSlot(plan,review,guard){
 await db.applyBatch({device:{}},{prepare(current){guard();const device=current.device.find(r=>r.id==='device'),prior=device.classFileImportContinuation;
  if(prior&&prior.backgroundPlanId!==plan.id)throw Error('IMPORT_SLOT_BUSY');
  return {device:{put:[{...device,classFileImportContinuation:prior??{version:1,backgroundPlanId:plan.id,ownerId:plan.ownerId,databaseName:plan.databaseName,created:plan.created,maximumReview:review,...(plan.maxProgress?{maxProgress:plan.maxProgress}:{})}}]}};
 }});store.state.device=await db.get('device','device');
}
async function releaseSlot(id,guard){
 await db.applyBatch({device:{}},{prepare(current){guard();const device=current.device.find(r=>r.id==='device'),saved=device.classFileImportContinuation,plan=device.classFileImportPlans?.[id];
  if(saved?.backgroundPlanId!==id||!plan)return {device:{}};
  return {device:{put:[{...device,classFileImportContinuation:null,classFileImportPlans:{...device.classFileImportPlans,[id]:{...plan,...(saved.maxProgress?{maxProgress:saved.maxProgress,maximumReview:saved.maximumReview}:{})}}}]}};
 }});store.state.device=await db.get('device','device');
}
function boundReview(plan){
 const teaching=store.getTeaching(plan.created.teachingId),section=store.getSection(teaching?.sectionId);
 if(!teaching||teaching.deleted||!section||section.deleted||teaching.termId!==plan.termId)throw reviewChanged();
 store.assertClassOperationsAccess(teaching.id);
 const c=store.teachingContext(teaching.id),required=[teaching,section,store.getSubject(teaching.subjectId),...c.roster,...store.state.enrollments.filter(e=>!e.deleted&&e.sectionId===section.id)];
 if(required.some(r=>!(r?.serverRevision>0)||r.syncCreatePending))return null;
 const input=structuredClone(plan.input);
 if(!plan.created.existing){
  const byName=new Map(plan.created.students.map(s=>[s.name,s.id]));
  if(c.roster.length!==plan.created.students.length||c.roster.some(s=>byName.get(s.name)!==s.id)||section.grade!==plan.classReview.grade||section.label!==plan.classReview.label||section.yearId!==plan.yearId||store.getSubject(teaching.subjectId)?.name!==plan.classReview.subject)throw reviewChanged();
  const items=c.items.map(i=>{const change=plan.maximumReview?.maxChanges.find(m=>m.itemId===i.id);return change&&Number(i.max)===change.max?{...i,max:change.oldMax}:i;});
  if(itemSemantics(items)!==plan.createdItems)throw reviewChanged();
  const column=input.rows[0].length;input.idColumn=column;input.rows=input.rows.map((r,i)=>[...r,i?byName.get(String(r[0]).replace(/\s+/g,' ').trim())??'':'saved-id']);input.mappings.push({kind:'ignore'});
  const prospective=defaultItemsFor('prospective');input.mappings=input.mappings.map(m=>{if(m.kind!=='existing')return m;const n=Number(String(m.itemId).replace('prospective-default-','')),expected=prospective[n],matches=expected?c.items.filter(i=>isTransferItem(i)&&gradeNameKey(i.name)===gradeNameKey(expected.name)):[];if(matches.length!==1)throw reviewChanged();return {...m,itemId:matches[0].id};});
 }
 const review=store.reviewGradeImport(teaching.id,input);
 if(review.newStudents.length||review.rejected.length||semantics(review)!==semantics(plan.proposal))throw reviewChanged();return review;
}
async function processPlan(plan,guard){
 guard();if(plan.version!==1||plan.ownerId!==store.getActiveWorkspace().authUserId||plan.databaseName!==db.getActiveDatabaseName())throw reviewChanged();
 if(academicImportBinding(store.activeYear())!==plan.year||academicImportBinding(store.activeTerm())!==plan.term)throw reviewChanged();
 const teaching=store.getTeaching(plan.created.teachingId);if(!teaching||teaching.deleted||teaching.termId!==plan.termId)throw reviewChanged();store.assertClassOperationsAccess(teaching.id);
 // An existing durable grade command is recovered as-is, never re-reviewed/re-queued.
 if(plan.gradeMutationId){
  const row=(await db.getAll('outbox')).find(r=>r.mutationId===plan.gradeMutationId);
  if(!row)throw reviewChanged();if(row.state==='rejected')throw reviewChanged();
  const engine=createSyncV2Engine({ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>cloud.user?.id??null,captureMutationContext:cloud.captureOwnedMutationContext});
  const result=await engine.dispatchPending({onlyMutationId:plan.gradeMutationId});guard();
  if(result.acknowledged!==1)await setState(plan.id,row.envelopeLocked?'uncertain':'waiting_sync',guard);return;
 }
 const review=plan.proposal?boundReview(plan):null;
 if(plan.proposal&&!review){await setState(plan.id,'waiting_creation',guard);return;}
 if(!plan.proposal){const c=store.teachingContext(teaching.id);if([teaching,...c.roster,...store.state.enrollments.filter(e=>e.sectionId===teaching.sectionId&&!e.deleted)].some(r=>!r.serverRevision||r.syncCreatePending)){await setState(plan.id,'waiting_creation',guard);return;}await setState(plan.id,'cloud_confirmed',guard);return;}
 const pending=await db.getAll('outbox');if(pending.some(r=>blocksGradeImport(r,plan.ownerId)&&!plan.maxProgress?.some(m=>m.mutationId===r.mutationId))){await setState(plan.id,'waiting_sync',guard);return;}
 await useSlot(plan,plan.maximumReview??review,guard);
 try{
  let actual=review;
  if(review.maxChanges.length||plan.maximumReview){
   await store.confirmImportMaximums(plan.maximumReview??review,{verifyCurrent:guard});guard();
   plan={...plan,maximumReview:plan.maximumReview??review};actual=boundReview(plan);if(!actual)throw reviewChanged();
  }
  const verify=()=>{guard();if(plan.maximumReview)store.assertImportMaximumReviewCurrent(plan.maximumReview);const fresh=boundReview(plan);if(!fresh||JSON.stringify(fresh)!==JSON.stringify(actual))throw reviewChanged();};
  if(actual.cells.length)await store.confirmGradeImport(actual,{approved:true,overwriteConfirmed:plan.overwriteConfirmed,enrollmentConfirmed:true,verifyCurrent:verify,backgroundImportPlanId:plan.id});
  else await setState(plan.id,'cloud_confirmed',guard);
 }finally{await releaseSlot(plan.id,guard);}
}
let installed=false,running=false,queued=false,recoverRequested=false;
export function requestImportBackground(recover=false){recoverRequested ||= recover;if(queued)return;queued=true;queueMicrotask(()=>{queued=false;void drainImportBackground();});}
export async function drainImportBackground(){
 if(running)return;const w=store.getActiveWorkspace();if(w?.type!=='account'||!cloud.session||!navigator.locks)return;
 running=true;const recover=recoverRequested;recoverRequested=false;
 try{await navigator.locks.request('rakeez-import:'+w.databaseName,{ifAvailable:true},async lock=>{
  if(!lock)return;let guard;try{guard=context();guard();}catch{return;}
  guard();store.state.device=await db.get('device','device');
  const before=JSON.stringify(store.state.device?.classFileImportPlans);
  if(store.state.device?.classFileImportContinuation?.backgroundPlanId)await releaseSlot(store.state.device.classFileImportContinuation.backgroundPlanId,guard);
  for(const plan of localImportPlans()){
   if(!['local_ready','waiting_creation','waiting_sync','syncing',...(recover?['uncertain']:[])].includes(plan.state))continue;
   try{await processPlan(plan,guard);}
   catch(error){try{guard();}catch{return;}
    const rows=await db.getAll('outbox'),latest=(await db.get('device','device'))?.classFileImportPlans?.[plan.id];
    if(latest?.state==='cloud_confirmed')continue;
    const own=rows.filter(r=>r.backgroundImportPlanId===plan.id||latest?.maxProgress?.some(m=>m.mutationId===r.mutationId));
    await setState(plan.id,own.some(r=>r.envelopeLocked&&r.state!=='rejected')?'uncertain':error.code==='IMPORT_PLAN_REVIEW'||own.some(r=>r.state==='rejected')?'needs_review':rows.some(r=>blocksGradeImport(r,plan.ownerId))?'waiting_sync':'needs_review',guard);
    if(latest?.state==='cloud_confirmed')continue;
   }
  }
  guard();store.state.device=await db.get('device','device');if(before!==JSON.stringify(store.state.device?.classFileImportPlans))await store.updateLocalImportPlans(plans=>plans,{verifyCurrent:guard});
 });}finally{running=false;if(recoverRequested)requestImportBackground();}
}
export function installImportBackground(){if(installed)return;installed=true;store.subscribe(()=>requestImportBackground());cloud.subscribe(()=>requestImportBackground(true));sync.subscribeAcknowledged(()=>requestImportBackground());window.addEventListener('online',()=>requestImportBackground(true));requestImportBackground(true);}
export async function retryLocalImport(id){await store.updateLocalImportPlans(plans=>{const p=plans[id];if(!p||p.state==='cloud_confirmed'||p.state==='cancelled')throw reviewChanged();return {...plans,[id]:{...p,state:'local_ready'}};});requestImportBackground(true);}
export async function cancelLocalImport(id){const w=store.assertClassImportAccess();await navigator.locks.request('rakeez-import:'+w.databaseName,async()=>{const guard=context(),plan=(await db.get('device','device'))?.classFileImportPlans?.[id];guard();if(!plan||plan.state==='cloud_confirmed')throw reviewChanged();await useSlot(plan,plan.maximumReview??null,guard);try{await store.cancelClassFileImportContinuation(plan.created.teachingId);await setState(id,'cancelled',guard);}finally{await releaseSlot(id,guard);}});}
