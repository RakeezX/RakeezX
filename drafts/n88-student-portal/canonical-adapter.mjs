/** AI: inactive, trusted PG canonical binding. No request-supplied identity scope.
 * Source schema: 0001, 0012 revision protocol, 0021 section lifecycle.
 * SHARE table locks deliberately cover even writers that do not take our advisory
 * lock (Sync RPCs, lifecycle/restore/import and privileged direct SQL). Coarse and
 * bounded, not a public-scale architecture. Never replace this with timestamp TTL.
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
  return async (db,{query}) => {
    // Fixed identifiers only. Locks last through durable portal commit, not just lookup.
    await query('select n88_private.lock_canonical_sources()');
    const owners=[...new Set(db.contexts.filter(c=>c.active).map(c=>c.ownerId))].sort();
    const result=await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select e.owner_id,e.id as enrollment_id,e.section_id,e.student_id,e.revision::text as revision,
          e.status,e.end_date::text as end_date,e.deleted_at is null as enrollment_present,
          s.status='active' and s.deleted_at is null as student_active,left(s.name,300) as label,
          c.status='active' and c.deleted_at is null and y.status='active' and y.deleted_at is null as class_active
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
    for(const m of db.memberships) {m.status='inactive';m.studentActive=false;m.classActive=false;}
    for(const row of result.rows) {
      const r=read(row), revision=Number(r.revision);
      if(!/^[1-9][0-9]*$/.test(r.revision) || !Number.isSafeInteger(revision)) fail();
      const m={ownerId:r.owner_id,classId:r.section_id,studentId:r.student_id,enrollmentId:r.enrollment_id,revision,
        status:r.enrollment_present && r.status==='active'?'active':'ended',endDate:r.end_date,
        studentActive:r.student_active,classActive:r.class_active,label:r.label};
      if(!owners.includes(m.ownerId)) fail();
      const old=previous.get(key(m));
      if(old) Object.assign(old,m); else {db.memberships.push(m);previous.set(key(m),m);}
    }
    const source=await query(`select case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select i.owner_id,i.id as item_id,left(i.name,160) as title,t.id as teaching_id,t.section_id
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
      for(const m of db.memberships.filter(m=>m.ownerId===r.owner_id && m.classId===r.section_id && m.status==='active' && !m.endDate && m.studentActive && m.classActive)) {
        const publicationId=id([m.ownerId,m.enrollmentId,r.teaching_id,r.item_id]); current.add(publicationId);
        const existing=db.publications.find(p=>p.id===publicationId);
        if(existing && (key(existing)!==key(m) || existing.source.teachingId!==r.teaching_id || existing.source.itemId!==r.item_id)) fail();
        if(!existing) db.publications.push({id:publicationId,
          ownerId:m.ownerId,classId:m.classId,studentId:m.studentId,enrollmentId:m.enrollmentId,
          source:{teachingId:r.teaching_id,itemId:r.item_id},title:r.title,instruction:'',deadline:null,status:'todo',published:false});
        if(db.publications.length>maxRows) fail();
      }
    }
    // Removing a source deletes ONLY its editorial portal projection. No score or
    // source writes. Restored sources must be explicitly published again.
    db.publications=db.publications.filter(p=>current.has(p.id));
  };
}
