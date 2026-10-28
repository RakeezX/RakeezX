import {credentialStateRevision,reconcileIssuanceReceipts} from './receipt-reconciliation.mjs';
import {cancelOriginalIntentTransaction} from './receipt-terminal-review.inactive.mjs';
import {createCanonicalAdapter} from './canonical-adapter.mjs';
import {readTaskGuidance,authorizedGuidanceSources,guidanceTeacherList,saveTaskGuidance} from './task-guidance.mjs';
/** AI: inactive class/universal composition in the existing fenced PG transaction. */
import {createHash,randomUUID} from 'node:crypto';
import {withCredentialRepository,createClassCredentialOperations,createPgClassResolver} from './class-credentials.mjs';
import {createCodeRecovery} from './code-recovery.mjs';
import {createNumericCredentialOperations} from './numeric-credentials.mjs';
import {projectStudentPortal,studentPortalPublicationBindings,CANONICAL_PROJECTION_REQUIREMENTS} from './student-projection.mjs';
import {VISIBILITY_FIELDS} from './visibility-policy.mjs';
import {PRIVATE_HEADERS} from './service.mjs';
import {createRolloutGuard} from './rollout-guard.mjs';
const deny=()=>({status:401,body:{error:'unavailable'},headers:PRIVATE_HEADERS});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const camel=s=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const sqlNames={scoreSubitems:'score_subitems',scoreSubitemCompletions:'score_subitem_completions'};
const numeric=new Set(['max','value','manualValue','derivedValue','perPoint','penalty','latePoints']);
// Explicit consumed-column allowlist: never fetch notes, metadata or teacher secrets.
const columns={years:'id,owner_id,revision,deleted_at,status',terms:'id,owner_id,revision,deleted_at,year_id,status,start_date,end_date',
  sections:'id,owner_id,revision,deleted_at,year_id,status,archived_at,grade,label,name',students:'id,owner_id,revision,deleted_at,status,name',
  enrollments:'id,owner_id,revision,deleted_at,student_id,section_id,status,start_date,end_date',teachings:'id,owner_id,revision,deleted_at,section_id,term_id,subject_id',
  items:'id,owner_id,revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id',
  scores:'id,owner_id,revision,deleted_at,student_id,item_id,value,manual_value,derived_value',
  scoreSubitems:'id,owner_id,revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points',
  scoreSubitemCompletions:'id,owner_id,revision,deleted_at,student_id,subitem_id,checked,completion_state',
  sessions:'id,owner_id,revision,deleted_at,teaching_id,date,status',attendance:'id,owner_id,revision,deleted_at,student_id,teaching_id,session_id,status',
  logs:'id,owner_id,revision,deleted_at,student_id,teaching_id,kind,delta'};
