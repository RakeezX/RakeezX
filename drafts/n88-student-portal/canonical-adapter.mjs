import { Buffer } from 'node:buffer';
/** AI: inactive, trusted PG canonical binding. No request-supplied identity scope.
 * Source schema: 0001, 0012 revision protocol, 0021 section lifecycle.
 * Exact owner key/FK + bounded existing row locks cover noncooperating Sync writers.
 * Called ONLY after trusted ingress/debits and identity resolution. No global scan.
 */
import { createHash } from 'node:crypto';
export const CANONICAL_TABLES = Object.freeze(['years','terms','sections','students','enrollments','teachings','items']);
const fail = () => { throw Error('n88_canonical_unavailable'); };
const key = m => JSON.stringify([m.ownerId,m.classId,m.studentId,m.enrollmentId]);
const id = parts => {
  const h=createHash('sha256').update(JSON.stringify(['n88-publication-v1',...parts])).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
};
export function createCanonicalAdapter({ maxRows = 2000, maxBytes = 2*1024*1024 } = {}) {
  if (!Number.isSafeInteger(maxRows) || maxRows<1 || maxRows>10000 || !Number.isSafeInteger(maxBytes) || maxBytes<1024 || maxBytes>16*1024*1024) fail();
  return async (db,{query},ownerId) => {
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(ownerId) || !db.contexts.some(c=>c.ownerId===ownerId && c.active)) fail();
    await query('select n88_private.lock_canonical_sources($1::uuid,$2::integer)',[ownerId,maxRows]);
    const owners=[ownerId];
    const result=await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select e.owner_id,e.id as enrollment_id,e.section_id,e.student_id,e.revision::text as revision,
          e.status,e.end_date::text as end_date,e.deleted_at is null as enrollment_present,
          s.status='active' and s.deleted_at is null as student_active,left(s.name,300) as label,
          c.status='active' and c.deleted_at is null and y.status='active' and y.deleted_at is null as class_active,
          s.revision::text as student_revision,c.revision::text as section_revision,y.revision::text as year_revision
        from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id
        join rakeezx.sections c on c.owner_id=e.owner_id and c.id=e.section_id
        join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
        where e.owner_id=any($1::uuid[]) order by e.owner_id,e.id limit $2
      ) x) bounded`,[owners,maxRows+1,maxBytes]);
    if(result.rows.length>maxRows) fail();
    let bytes=0;
    const read = row => {
      if(typeof row.payload!=='string') fail(); bytes+=Buffer.byteLength(row.payload); if(bytes>maxBytes) fail();
      return JSON.parse(row.payload);
    };
    const previous=new Map(db.memberships.map(m=>[key(m),m]));
    // Keep inactive parents for old session FKs; never resurrect absent sources.
    for(const m of db.memberships.filter(m=>m.ownerId===ownerId)) {m.status='inactive';m.studentActive=false;m.classActive=false;}
    for(const row of result.rows) {
      const r=read(row), revision=Number(r.revision);
      if(!/^[1-9][0-9]*$/.test(r.revision) || !Number.isSafeInteger(revision)) fail();
      const revisions=[r.revision,r.student_revision,r.section_revision,r.year_revision];
      if(!revisions.every(v=>typeof v==='string' && /^[1-9][0-9]*$/.test(v))) fail();
      const canonicalStamp=createHash('sha256').update(JSON.stringify(['n88-lineage-v1',...revisions])).digest('hex');
      const m={ownerId:r.owner_id,classId:r.section_id,studentId:r.student_id,enrollmentId:r.enrollment_id,revision,canonicalStamp,
        status:r.enrollment_present && r.status==='active'?'active':'ended',endDate:r.end_date,
        studentActive:r.student_active,classActive:r.class_active,label:r.label};
      if(!owners.includes(m.ownerId)) fail();
      const old=previous.get(key(m));
      if(old) Object.assign(old,m); else {db.memberships.push(m);previous.set(key(m),m);}
    }
    // Retire observed invalid old sessions durably, including absent source rows.
    // A later restore cannot make such a session current again.
    for(const s of db.sessions.filter(s=>s.ownerId===ownerId && s.revokedAt==null)) {
      const m=db.memberships.find(m=>key(m)===key(s));
      if(!m || m.status!=='active' || m.endDate || !m.studentActive || !m.classActive || m.revision!==s.membershipRevision || m.canonicalStamp!==s.canonicalStamp) s.revokedAt=Date.now();
    }
    const source=await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select i.owner_id,i.id as item_id,left(i.name,160) as title,t.id as teaching_id,t.section_id,
          i.revision::text as item_revision,t.revision::text as teaching_revision,term.revision::text as term_revision
        from rakeezx.items i join rakeezx.teachings t on t.owner_id=i.owner_id and t.id=i.teaching_id
        join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id
        join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
        where i.owner_id=any($1::uuid[]) and i.deleted_at is null and t.deleted_at is null
          and term.deleted_at is null and term.status='active' and term.year_id=c.year_id
          and i.auto is null order by i.owner_id,i.id limit $2
      ) x) bounded`,[owners,maxRows+1,maxBytes-bytes]);
    if(source.rows.length>maxRows) fail();
    const current=new Set();
    for(const row of source.rows) {
      const r=read(row);
      const revisions=[r.item_revision,r.teaching_revision,r.term_revision];
      if(!revisions.every(v=>typeof v==='string' && /^[1-9][0-9]*$/.test(v))) fail();
      for(const m of db.memberships.filter(m=>m.ownerId===r.owner_id && m.classId===r.section_id && m.status==='active' && !m.endDate && m.studentActive && m.classActive)) {
        const publicationId=id([m.ownerId,m.enrollmentId,m.canonicalStamp,r.teaching_id,r.item_id,...revisions]); current.add(publicationId);
        const existing=db.publications.find(p=>p.id===publicationId);
        if(existing && (key(existing)!==key(m) || existing.source.teachingId!==r.teaching_id || existing.source.itemId!==r.item_id)) fail();
        const prior=db.publications.find(p=>key(p)===key(m) && p.source.teachingId===r.teaching_id && p.source.itemId===r.item_id);
        if(!existing) db.publications.push({id:publicationId,
          ownerId:m.ownerId,classId:m.classId,studentId:m.studentId,enrollmentId:m.enrollmentId,
          source:{teachingId:r.teaching_id,itemId:r.item_id},title:prior?.title||r.title,instruction:prior?.instruction||'',
          deadline:prior?.deadline||null,status:prior?.status||'todo',published:false});
        if(db.publications.length>maxRows) fail();
      }
    }
    // Removing a source deletes ONLY its editorial portal projection. No score or
    // source writes. Restored sources must be explicitly published again.
    db.publications=db.publications.filter(p=>p.ownerId!==ownerId || current.has(p.id));
  };
}
