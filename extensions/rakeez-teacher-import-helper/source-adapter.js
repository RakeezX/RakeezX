// AI-authored closure-free reader. Explicit run, current visible document only; no transport/storage.
export function readSourceReportPage(mode,runContext=null) {
 const visible=n=>{for(let el=n;el;el=el.parentElement){const s=getComputedStyle(el);if(el.hidden||el.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)return false;}return n.getClientRects().length>0;};
 const text=n=>{const out=[];const walk=x=>{if(x.nodeType===3){out.push(x.textContent);return;}if(x.nodeType!==1||!visible(x)||['INPUT','TEXTAREA','SELECT','SCRIPT','STYLE','IFRAME','SVG','IMG'].includes(x.tagName))return;for(const c of x.childNodes)walk(c);};walk(n);return out.join('').trim().replace(/\s+/g,' ');};
 // Negative active-role guard complements the existing origin/school/session guard, including at export.
 // Role badges only: a principal's metadata name never establishes the current user's role.
 if(mode==='guard'){
  const nonTeacher=new Set(['مدير المدرسة','قائد المدرسة','مديرة المدرسة','قائدة المدرسة','مسؤول النظام','المشرف','الإداري','المدير','ولي الأمر','ولي أمر','الطالب','الطالبة']);
  const active=Array.from(document.querySelectorAll('[aria-current]:not([aria-current=false]),[aria-selected=true],option:checked,[role=status],[data-role]')).filter(visible).map(n=>text(n).replace(/^الدور\s*:?\s*/,''));
  const labelled=Array.from(document.querySelectorAll('p,span,small,div,b,strong,label')).filter(visible).map(text).filter(v=>/^الدور\s*:?\s*/.test(v)).map(v=>v.replace(/^الدور\s*:?\s*/,''));
  return active.concat(labelled).some(v=>nonTeacher.has(v))?{ok:false,code:'NON_TEACHER_ROLE'}:{ok:true};
 }
 const all=Array.from(document.querySelectorAll('table')).filter(visible);
 const diagnostic=(code,ready=false)=>({ok:false,code,retry:ready,incomplete:true,diagnostic:{version:'0.5.1',stage:'source-schema',reason:code,category:mode,schema:{tables:Math.min(all.length,31),expectedCategory:false,unresolved:true}}});
 // A loading/empty table is unresolved, never an empty complete roster.
 const pending=()=>{const d=diagnostic('SOURCE_PENDING',true);if(mode==='students')d.diagnostic.roster={relevant:0,unsupported:0,iframes:Math.min(document.querySelectorAll('iframe').length,31),cause:'TABLE_AWAITING_DATA'};return d;};
 if(all.length>30)return diagnostic('TABLE_LIMIT');
 if(Array.from(document.querySelectorAll('[aria-busy=true],.loading,[role=progressbar]')).some(visible))return pending();
 const rosterLabels=new Set(['بيانات الطلاب','قائمة الطلاب','أسماء الطلاب','طلاب الفصل','قائمة طلاب الفصل','كشف الطلاب']);
 const visibleRoster=all.some(t=>Array.from(t.querySelectorAll('th')).filter(visible).some(n=>['اسم الطالب','اسم الطالبة','اسم الطالب/ة'].includes(text(n)))&&Array.from((t.closest('section,article,.report')??t).querySelectorAll('caption,h1,h2,h3')).filter(visible).some(n=>rosterLabels.has(text(n))));
 if(mode==='students'&&/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(location.pathname)&&!visibleRoster){
  try{globalThis.rakeezRoutePolicy(location.origin,location.href,runContext);}catch(e){return {ok:false,code:e.message};}
  let relevant=0,unsupported=0;
  const links=[];for(const a of Array.from(document.querySelectorAll('a[href]')).filter(visible)){
   if(!rosterLabels.has(text(a)))continue;relevant++;
   // Unknown relevant links are counted, never followed or exposed.
   try{const u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin&&!/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(u.pathname)&&!/^\/SchoolManagment\/Actions\/MyStudents\/?$/i.test(u.pathname)){unsupported++;continue;}}catch{}
   if(a.getAttributeNames().some(k=>/^on/i.test(k))||a.closest('form,[inert],[aria-disabled=true],.disabled')||a.hasAttribute('download')||a.getAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get')return diagnostic('UNSAFE_ROSTER_LINK');
   let u;try{u=new URL(a.getAttribute('href'),location.href);globalThis.rakeezRoutePolicy(location.origin,u.href,runContext);}catch(e){return {ok:false,code:e.message,diagnostic:globalThis.rakeezRouteDiagnostic('link-discovery',e.message,'students',u?.href??a.getAttribute('href'),e.routeDetail)};}
   // A validated menu/self GET is not a roster and is never navigated from this discovery phase.
   if(!/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[a-f0-9]{32}\/?$/i.test(u.pathname))continue;
   const path=u.pathname+u.search;if(!links.some(l=>l.path===path))links.push({kind:'students',path});
  }
  if(!links.length){const d=diagnostic('ROSTER_LINKS_PENDING',true);d.diagnostic.roster={relevant:Math.min(relevant,200),unsupported:Math.min(unsupported,200),iframes:Math.min(document.querySelectorAll('iframe').length,31),cause:unsupported?'RELEVANT_LINK_UNSUPPORTED':'MAIN_FRAME_READ_LINK_ABSENT'};return d;}if(links.length>20)return diagnostic('REPORT_LIMIT');
  return {ok:true,tables:[],links,warnings:[],skipped:[],pagination:null,schoolNames:[]};
 }
 const field=v=>v.length>0&&v.length<=80&&!/[\t\r\n@]/.test(v);
 const names=new Set(['اسم الطالب','اسم الطالبة','اسم الطالب/ة']),classes=new Set(['الفصل','الصف والفصل']);
 const days=new Set(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']);
 const candidates=[];
 for(const table of all){
  if(table.parentElement.closest('table')||table.querySelector('table'))continue;
  const rows=Array.from(table.rows).filter(visible);if(rows.length>301)return diagnostic('ROW_LIMIT');if(rows.length<2)continue;
  const head=Array.from(rows[0].cells);if(head.length>50||!head.every(visible))continue;
  const titles=head.map(text),find=set=>titles.flatMap((v,i)=>set.has(v)?[i]:[]);
  if(mode==='students'){
   const ni=find(names),ci=find(classes),si=find(new Set(['المدرسة','اسم المدرسة'])),schoolNames=[];if(si.length>1)return diagnostic('AMBIGUOUS_SCHOOL_COLUMN');if(!ni.length){if(table.querySelector('td.project-title'))return diagnostic('UNRESOLVED_SOURCE_HEADERS');continue;}if(ni.length!==1||ci.length>1)return diagnostic('AMBIGUOUS_HEADER');
   let context='';if(!ci.length){const scope=table.closest('section,article,.report')??table;const values=Array.from(scope.querySelectorAll('caption,h1,h2,h3')).filter(visible).map(text).filter(v=>/^الفصل: .{2,80}$/.test(v)).map(v=>v.slice(7));if(new Set(values).size!==1)return diagnostic('UNRESOLVED_CLASSROOM');context=values[0];}
   const output=['اسم الطالب\tالفصل'];
   for(const row of rows.slice(1)){
    const cells=Array.from(row.cells);if(cells.length!==head.length||cells.some(c=>c.colSpan!==1||c.rowSpan!==1))return diagnostic('IRREGULAR_TABLE');
    const nameCell=cells[ni[0]],classCell=ci.length?cells[ci[0]]:null;
    if(!visible(nameCell)||classCell&&!visible(classCell))return diagnostic('HIDDEN_SELECTED_CELL');
    const name=text(nameCell),classroom=classCell?text(classCell):context;
    if(!field(name)||/[0-9٠-٩]/.test(name)||!field(classroom))return diagnostic('INVALID_SELECTED_FIELD');
    if(si.length){const cell=cells[si[0]];if(!visible(cell)||!field(text(cell)))return diagnostic('INVALID_SCHOOL_FIELD');schoolNames.push(text(cell));}
    output.push(name+'\t'+classroom);
   }
   const unique=[...new Set(output)];if(unique.length<2)return diagnostic('EMPTY_SOURCE',true);
   if(new Set(schoolNames).size>1)return {ok:false,code:'SCHOOL_CONTEXT_CHANGED'};
   candidates.push({table,text:unique.join('\n'),duplicates:output.length-unique.length,schoolNames:[...new Set(schoolNames)]});
  }else if(mode==='timetable'){
   const output=['اليوم\tالحصة\tالفصل\tالمادة'];
   const ordinals=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة'];
   const periodFor=title=>{const m=/^الحصة (.+)$/.exec(title);if(!m)return null;const token=m[1].replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));if(/^(?:[1-9]|1[0-9]|20)$/.test(token))return token;const i=ordinals.indexOf(token);return i<0?null:String(i+1);};
   if((titles.includes('الحصة')||titles.includes('الوقت'))&&titles.includes('الفصل')&&titles.includes('المادة')&&titles.includes('اليوم')){
    if(new Set(titles).size!==titles.length||head.some(c=>c.colSpan!==1||c.rowSpan!==1))return diagnostic('AMBIGUOUS_HEADER');
    const labels=['اليوم',...(titles.includes('الحصة')?['الحصة']:[]),...(titles.includes('الوقت')?['الوقت']:[]),'الفصل','المادة'];output[0]=labels.join('\t');
    for(const row of rows.slice(1)){const cells=Array.from(row.cells);if(cells.length!==head.length||cells.some(c=>c.colSpan!==1||c.rowSpan!==1))return diagnostic('IRREGULAR_TABLE');const values=labels.map(l=>text(cells[titles.indexOf(l)]));if(!values.every(field)||!days.has(values[0]))return diagnostic('UNRESOLVED_TIMETABLE');output.push(values.join('\t'));}
   }else if(titles.length>1&&titles.slice(1).some(v=>v.startsWith('الحصة '))){
    if(!['','اليوم'].includes(titles[0]))return diagnostic('UNRESOLVED_DAY_HEADER');
    const periods=titles.slice(1).map(periodFor);if(periods.some(v=>v===null))return diagnostic('UNRESOLVED_PERIOD_HEADERS');
    if(head.some(c=>c.colSpan!==1||c.rowSpan!==1)||new Set(periods).size!==periods.length)return diagnostic('AMBIGUOUS_PERIOD');
    // A blank corner is meaningful only with known weekday rows and explicit unique period headers.
    if(rows.slice(1).some(row=>!row.cells.length||!visible(row.cells[0])||!days.has(text(row.cells[0]))))return diagnostic('UNRESOLVED_WEEKDAY');
    for(const row of rows.slice(1)){
     const cells=Array.from(row.cells);if(!cells.length||!days.has(text(cells[0]))||cells[0].colSpan!==1||cells.some(c=>c.rowSpan!==1))return diagnostic('UNRESOLVED_WEEKDAY');
     const weekday=text(cells[0]);let column=1;
     for(const cell of cells.slice(1)){
      const span=cell.colSpan;if(span<1||span>20||column+span>head.length||!visible(cell))return diagnostic('UNSAFE_COLSPAN');
      const cards=Array.from(cell.querySelectorAll('.schedule-card')).filter(visible);
      if(!text(cell)&&!cards.length){column+=span;continue;} // Empty visible slots stay empty.
      let classroom,subject;
      if(cards.length){
       if(cards.length!==1)return diagnostic('AMBIGUOUS_LESSON_CARDS');
       const card=cards[0];if(card.parentElement?.tagName!=='A')return diagnostic('UNRESOLVED_LESSON_CARD');
       // Read data nodes only. The preparation anchor, done class and decorative icon are never used.
       const titleNodes=Array.from(card.querySelectorAll(':scope > .title > h2')).filter(visible),classNodes=Array.from(card.querySelectorAll(':scope > small')).filter(visible);
       if(titleNodes.length!==1)return diagnostic('AMBIGUOUS_LESSON_SUBJECT');if(classNodes.length!==1)return diagnostic('AMBIGUOUS_LESSON_CLASS');
       subject=text(titleNodes[0]);classroom=text(classNodes[0]);
      }else{
       const lines=Array.from(cell.querySelectorAll('p,div,span')).filter(visible).map(text);
       const labelled=label=>[...new Set(lines.filter(v=>v.startsWith(label+': ')).map(v=>v.slice(label.length+2)))];
       const classes=labelled('الفصل'),subjects=labelled('المادة');if(classes.length!==1||subjects.length!==1)return diagnostic('UNRESOLVED_LESSON_LABELS');
       classroom=classes[0];subject=subjects[0];
      }
      if(!field(classroom)||!field(subject))return diagnostic('INVALID_LESSON_FIELD');
      for(let k=0;k<span;k++)output.push([weekday,periods[column+k-1],classroom,subject].join('\t'));
      column+=span;
     }
     if(column!==head.length)return diagnostic('IRREGULAR_TABLE');
    }
   }else continue;
   if(output.length<2)return diagnostic('EMPTY_SOURCE',true);candidates.push({table,text:[...new Set(output)].join('\n'),duplicates:output.length-new Set(output).size});
  }
 }
 if(candidates.length>1)return diagnostic('AMBIGUOUS_TABLE');
 if(!candidates.length)return pending();
 const {table,text:tsv,duplicates,schoolNames=[]}=candidates[0],links=[],warnings=[];
 let pagination=null;
 if(mode==='students'){
  const digits=v=>v.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const number=v=>/^[0-9]{1,2}$/.test(digits(v))?Number(digits(v)):null;
  const now=new URL(location.href),pkeys=['page','pagenumber'];
  const pageOf=u=>{const entries=[...u.searchParams].filter(([k])=>pkeys.includes(k.toLowerCase()));return entries.length===1?number(entries[0][1]):entries.length?NaN:null;};
  const stable=u=>JSON.stringify([...u.searchParams].filter(([k])=>!pkeys.includes(k.toLowerCase())).sort());
  const hrefs=Array.from(document.querySelectorAll('a[href]')).filter(visible);
  const isPage=a=>{try{const u=new URL(a.getAttribute('href'),location.href);if(u.pathname===now.pathname&&pageOf(u)!==null)return true;}catch{}return number(text(a))!==null||a.rel.split(/\s+/).some(r=>['next','last'].includes(r))||['التالي','الصفحة التالية'].includes(text(a));};
  const scopes=new Set(Array.from(document.querySelectorAll('.pagination,[aria-label="Pagination"],[aria-label="ترقيم الصفحات"]')).filter(visible).filter(n=>n.querySelector('[aria-current=page],.active,[role=status]')||Array.from(n.querySelectorAll('a[href]')).some(isPage)));
  // Neutral adjacent controls require a real same-report page href plus active/next/status evidence.
  // A generic nav or an unrelated numeric anchor is never pagination by its label alone.
  for(const a of hrefs){let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{continue;}
   if(u.pathname!==now.pathname||pageOf(u)===null||[...scopes].some(n=>n.contains(a)))continue;
   for(let n=a.parentElement,depth=0;n&&n!==document.body&&depth<4;n=n.parentElement,depth++)if(n.querySelector('[aria-current=page],[role=status],a[rel~=next],a[rel~=last]')){scopes.add(n);break;}
  }
  const pagers=[...scopes].filter(n=>![...scopes].some(c=>c!==n&&n.contains(c)));
  if(pagers.length>4)return diagnostic('AMBIGUOUS_PAGINATION');
  const models=[];
  for(const pager of pagers){
   const nodes=Array.from(pager.querySelectorAll('*')).filter(visible);if(nodes.length>150)return diagnostic('PAGINATION_LIMIT');
   const active=[...new Set(nodes.filter(n=>n.matches('[aria-current=page],.active')).flatMap(n=>{
    if(n.matches('li.page-item.active')){const child=Array.from(n.children).filter(c=>c.matches('a.page-link')&&visible(c));return child.length===1?[number(text(child[0]))]:[null];}
    return [number(text(n))];
   }).filter(n=>n!==null))];
   // Observed Bootstrap endpoint ownership: first disabled arrow is Previous, final is Next.
   const items=Array.from(pager.children),observed=pager.matches('ul.pagination')&&items.length>=3&&items.every(n=>n.matches('li.page-item'))&&items[0].querySelector('svg')&&items.at(-1).querySelector('svg');
   const last=observed?items.at(-1):null,lastAnchor=last?.querySelector('a.page-link');
   const statuses=[...new Set(nodes.map(text).map(digits).filter(v=>/^الصفحة \d+ من \d+$/.test(v)))];
   const status=statuses.length===1?/^الصفحة (\d+) من (\d+)$/.exec(statuses[0]):null;
   const totals=[...new Set([...(status?[Number(status[2])]:[]),...nodes.concat(pager).filter(n=>n.hasAttribute('data-total-pages')).map(n=>number(n.getAttribute('data-total-pages')))])];
   if(statuses.length>1||active.length>1||totals.some(n=>n===null))return diagnostic('AMBIGUOUS_PAGINATION');
   const current=active[0]??(status?Number(status[1]):pageOf(now));
   if(!current||current<1||current>24||pageOf(now)!==null&&pageOf(now)!==current)return diagnostic('PAGINATION_MISMATCH');
   const actual=[],numbers=new Set([current]);let terminal=!!(last?.matches('.disabled,[aria-disabled=true]')&&lastAnchor&&!lastAnchor.hasAttribute('href'));
   for(const n of nodes){
    const disabled=n.matches('[disabled],[aria-disabled=true],.disabled')||n.closest('[aria-disabled=true],.disabled');
    const next=(observed&&n===lastAnchor)||n.rel?.split(/\s+/).includes('next')||['التالي','الصفحة التالية'].includes(text(n));
    if(disabled&&next)terminal=true;
    if(n.tagName!=='A'||!n.hasAttribute('href')||!isPage(n)||disabled)continue;
    let u;try{u=new URL(n.getAttribute('href'),location.href);}catch{return diagnostic('UNSAFE_PAGINATION');}
    if(u.origin!==now.origin||u.username||u.password)return {ok:false,code:'ORIGIN_CHANGED'};
    if(n.closest('form')||n.hasAttribute('download')||n.getAttribute('data-method')&&n.getAttribute('data-method').toLowerCase()!=='get'||u.pathname!==now.pathname||/(?:delete|grade|admin|edit|attendance|changeusertype)/i.test(u.pathname))return diagnostic('UNSAFE_PAGINATION');
    const keys=new Set();for(const [key,value] of u.searchParams){if(keys.has(key.toLowerCase())||!/^(?:page|pagenumber|classid|sectionid|id)$/i.test(key)||! /^[A-Za-z0-9_-]{1,80}$/.test(value))return diagnostic('UNSAFE_PAGINATION');keys.add(key.toLowerCase());}
    const page=pageOf(u);if(page>24)return {...diagnostic('SOURCE_PAGE_LIMIT'),observedRows:tsv.split('\n').length-1};
    if(!page||stable(u)!==stable(now))return diagnostic('PAGINATION_MISMATCH');
    const label=number(text(n));if(label!==null&&label!==page||next&&page!==current+1)return diagnostic('PAGINATION_MISMATCH');
    numbers.add(page);if(n.rel.split(/\s+/).includes('last'))totals.push(page);
    actual.push({page,path:u.pathname+u.search});
   }
   const distinctTotals=[...new Set(totals)];if(distinctTotals.length>1)return diagnostic('PAGINATION_MISMATCH');
   const total=distinctTotals[0]??(terminal?current:null);
   if(total!==null&&total>24)return {...diagnostic('SOURCE_PAGE_LIMIT'),observedRows:tsv.split('\n').length-1};
   if(total!==null&&(total<current||[...numbers].some(n=>n>total)))return diagnostic('PAGINATION_MISMATCH');
   if(terminal&&total!==current)return diagnostic('PAGINATION_MISMATCH');
   const next=[...new Set(actual.filter(a=>a.page===current+1).map(a=>a.path))];
   // Every candidate here has the same validated report/filter/page semantics. Retain an existing href.

   // Unknown end is not success: carry the series until an explicit terminal proves its end.
   const model={current,total,next:next[0]??null,terminal,numbers:[...numbers].sort((a,b)=>a-b),actual:[...new Set(actual.map(a=>a.path))].sort()};
   models.push(model);
  }
  if(models.length){
   const currents=new Set(models.map(m=>m.current)),totals=new Set(models.map(m=>m.total).filter(n=>n!==null));
   if(currents.size!==1||totals.size>1)return diagnostic('AMBIGUOUS_PAGINATION');
   const nexts=models.flatMap(m=>m.next?[m.next]:[]),nextIdentities=new Set(nexts.map(p=>{const u=new URL(p,location.href);return u.pathname+'?'+stable(u)+'#'+pageOf(u);}));
   if(nextIdentities.size>1)return diagnostic('AMBIGUOUS_PAGINATION');
   const current=[...currents][0],total=totals.size?[...totals][0]:null,terminal=models.some(m=>m.terminal),numbers=new Set(models.flatMap(m=>m.numbers));
   if(terminal&&nexts.length||total!==null&&(total<current||[...numbers].some(n=>n>total))||terminal&&total!==current)return diagnostic('AMBIGUOUS_PAGINATION');
   const m={current,total,terminal,next:nexts[0]??null};pagination={current,total,terminal,series:now.pathname+'?'+stable(now)};

   if(m.total===m.current){if(!m.terminal)warnings.push({category:mode,code:'PAGINATION_TERMINAL_UNVERIFIED'});if(m.next)warnings.push({category:mode,code:'PAGINATION_AFTER_END'});}
   else if(!m.next)warnings.push({category:mode,code:'PAGINATION_MISSING_NEXT'});
   else links.push({kind:mode,path:m.next,pagination:true});
  }else if(mode==='students')warnings.push({category:mode,code:'PAGINATION_UNVERIFIED'});
 }
 return {ok:true,tables:[{category:mode,text:tsv}],links,warnings,skipped:[],pagination,duplicates,schoolNames};
}