async function readCanonicalSerial(ports,ownerId,listScopeOnly=false) {
  // Admission reads only terms/teachings: keep the canonical owner/row/bound
  // fence, without locking unrelated score/attendance/log projection families.
  // Full student, visibility and guidance reads still require the projection lock.
  await ports.query(listScopeOnly ? 'select n88_private.lock_canonical_sources($1::uuid,$2::integer)' :
    'select n88_private.lock_projection_sources($1::uuid,$2::integer)',[ownerId,2000]);
  const canonical={};let bytes=0;
  // List and credential-command admission consume only teaching/term here. Membership synchronization,
  // the canonical source lock/bounds and commit guards still run below. Student
  // projection, visibility publication and guidance retain the full projection.
  for(const table of listScopeOnly ? ['terms','teachings'] : CANONICAL_PROJECTION_REQUIREMENTS.tables) {
    // PG bigint revisions must never round through a JavaScript JSON number.
    const selected=columns[table].replace(/\brevision\b/g,'revision::text as revision');
    const r=await ports.query(`select case when octet_length(payload)<= $3 and sum(octet_length(payload)) over (rows unbounded preceding)<= $3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select ${selected} from rakeezx.${sqlNames[table]||table} where owner_id=$1::uuid order by id limit $2) x) bounded`,[ownerId,2001,2*1024*1024-bytes]);
    if(r.rows.length>2000)throw Error('n88_projection_bound');
    canonical[table]=r.rows.map(({payload})=>{
      if(typeof payload!=='string' || (bytes+=Buffer.byteLength(payload))>2*1024*1024)throw Error('n88_projection_bound');
      const raw=JSON.parse(payload),row=Object.fromEntries(Object.entries(raw).map(([k,v])=>[camel(k),v]));
      row.deleted=row.deletedAt!==null;
      for(const k of numeric)if(row[k]!=null)row[k]=Number(row[k]);
      return row;
    });
  }
  return canonical;
}
export async function readCanonical(ports,ownerId,listScopeOnly=false) {
  const mode=ports.canonicalReadMode();
  if(mode==='serial')return readCanonicalSerial(ports,ownerId,listScopeOnly);
  if(mode!=='batch')throw Error('n88_database_unavailable');

  await ports.query(listScopeOnly ? 'select n88_private.lock_canonical_sources($1::uuid,$2::integer)' : 'select n88_private.lock_projection_sources($1::uuid,$2::integer)',[ownerId,2000]);
  const names=listScopeOnly ? ['terms','teachings'] : CANONICAL_PROJECTION_REQUIREMENTS.tables;
  const canonical=Object.fromEntries(names.map(t=>[t,[]]));let bytes=0;
  const result=await ports.query(listScopeOnly ? "select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (select 0 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x union all select 1 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x) bounded order by table_index,id" : "select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (select 0 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status from rakeezx.years where owner_id=$1::uuid order by id limit $2) x union all select 1 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=$1::uuid order by id limit $2) x union all select 2 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,archived_at,grade,label,name from rakeezx.sections where owner_id=$1::uuid order by id limit $2) x union all select 3 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status,name from rakeezx.students where owner_id=$1::uuid order by id limit $2) x union all select 4 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,section_id,status,start_date,end_date from rakeezx.enrollments where owner_id=$1::uuid order by id limit $2) x union all select 5 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=$1::uuid order by id limit $2) x union all select 6 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,name,max,\"order\",auto,per_point,penalty,score_mode,portability_group_id from rakeezx.items where owner_id=$1::uuid order by id limit $2) x union all select 7 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,item_id,value,manual_value,derived_value from rakeezx.scores where owner_id=$1::uuid order by id limit $2) x union all select 8 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,item_id,name,value,\"order\",start_date,due_date,late_points from rakeezx.score_subitems where owner_id=$1::uuid order by id limit $2) x union all select 9 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,subitem_id,checked,completion_state from rakeezx.score_subitem_completions where owner_id=$1::uuid order by id limit $2) x union all select 10 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,date,status from rakeezx.sessions where owner_id=$1::uuid order by id limit $2) x union all select 11 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,session_id,status from rakeezx.attendance where owner_id=$1::uuid order by id limit $2) x union all select 12 as table_index,x.id,row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,kind,delta from rakeezx.logs where owner_id=$1::uuid order by id limit $2) x) bounded order by table_index,id",[ownerId,2001,2*1024*1024]);
  for(const {table_index,payload} of result.rows) {
    const rows=canonical[names[table_index]];
    if(!Number.isInteger(table_index)||!rows||rows.length>=2000||typeof payload!=='string'||(bytes+=Buffer.byteLength(payload))>2*1024*1024)throw Error('n88_projection_bound');
    const row=Object.fromEntries(Object.entries(JSON.parse(payload)).map(([k,v])=>[camel(k),v]));
    row.deleted=row.deletedAt!==null;
    for(const k of numeric)if(row[k]!=null)row[k]=Number(row[k]);
    rows.push(row);
  }
  return canonical;
}
/** AI: complete current-class dependency closure, certified by the native reader.
 * Same projection, raw scores and publication bindings; no fabricated families.
 * Only construction-time synthetic qualification may select this inactive branch.
 */
