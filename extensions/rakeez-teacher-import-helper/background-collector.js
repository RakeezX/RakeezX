import {appendSourceRows} from './source-roster.js';
import {parseCategoryTable,validateCategory,bundle} from './categories.js';
import {RUN_LIMITS,safeRoute,mergePage} from './navigation.js';
export function routeIdentity(origin,path){const u=new URL(path,origin);let entries=[...u.searchParams];if(/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[^/]+\/?$/i.test(u.pathname)){const pages=entries.filter(([k])=>['page','pagenumber'].includes(k.toLowerCase()));if(pages.length===1&&/^(?:0*1)$/.test(pages[0][1]))entries=entries.filter(([k])=>!['page','pagenumber'].includes(k.toLowerCase()));}return u.pathname+'?'+JSON.stringify(entries.sort());}
function sourcePageSeen(job,origin,path){
 const u=new URL(path,origin),keys=['page','pagenumber'];
 const series=job.series.get(u.pathname+'?'+JSON.stringify([...u.searchParams].filter(([k])=>!keys.includes(k.toLowerCase())).sort()));
 const page=Number([...u.searchParams].find(([k])=>keys.includes(k.toLowerCase()))?.[1]??1);
 return !!series&&Number.isSafeInteger(page)&&series.pages.has(page);
}

export function consumePage(job,next){
 const origin=job.origin;
   let page=next.page;if(page.runContext){if(job.context?.schoolId&&page.runContext.schoolId&&job.context.schoolId!==page.runContext.schoolId)throw Error('SCHOOL_CONTEXT_CHANGED');job.context={...job.context,...page.runContext};}
   for(const school of page.schoolNames??[]){if(job.context?.schoolName&&job.context.schoolName!==school)throw Error('SCHOOL_CONTEXT_CHANGED');job.rosterSchools.add(school);job.context={...job.context,schoolName:school};if(job.rosterSchools.size>1)throw Error('SCHOOL_CONTEXT_CHANGED');}
   if(next.kind==='home'&&page.links.some(l=>l.kind==='gateway'&&l.context?.kind==='selected-teacher-card')){job.pendingSchoolTables=page.tables;page={...page,tables:[]};}
   if(next.kind==='gateway'&&job.pendingSchoolTables.length){page={...page,tables:[...job.pendingSchoolTables,...page.tables]};job.pendingSchoolTables=[];job.gatewaySettleUntil=null;}

   job.warnings.push(...page.warnings);job.warnings=[...new Map(job.warnings.map(w=>[w.category+'|'+w.code,w])).values()];
   if(next.kind==='students'&&page.duplicates)job.warnings.push({category:'students',code:'DUPLICATE_STUDENT_IDENTITY'});
   job.excluded+=(page.excluded??0)+(page.duplicates??0);
   if(page.pagination){
    const p=page.pagination;let series=job.series.get(p.series);
    if(!series){series={total:p.total,last:0,pages:new Set(),gap:false,terminal:false};job.series.set(p.series,series);}
    if(series.total!==null&&p.total!==null&&series.total!==p.total||series.pages.has(p.current)){series.gap=true;job.warnings.push({category:'students',code:'PAGINATION_REPEAT_OR_CHANGED'});}
    if(p.total!==null)series.total=p.total;
    series.pages.add(p.current);series.last=Math.max(series.last,p.current);series.terminal ||= p.terminal&&p.current===p.total;
   }
   for(const skipped of page.skipped??[]){job.skipped.push(skipped.kind);}
   for(const table of page.tables){
    // Student data is admitted only through the safeguarded report/pager reader.
    if(table.category==='students'&&next.kind!=='students')continue;
    try{
     let rows;
     if(table.category==='students'){
      const [header,...lines]=table.text.split('\n');rows=[];
      for(const line of lines){try{rows.push(...parseCategoryTable('students',header+'\n'+line));}catch{job.excluded++;job.warnings.push({category:'students',code:'INVALID_ROWS_EXCLUDED'});}}
     }else rows=parseCategoryTable(table.category,table.text);
     if(table.category==='school'){
      if(job.context?.schoolName&&job.context.schoolName!==rows[0].name)throw Error('SCHOOL_CONTEXT_CHANGED');
      job.context={...job.context,schoolName:rows[0].name};
     }
     if(table.category==='students'){
      job.studentRowsSeen+=rows.length;
      for(const row of rows){
       const bytes=new TextEncoder().encode(JSON.stringify(row)).byteLength+256;
       if(job.sourceBytes+bytes>RUN_LIMITS.sourceBytes){job.memoryFull=true;job.excluded++;job.warnings.push({category:'students',code:'SOURCE_MEMORY_BUDGET'});continue;}
       try{job.sourceRows=appendSourceRows(job.sourceRows,[row]);job.sourceBytes+=bytes;
        if(!job.expires){job.expires=Date.now()+RUN_LIMITS.reviewMilliseconds;}
       }catch(e){job.excluded++;job.warnings.push({category:'students',code:e.message});}
      }
     }else{
      const merged=mergePage(job.categories,table.category,rows);
      for(const c of merged)validateCategory(c.category,c.rows);bundle(merged);job.categories=merged;
     }
    }
    catch(e){if(e.message==='SCHOOL_CONTEXT_CHANGED')throw e;job.warnings.push({category:table.category,code:/^[A-Z_]+$/.test(e.message)?e.message:'UNRESOLVED_CATEGORY'});}
   }
   if(page.rowContinuation!==null&&page.rowContinuation!==undefined)job.routes.unshift({kind:'students',path:next.path,rowOffset:page.rowContinuation});
   if(['home','role','gateway'].includes(next.kind)){job.setupLinks??=[];for(const link of page.links)if(['metadata','classes','timetable'].includes(link.kind)&&!job.setupLinks.some(l=>l.kind===link.kind&&l.path===link.path))job.setupLinks.push({kind:link.kind,path:link.path});}
   for(const link of page.links){
    try{safeRoute(origin,link.path,link.context??job.context);}catch(e){throw e;}
    if(sourcePageSeen(job,origin,link.path)||job.visited.has(routeIdentity(origin,link.path))||job.routes.some(r=>routeIdentity(origin,r.path)===routeIdentity(origin,link.path))){if(link.pagination)job.loops++;continue;}
    if(link.pagination)job.routes.unshift(link);else job.routes.push(link);
   }
   // Process actual report hrefs in page order even when responses settle out of order.
   job.routes.sort((a,b)=>{const page=r=>r.kind==='students'&&/^\/SchoolManagmentReports\//.test(r.path)?Number(new URL(r.path,origin).searchParams.get('page')??1):Infinity;return page(a)-page(b);});
   job.next=job.routes.shift()??null;if(job.next)job.visited.add(routeIdentity(origin,job.next.path));
   if(job.memoryFull){job.remainingReportPages=[job.next,...job.routes].filter(r=>r?.kind==='students'&&/^\/SchoolManagmentReports\//i.test(r.path)).length;job.next=null;job.routes=[];}
   if(!job.next)for(const category of ['teacher','principal','school','classes','timetable']){
    if(job.categories.some(c=>c.category===category)||(category==='school'&&job.context?.schoolName))continue;
    const kind=['teacher','principal','school'].includes(category)?'metadata':category;
    if(!job.warnings.some(w=>w.category===category))job.warnings.push({category,code:job.setupLinks?.some(l=>l.kind===kind)?'SETUP_FIELD_UNAVAILABLE':'SETUP_LINK_UNAVAILABLE'});
   }

}