export async function readGuidanceCanonical(ports,ownerId,classId,termId) {
  const names=CANONICAL_PROJECTION_REQUIREMENTS.tables;
  const canonical=Object.fromEntries(names.map(t=>[t,[]]));let bytes=0;
  const result=await ports.query('select table_index,payload from n88_private.boundary_guidance_sources_v1($1::uuid,$2::text,$3::text)',[ownerId,classId,termId]);
  const seen=new Set();
  for(const {table_index,payload} of result.rows) {
    if(!Number.isInteger(table_index)||!canonical[names[table_index]]||typeof payload!=='string'||(bytes+=Buffer.byteLength(payload))>2*1024*1024)throw Error('n88_projection_bound');
    // Each family has a real query result, including a certified empty result.
    const raw=JSON.parse(payload);if(!Array.isArray(raw)||seen.has(table_index)||raw.length>2000)throw Error('n88_projection_bound');
    seen.add(table_index);
    canonical[names[table_index]]=raw.map(r=>{
      const row=Object.fromEntries(Object.entries(r).map(([k,v])=>[camel(k),v]));row.deleted=row.deletedAt!==null;
      for(const k of numeric)if(row[k]!=null)row[k]=Number(row[k]);return row;
    });
  }
  if(seen.size!==names.length)throw Error('n88_projection_bound');
  return canonical;
}
const fieldsOff=()=>Object.fromEntries(VISIBILITY_FIELDS.map(f=>[f,false]));
const bindingKeys=['ownerId','sessionId','leaseId','teachingId','classId','termId','contextRevision'];
export const classListResponseMode=(mode,protocol)=>mode==='public'&&protocol===undefined?'pilot':mode;
/** AI: a failed private read transaction is not an authentication verdict.
 * Keep the HttpOnly session on infrastructure/projection/COMMIT failure; retry
 * still revalidates every original guard. Per-request state cannot cross users.
 */
function createStudentReadBoundary(createHandler,options) {
  const normal=createHandler(options);
  return async request=>{
    if(request.method!=='GET'||!['/student/read','/api/n88/student/read'].includes(request.path))return normal(request);
    let repositoryFailed=false;
    const repository={...options.repository,transaction:async action=>{
      try{return await options.repository.transaction(action);}
      catch{repositoryFailed=true;throw Error('n88_student_read_unavailable');}
    }};
    const result=await createHandler({...options,repository})(request);
    return repositoryFailed ? {status:503,body:{error:'unavailable'},headers:PRIVATE_HEADERS} : result;
  };
}
export function createIntegratedService(options,adapter,baseRepository) {
  // Server construction only; no env/body/client switch. Inert unless separately
  // qualified and explicitly enabled by a future authorized service custodian.
  const negativeTerminalEnabled=options.terminalResolutionEnabled===true;
  const scopedGuidanceEnabled=options.syntheticGuidanceClosureEnabled===true&&options.executionMode==='synthetic';
  const rollout=options.rollout??createRolloutGuard();
  const repository=withCredentialRepository(baseRepository);
  const credentials=createNumericCredentialOperations({rollout,keys:new Map([['v1',options.numericKey]]),activeKeyVersion:'v1',reservationKey:options.reservationKey});
  const recovery=createCodeRecovery({keys:options.recoveryKeys,activeKeyVersion:options.recoveryActiveKeyVersion,otherKeys:[options.numericKey,options.reservationKey,options.ingressKey,options.secretKey]});
  const ownedCredential=(db,m)=>{
    const cs=db.numericCredentials.filter(c=>c.ownerId===m.ownerId&&c.studentId===m.studentId&&c.revokedAt===null);
    if(cs.length>1)throw Error('n88_recovery_unavailable');return cs[0];
  };
  const recovering=Object.fromEntries(['issueMember','rotateMember'].map(action=>[action,async(db,m,input,ports)=>{
    const result=credentials[action](db,m,input),c=ownedCredential(db,m);
    await recovery.append(ports,c,result.code);return result;
  }]));
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  async function scope(db,ports,auth,teachingId,input={},listScopeOnly=false,scopedGuidance=false) {
    const resolved=await createPgClassResolver()(db,ports,auth,teachingId,input);
    if(!resolved)return null;
    let canonical=await readCanonical(ports,auth.ownerId,scopedGuidance||listScopeOnly);
    const teaching=canonical.teachings.find(t=>t.id===teachingId),term=canonical.terms.find(t=>t.id===teaching?.termId);
    if(!teaching || !term || term.startDate&&term.startDate>today() || term.endDate&&term.endDate<today())return null;
    if(scopedGuidance) {
      if(term.id!==input.binding?.termId)return null;
      canonical=await readGuidanceCanonical(ports,auth.ownerId,resolved.classId,term.id);
    }
    return {...resolved,canonical,termId:term.id};
  }
  const inputFor=(s,m)=>({teacherContextVersion:'n88-canonical-teacher-context-v1',canonical:s.canonical,ownerId:s.ownerId,classId:s.classId,termId:s.termId,studentId:m.studentId,enrollmentId:m.enrollmentId,now:today()});
  async function policies(ports,ownerId,classId,termId) {
    const r=await ports.query('select payload from n88_private.class_visibility where owner_id=$1::uuid and class_id=$2 and term_id=$3',[ownerId,classId,termId]);
    return r.rows[0]?.payload||{revision:0,fields:fieldsOff(),members:[]};
  }
  const student=createStudentReadBoundary(credentials.createStudentHandler,{repository,verifyIngress:adapter.verifyIngress,origin:options.origin,project:async(db,m,ports)=>{
    const measure=ports.measure??(async(_name,action)=>action());
    const canonical=await measure('canonical',()=>readCanonical(ports,m.ownerId));
    const terms=canonical.terms.filter(t=>!t.deleted && t.status==='active' && canonical.teachings.some(x=>!x.deleted&&x.sectionId===m.classId&&x.termId===t.id));
    if(terms.length!==1)throw Error('n88_current_term');
    const s={ownerId:m.ownerId,classId:m.classId,termId:terms[0].id,canonical},policy=await measure('visibility',()=>policies(ports,m.ownerId,m.classId,s.termId));
    const stored=policy.members.find(p=>p.studentId===m.studentId&&p.enrollmentId===m.enrollmentId);
    const taskGuidance=await measure('guidance',()=>readTaskGuidance(ports,s));
    return measure('projection',()=>projectStudentPortal({...inputFor(s,m),visibility:stored||null,taskGuidance}));
  }});
  return async request=>{
    if(request.path.startsWith('/student/'))return student(request);
    const match=/^\/teacher\/class\/(list|issue-missing|rotate|revoke|visibility|guidance-list|guidance-save)$/.exec(request.path);
    if(!match || request.method!=='POST')return deny();
    const action=match[1],body=request.body||{},binding=body.binding;
    const terminalRequest=Object.hasOwn(body,'resolutionVersion')||Object.hasOwn(body,'resolution');
    if(terminalRequest && (!negativeTerminalEnabled || action!=='revoke' || body.resolutionVersion!==1 ||
      !['status','close'].includes(body.resolution) || Object.keys(body).sort().join(',')!==
      'binding,expectedCredentialRevision,expectedRosterRevision,requestId,resolution,resolutionVersion,teachingId'))return deny();
    if(action==='list'&&body.uiProtocol!==undefined&&body.uiProtocol!=='n88-public-ui-v1')return deny();
    if(!binding || Object.keys(binding).length!==bindingKeys.length || !bindingKeys.every(k=>typeof binding[k]==='string'&&binding[k].length>0&&binding[k].length<=200) || binding.teachingId!==body.teachingId)return deny();
    // The browser binding is only an echo fence. Auth/current canonical source decides authority.
    const verifyTeacher=async(r,ports)=>{
      const auth=await adapter.verifyTeacher(r,ports);
      return auth?.ownerId===binding.ownerId&&auth.sessionId===binding.sessionId?auth:null;
    };
    const resolveClass=(db,ports,auth,teachingId,input)=>scope(db,ports,auth,teachingId??body.teachingId,input,['list','issue-missing','rotate','revoke'].includes(action),scopedGuidanceEnabled&&action==='guidance-list').then(s=>{
      if(!s||s.classId!==binding.classId||s.termId!==binding.termId||!rollout.admitsTeacher(auth,s))return null;
      // First deliberate admitted teacher access may create its own private context.
      // An existing inactive context is never reactivated; no canonical/Auth write.
      if(!terminalRequest&&['pilot','public'].includes(rollout.mode)&&!db.contexts.some(c=>c.ownerId===auth.ownerId))db.contexts.push({namespace:(rollout.mode==='pilot'?'n88_pilot_':'n88_owner_')+randomUUID(),ownerId:auth.ownerId,active:true});
      return s;
    });
    if(terminalRequest) {
      try{return await repository.transaction(async(db,ports)=>{
        const h=request.headers||{},ingress=await adapter.verifyIngress(request,ports);
        if(!ingress?.clientKey||h.origin!==options.origin||h['x-n88-csrf']!=='1'||h['content-type']!=='application/json'||
          h['sec-fetch-site']&&h['sec-fetch-site']!=='same-origin'||typeof ports.beforeCommit!=='function')return deny();
        const auth=await verifyTeacher(request,ports);
        if(!auth?.ownerId||!auth.sessionId||auth.current!==true||!rollout.allowsOwner(auth.ownerId))return deny();
        const s=await resolveClass(db,ports,auth,body.teachingId,body);if(!s)return deny();
        // Reuse the canonical source reader/locks on a detached draft. Neither
        // status nor close may flush synchronization, publication or session changes.
        // Only a new immutable class receipt is eligible for the enclosing flush.
        const current={contexts:structuredClone(db.contexts),memberships:structuredClone(db.memberships),sessions:[],publications:[]};
        await createCanonicalAdapter({rollout})(current,ports,auth.ownerId);
        const active=m=>m.status==='active'&&m.endDate===null&&m.studentActive===true&&m.classActive===true;
        const members=current.memberships.filter(m=>m.ownerId===auth.ownerId&&m.classId===s.classId&&active(m)&&rollout.admitsStudent(m));
        if(members.length>2000||new Set(members.map(m=>m.studentId)).size!==members.length||
          members.some(m=>current.memberships.filter(x=>x.ownerId===m.ownerId&&x.studentId===m.studentId&&active(x)).length!==1))return deny();
        members.sort((a,b)=>a.studentId.localeCompare(b.studentId));
        const rosterRevision=hash([s.teachingId,s.revision,members.map(m=>[m.studentId,m.enrollmentId,m.revision,m.canonicalStamp])]);
        const data=cancelOriginalIntentTransaction(db,{ownerId:auth.ownerId,sessionId:auth.sessionId,current:true,
          teachingId:s.teachingId,classId:s.classId,termId:s.termId,members,rosterRevision,
          credentialRevision:credentialStateRevision(db,members)},Object.fromEntries(
          ['requestId','expectedRosterRevision','expectedCredentialRevision'].map(k=>[k,body[k]])),body.resolution);
        return {status:200,body:{ack:true,binding,requestId:body.requestId,data},headers:PRIVATE_HEADERS};
      });}catch{return {...deny(),status:503};}
    }
    const ops=createClassCredentialOperations({rollout,repository,...credentials,...recovering,origin:options.origin,verifyIngress:adapter.verifyIngress,verifyTeacher,resolveClass});
    // Operations preserve their transaction/commit ACK. UI adaptation never exposes a precommit secret.
    if(action==='visibility' || action==='list' || action.startsWith('guidance-')) {
      let stage='repository';try{return await repository.transaction(async(db,ports)=>{
        const h=request.headers||{};
        if(!await adapter.verifyIngress(request,ports) || h.origin!==options.origin||h['x-n88-csrf']!=='1'||h['content-type']!=='application/json'||h['sec-fetch-site']&&h['sec-fetch-site']!=='same-origin')return deny();
        stage='teacher';const auth=await verifyTeacher(request,ports);if(!auth?.current||!rollout.allowsOwner(auth.ownerId))return deny();
        stage='source';const s=await resolveClass(db,ports,auth,body.teachingId,body);if(!s)return deny();
        stage='synchronize';await ports.synchronizeOwner(auth.ownerId);stage='projection';
        const members=db.memberships.filter(m=>m.ownerId===auth.ownerId&&m.classId===s.classId&&m.status==='active'&&!m.endDate&&m.studentActive&&m.classActive&&rollout.admitsStudent(m));
        if(members.length>2000||new Set(members.map(m=>m.studentId)).size!==members.length||members.some(m=>db.memberships.filter(x=>x.ownerId===m.ownerId&&x.studentId===m.studentId&&x.status==='active'&&!x.endDate&&x.studentActive&&x.classActive).length!==1))return deny();
        const rosterRevision=hash([s.teachingId,s.revision,members.sort((a,b)=>a.studentId.localeCompare(b.studentId)).map(m=>[m.studentId,m.enrollmentId,m.revision,m.canonicalStamp])]);
        let p=await policies(ports,s.ownerId,s.classId,s.termId),data;
        if(action.startsWith('guidance-')) {
          const sources=authorizedGuidanceSources(s,members,p,inputFor),stored=await readTaskGuidance(ports,s);
          if(action==='guidance-list') data={tasks:guidanceTeacherList(sources,stored)};
          else {
            if(Object.keys(body).sort().join(',')!=='binding,guidance,requestId,teachingId'||typeof body.requestId!=='string'||body.requestId.length>100)return deny();
            data=await saveTaskGuidance(ports,s,sources.find(x=>x.subitemId===body.guidance?.subitemId),stored,body.guidance);
          }
        }else if(action==='visibility') {
          if(p.revision!==body.policyRevision||body.expectedRosterRevision!==rosterRevision||!body.fields||Object.keys(body.fields).length!==6||!VISIBILITY_FIELDS.every(f=>typeof body.fields[f]==='boolean'))return deny();
          const membersPolicy=members.map(m=>{const input=inputFor(s,m),b=studentPortalPublicationBindings(input);return {version:'n88-visibility-v1',ownerId:s.ownerId,studentId:m.studentId,enrollmentId:m.enrollmentId,classId:s.classId,termId:s.termId,scopeStamp:b.scopeStamp,fields:body.fields,sources:b.sources.map(src=>({...src,publicationId:randomUUID()}))};});
          // Preserve unrelated historical member policies during the bounded pilot.
          p={revision:p.revision+1,fields:body.fields,members:[...p.members.filter(m=>!rollout.allowsMember(m)),...membersPolicy]};
          await ports.query('insert into n88_private.class_visibility(owner_id,class_id,term_id,payload) values($1::uuid,$2,$3,$4::jsonb) on conflict(owner_id,class_id,term_id) do update set payload=excluded.payload',[s.ownerId,s.classId,s.termId,JSON.stringify(p)]);
          data={updated:true,policyRevision:p.revision,fields:p.fields};
        }else data={classId:s.classId,rosterRevision,policyRevision:p.revision,visibility:p.fields,students:await Promise.all(members.map(async m=>{const cs=db.numericCredentials.filter(c=>c.ownerId===m.ownerId&&c.studentId===m.studentId);const c=ownedCredential(db,m),r=c?await recovery.read(ports,c):{status:'inactive',credential:null};return {recoveryStatus:r.status,credential:r.credential,studentId:m.studentId,enrollmentId:m.enrollmentId,revision:m.revision,label:m.label,hasActiveCode:cs.some(c=>c.revokedAt===null),credentialVersion:Math.max(0,...cs.map(c=>c.version))};}))};
        if(action==='list'&&body.reconciliationVersion!==undefined){
          if(body.reconciliationVersion!==1)return deny();
          data.credentialRevision=credentialStateRevision(db,members);
          data.reconciliation=reconcileIssuanceReceipts(db,s,members,body.reconcile??[]);
          if(negativeTerminalEnabled&&body.terminalResolutionVersion===1)
            data.terminalResolution='n88-terminal-no-issuance-v1';
        }
        // Legacy pilot list clients require their original response discriminator.
        // Operational mode and all admission decisions still use the actual guard.
        const responseMode=action==='list'?classListResponseMode(rollout.mode,body.uiProtocol):rollout.mode;
        return {status:200,body:{ack:true,binding,requestId:body.requestId??null,data,rollout:responseMode},headers:PRIVATE_HEADERS};
      });}catch(e){const phase=['acquire','begin','snapshot'].includes(e.safeStage)?e.safeStage:stage;return {...deny(),status:503,body:{error:'unavailable',stage:phase}};}
    }
    const current=ops.forRequest(request);
    const result=action==='issue-missing'?await current.issueMissingClassCodes(body.teachingId,body):await current[action](body);
    if(result.status!==200)return result;
    const r=result.body,created=r.results.filter(x=>x.status==='created').map(x=>({studentId:x.studentId,enrollmentId:x.enrollmentId,credentialVersion:x.credentialVersion,credential:r.secrets.find(s=>s.studentId===x.studentId).code}));
    let data;
    if(action==='issue-missing')data={requestId:r.requestId,created,skipped:r.results.filter(x=>x.status==='skipped').map(x=>({studentId:x.studentId,reason:x.reason==='existing'?'existing':'revoked'})),failed:r.results.filter(x=>x.status==='failed').map(x=>({studentId:x.studentId,reason:'unavailable'})),uncertain:r.results.some(x=>x.status==='uncertain')};
    else {
      const x=r.results[0];if(!x||x.status==='failed'||x.status==='uncertain')return {...deny(),status:503};
      data={studentId:x.studentId,enrollmentId:x.enrollmentId,credentialVersion:x.credentialVersion,...(action==='rotate'?{rotated:true,credential:created[0].credential}:{revoked:true})};
    }
    return {...result,body:{ack:true,binding,requestId:body.requestId??null,data}};
  };
}
