// Serializable, closure-free function. Injected in ISOLATED world only on popup click.
// Generic semantic HTML table handling; no private portal selectors or DOM claims.
export function readSelectedNameColumn() {
  const failure = code => ({ ok: false, code });
  const noor = location.hostname === 'noor.moe.gov.sa' && location.pathname.startsWith('/Noor/') && !/(?:login|signin|logout|oauth)/i.test(location.pathname);
  if (location.protocol !== 'https:' || location.port || !(noor || ['madrasati.moe.gov.sa', 'madrasatibeta.moe.gov.sa'].includes(location.hostname))) return failure('UNSUPPORTED_ORIGIN');
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return failure('CANCELLED');
  const cellFor = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest('th,td');
  const header = cellFor(selection.anchorNode);
  if (!header || header !== cellFor(selection.focusNode)) return failure('SELECT_HEADER_ONLY');
  const title = header.textContent.trim().replace(/\s+/g, ' ');
  if (!['اسم الطالب', 'اسم الطالبة', 'اسم الطالب/ة'].includes(title)) return failure('AMBIGUOUS_HEADER');
  const table = header.closest('table');
  if (!table || table.parentElement?.closest('table') || table.querySelector('table')) return failure('NESTED_TABLE');
  const rows = Array.from(table.rows);
  if (rows.length < 2 || rows.length > 301 || rows[0] !== header.parentElement) return failure('UNSUPPORTED_LAYOUT');
  const visible = node => {
    for (let el = node; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (el.hidden || el.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    return node.getClientRects().length > 0;
  };
  const width = rows[0].cells.length, column = header.cellIndex;
  if (!width || width > 50 || column < 0 || column >= width) return failure('UNSUPPORTED_LAYOUT');
  const values = [];
  let hiddenRows = 0;
  for (const row of rows) {
    if (row.cells.length !== width || Array.from(row.cells).some(cell => cell.colSpan !== 1 || cell.rowSpan !== 1)) return failure('MERGED_OR_IRREGULAR');
    if (!visible(row)) { if (row === rows[0]) return failure('HIDDEN_HEADER'); hiddenRows++; continue; }
    const cell = row.cells[column];
    // Reject hidden children or markup in the name cell. Never read other cell text.
    if (!visible(cell) || cell.children.length) return failure('UNSUPPORTED_NAME_CELL');
    if (row !== rows[0]) {
      const value = cell.textContent;
      if (value.length > 500) return failure('LIMIT');
      values.push(value);
    }
  }
  return { ok: true, values, hiddenRows };
}

// Closure-free addition: explicit category, selected header, visible allowlisted cells only.
// Loopback supports the private synthetic fixture; no URL is returned in provenance.
export function readSelectedCategoryTable(category) {
  const fail=code=>({ok:false,code});
  const official=location.protocol==='https:'&&!location.port&&['madrasati.moe.gov.sa','madrasatibeta.moe.gov.sa'].includes(location.hostname);
  const local=['http:','https:'].includes(location.protocol)&&['127.0.0.1','localhost','[::1]'].includes(location.hostname);
  if(!official&&!local)return fail('UNSUPPORTED_ORIGIN');
  const specs={department:['إدارة التعليم'],teacher:['اسم المعلم'],school:['اسم المدرسة'],principal:['اسم المدير'],classes:['الفصل','المادة'],students:['اسم الطالب','الفصل'],timetable:['اليوم','الحصة','الوقت','الفصل','المادة']};
  const labels=specs[category];if(!labels)return fail('UNKNOWN_CATEGORY');
  const s=getSelection();if(!s||s.isCollapsed||s.rangeCount!==1)return fail('CANCELLED');
  const cell=node=>(node?.nodeType===1?node:node?.parentElement)?.closest('th,td');
  const header=cell(s.anchorNode);if(!header||header!==cell(s.focusNode))return fail('SELECT_HEADER_ONLY');
  const table=header.closest('table');if(!table||table.parentElement?.closest('table')||table.querySelector('table'))return fail('NESTED_TABLE');
  const visible=node=>{
    for(let el=node;el;el=el.parentElement){const css=getComputedStyle(el);if(el.hidden||el.getAttribute('aria-hidden')==='true'||css.display==='none'||css.visibility!=='visible'||Number(css.opacity)===0)return false;}
    return node.getClientRects().length>0;
  };
  const plain=node=>visible(node)&&!node.children.length;
  if(!plain(header)||header.textContent.trim().replace(/\s+/g,' ')!==labels[0])return fail('UNRESOLVED_ROLE_OR_HEADER');
  const rows=Array.from(table.rows);if(rows.length>301||!rows.length)return fail('LIMIT');
  if(['teacher','school','principal'].includes(category)){
    const row=header.parentElement;
    if(row.cells.length!==2||header.cellIndex!==0||Array.from(row.cells).some(c=>c.colSpan!==1||c.rowSpan!==1)||!plain(row.cells[1]))return fail('UNRESOLVED_ROLE_LABEL');
    const value=row.cells[1].textContent;if(value.length>80)return fail('LIMIT');
    return {ok:true,text:labels[0]+'\t'+value};
  }
  if(rows[0]!==header.parentElement||rows.length<2)return fail('SELECT_HEADER_ONLY');
  const first=Array.from(rows[0].cells);if(!first.length||first.length>50||first.some(c=>!plain(c)))return fail('UNSUPPORTED_LAYOUT');
  const headings=first.map(c=>c.textContent.trim().replace(/\s+/g,' '));
  const columns=[];
  for(const label of labels){
    const indices=headings.flatMap((h,i)=>h===label?[i]:[]);
    if(indices.length>1)return fail('AMBIGUOUS_HEADER');
    if(!indices.length){if(category==='timetable'&&['الحصة','الوقت'].includes(label)||category==='classes'&&label==='المادة')continue;return fail('UNRESOLVED_MAPPING');}
    columns.push({label,index:indices[0]});
  }
  const output=[columns.map(c=>c.label).join('\t')];
  for(const row of rows){
    if(row.cells.length!==first.length||Array.from(row.cells).some(c=>c.colSpan!==1||c.rowSpan!==1))return fail('MERGED_OR_IRREGULAR');
    if(row===rows[0]||!visible(row))continue;
    const values=[];
    for(const {index} of columns){const c=row.cells[index];if(!plain(c))return fail('UNSUPPORTED_VISIBLE_CELL');const v=c.textContent;if(v.length>80||/[\t\r\n]/.test(v))return fail('INVALID_FIELD');values.push(v);}
    output.push(values.join('\t'));
  }
  return {ok:true,text:output.join('\n')};
}

// Closure-free automatic reader. Invoked only by an explicit bounded run, not at startup.
export function readAutomaticTeacherPage(mode='home',selectedSchool=null,runContext=null,source=null) {
  const document=source?.document??globalThis.document,location=source?new URL(source.url):globalThis.location,body=document.body??document;
  const fail=code=>({ok:false,code});
  const text=n=>n.textContent.trim().replace(/\s+/g,' ');
  // AI: invocation-local ancestor visibility. Layout rects belong only to the
  // requested node: a zero-rect ancestor must not hide a visible descendant.
  // No cache survives this synchronous read or any subsequent DOM mutation.
  const ancestry=new WeakMap(),visibility=new WeakMap();
  const visible=n=>{
    if(visibility.has(n))return visibility.get(n);
    const path=[];let el=n;
    while(el&&!ancestry.has(el)){path.push(el);el=el.parentElement;}
    let shown=el?ancestry.get(el):true;
    for(const node of path.reverse()){
      if(shown){const css=source?node.style:getComputedStyle(node);shown=!(node.matches('[inert],.hidden,.d-none,.sr-only')||node.hidden||node.getAttribute('aria-hidden')==='true'||css.display==='none'||(source?css.visibility==='hidden':css.visibility!=='visible')||(css.opacity!==''&&Number(css.opacity)===0));}
      ancestry.set(node,shown);
    }
    const result=shown&&(source?true:n.getClientRects().length>0);visibility.set(n,result);return result;
  };
  const plain=n=>visible(n)&&!n.querySelector('input,textarea,button,a,iframe,table,script,style')&&Array.from(n.querySelectorAll('*')).every(visible);
  const login=/\b(?:login|signin|logout|oauth)\b/i.test(location.pathname)||Array.from(document.querySelectorAll('input[type=password]')).some(visible)||Array.from(document.querySelectorAll('h1,h2,[role=heading]')).some(n=>visible(n)&&['تسجيل الدخول','انتهت الجلسة','رمز التحقق','تم تعطيل الحساب','تم حذف الحساب','الحساب غير نشط','Sign in','Login'].includes(text(n)));
  if(login)return fail('LOGIN_OR_LOGOUT');
  // Role text excludes decorative/hidden descendants, never exports the greeting/name.
  const rawRoleText=new WeakMap(),roleTexts=new WeakMap();
  const roleRaw=el=>{
    if(rawRoleText.has(el))return rawRoleText.get(el);
    let value='';
    if(el.nodeType===3)value=el.textContent;
    else if(el.nodeType===1&&visible(el)&&!['SVG','IMG','SCRIPT','STYLE'].includes(el.tagName))for(const child of el.childNodes)value+=roleRaw(child);
    rawRoleText.set(el,value);return value;
  };
  const roleText=n=>{
    if(!roleTexts.has(n))roleTexts.set(n,roleRaw(n).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,'').replace(/\s*[:：]\s*/g,': ').trim().replace(/\s+/g,' '));
    return roleTexts.get(n);
  };
  const teacher=['معلم','معلمة','المعلم','المعلمة','دور المعلم','دور المعلمة','واجهة المعلم','واجهة المعلمة'];
  const admin=['مدير المدرسة','مديرة المدرسة','قائد المدرسة','قائدة المدرسة','المشرف','المشرفة','الإداري','الإدارية','المدير','المديرة'];
  const cardSelector='article,section,li,fieldset,.card,.panel,.school-card';
  const entryPath=/^\/(?:SchoolManagment\/Actions\/Teacher\/[^/]+|Dashboards\/Schools)\/?$/i.test(location.pathname);
  const roleValuesCache=new WeakMap(),homeTextCache=new WeakMap();
  const homesIn=scope=>{if(!homeTextCache.has(scope))homeTextCache.set(scope,Array.from(scope.querySelectorAll('a[href]')).filter(visible).filter(a=>roleText(a)==='الصفحة الرئيسية'));return homeTextCache.get(scope);};
  const roleValuesIn=scope=>{if(!roleValuesCache.has(scope))roleValuesCache.set(scope,[...new Set(Array.from(scope.querySelectorAll('p,span,div,li,dt,strong,b,label')).filter(visible).map(roleText).map(v=>/^الدور\s*:?\s*(.+)$/.exec(v)?.[1]).filter(v=>[...teacher,...admin,'ولي الأمر','ولي أمر','الطالب','الطالبة'].includes(v)))]);return roleValuesCache.get(scope);};
  // Lowest shared scope is bounded by semantics, never an invented CSS card class.
  const cardFor=n=>{
    if(!entryPath)return n.closest(cardSelector);
    for(let scope=n.parentElement,depth=0;scope&&depth<12;scope=scope.parentElement,depth++){
      const homes=homesIn(scope);
      if(homes.length>1)return null;if(homes.length!==1||roleValuesIn(scope).length!==1)continue;
      const headings=[...new Set(Array.from(scope.querySelectorAll('h2,h3,h4,h5')).filter(visible).map(roleText).filter(v=>v.length>1&&v.length<=80&&!['قائمة المدارس','قائمة الأبناء','مدارس الأبناء'].includes(v)))];
      const schoolLabels=Array.from(scope.querySelectorAll('p,span,b,strong,dt,label')).filter(visible).map(roleText);
      const hints=['من نور','نوع المدرسة','المراحل الدراسية','قادة المدرسة'].filter(label=>schoolLabels.some(v=>v===label||v.startsWith(label+':'))).length;
      if(headings.length>1)return null;
      if(headings.length===1||schoolLabels.some(v=>/^اسم المدرسة: .{2,80}$/.test(v))||hints>=2)return scope;
    }return null;
  };
  const active=Array.from(document.querySelectorAll('[aria-current]:not([aria-current=false]),[aria-selected=true],option:checked,[role=status],[data-role]')).filter(visible).filter(n=>!cardFor(n)?.querySelector('a[href]')||!Array.from(cardFor(n).querySelectorAll('a[href]')).some(a=>roleText(a)==='الصفحة الرئيسية')).map(n=>roleText(n).replace(/^الدور\s*:?\s*/,''));
  const activeTeacher=active.filter(v=>teacher.includes(v));
  const greetingNodes=Array.from(document.querySelectorAll('a,span,div,p,li,small')).filter(visible).filter(n=>{const v=roleText(n);return v.length<90&&!teacher.includes(v)&&/^.{2,80}\s(?:معلم|معلمة)$/.test(v)&&!n.querySelector('input,textarea,iframe,table');});
  const greetings=[...new Set(greetingNodes.filter(n=>!greetingNodes.some(child=>child!==n&&n.contains(child))).map(roleText))];
  // A principal label/value is metadata, not an active user role. Explicit role/greeting conflicts remain stops.
  const adminConflict=active.some(v=>admin.includes(v)||['ولي الأمر','ولي أمر','الطالب','الطالبة'].includes(v))||Array.from(document.querySelectorAll('p,span,small,div,b,strong,label')).filter(visible).some(n=>{const v=roleText(n);return !Array.from(cardFor(n)?.querySelectorAll('a[href]')??[]).some(a=>roleText(a)==='الصفحة الرئيسية')&&/^الدور\s*:?\s*/.test(v)&&[...admin,'ولي الأمر','ولي أمر','الطالب','الطالبة'].includes(v.replace(/^الدور\s*:?\s*/,''));});
  const validValue=v=>v.length>1&&v.length<=80&&!/[\t\r\n@]|https?:/i.test(v);
  const labelValues=(scope,labels)=>{
    const values=[];for(const n of Array.from(scope.querySelectorAll('dt,p,li,div,span,strong,b,label')).filter(visible)){
      const v=roleText(n),label=labels.find(l=>v===l||v===l+':'||v.startsWith(l+': '));if(!label)continue;
      let value=v.startsWith(label+': ')?v.slice(label.length+2):'';
      if(!value){const sibling=n.nextElementSibling;if(sibling&&visible(sibling)&&!sibling.querySelector('a,input,button,table,iframe'))value=roleText(sibling);}
      if(validValue(value))values.push(value);
    }return [...new Set(values)];
  };
  // Exact SchoolDashboard leader label; read only visible name text, never hrefs.
  const dashboardLeaders=scope=>{
    if(!/^\/Dashboards\/Schools\/?$/i.test(location.pathname))return [];
    const values=[];
    for(const n of Array.from(scope.querySelectorAll('dt,p,li,div,span,strong,b,label')).filter(visible)){
      if(!['قادة المدرسة','قادة المدرسة:'].includes(roleText(n)))continue;
      const sibling=n.nextElementSibling;
      if(!sibling||!visible(sibling)||sibling.querySelector('input,textarea,button,iframe,table,script,style'))continue;
      const leaves=Array.from(sibling.querySelectorAll('a,span,li,p,div')).filter(visible).filter(el=>!Array.from(el.querySelectorAll('a,span,li,p,div')).some(visible));
      for(const v of (leaves.length?leaves.map(roleText):[roleText(sibling)]))if(validValue(v)&&/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(v))values.push(v);
    }return [...new Set(values)];
  };
  const metadata=(scope,selectedCard=false)=>{
    const result=[];const school=labelValues(scope,['اسم المدرسة']);
    for(const value of labelValues(scope,['إدارة التعليم','الإدارة التعليمية','إدارة التعليم التابعة لها المدرسة']))result.push({category:'department',text:'إدارة التعليم\t'+value});
    if(!school.length){const named=Array.from(scope.querySelectorAll('.school-name')).filter(visible).map(roleText).filter(validValue);if(new Set(named).size===1)school.push(named[0]);}
    if(selectedCard&&!school.length){const titles=Array.from(scope.querySelectorAll('h2,h3,h4,h5')).filter(visible).map(roleText).filter(v=>validValue(v)&&!/^مرحبا بك /.test(v));if(new Set(titles).size===1)school.push(titles[0]);}
    for(const [category,values] of [['school',school],['principal',[...new Set([...labelValues(scope,['قادة المدرسة','مدير المدرسة','قائد المدرسة','اسم المدير']),...dashboardLeaders(scope)])]]])for(const value of values)result.push({category,text:(category==='school'?'اسم المدرسة':'اسم المدير')+'\t'+value});
    return result;
  };
  const observedSchoolIds=[...new Set(Array.from(document.querySelectorAll('a[href]')).filter(visible).filter(a=>!a.getAttributeNames().some(k=>/^on/i.test(k))&&!a.closest('form,[inert],[disabled],[aria-disabled=true],.disabled')&&!a.hasAttribute('download')&&(!a.getAttribute('data-method')||a.getAttribute('data-method').toLowerCase()==='get')).flatMap(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return !u.hash&&!u.username&&!u.password&&u.origin===location.origin&&/^\/(?:SchoolManagment\/Actions\/MyStudents|SchoolSchedule\/Schedule\/TeacherSchedule)\/?$/i.test(u.pathname)&&[...u.searchParams].length===1&&/^[a-f0-9]{32}$/i.test(u.searchParams.get('SchoolId')??'')?[u.searchParams.get('SchoolId').toLowerCase()]:[];}catch{return [];}}))];
  // A role-target ID is not assumed to equal SchoolId. Bind the latter from coherent actual read links.
  const routeContext=runContext?.schoolId?runContext:observedSchoolIds.length===1?{...runContext,schoolId:observedSchoolIds[0]}:runContext;
  const linkStats={href:0,empty:0,javascript:0,queryRejected:0,inlineHandler:0,readPath:0,originRejected:0,formRejected:0};
  const counted=new Map(Object.keys(linkStats).map(k=>[k,new WeakSet()]));
  const count=(key,a)=>{if(!counted.get(key).has(a)){counted.get(key).add(a);linkStats[key]=Math.min(linkStats[key]+1,200);}};
  const knownRead=u=>/^\/(?:SchoolManagment\/Actions\/MyStudents|SchoolSchedule\/Schedule\/TeacherSchedule)\/?$/i.test(u.pathname)||/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[^/]+\/?$/i.test(u.pathname)||/^\/TeachersReports\/(?:Statistics\/)?(?:MyInfo|TeacherSchedule|Teacher|ClassStudentInfo)\/[^/]+\/?$/i.test(u.pathname);
  const knownEntry=u=>/^\/Dashboards\/Schools\/ChangeUserTypeToTeacherFromParent\/[a-f0-9]{32}\/?$/i.test(u.pathname)||/^\/(?:SchoolManagment\/Actions\/Teacher\/[^/]+|Dashboards\/Schools)\/?$/i.test(u.pathname);
  const validateAnchor=(a,kind='read',context=routeContext)=>{
    count('href',a);const raw=a.getAttribute('href');let u,code='',detail='unexpected-path';
    if(a.hasAttribute('onclick'))count('inlineHandler',a); // Presence only; never read/evaluate/click a handler.
    if(!raw?.trim()){count('empty',a);code='EMPTY_READ_HREF';detail='empty-href';}
    if(/^\s*javascript:/i.test(raw??'')){count('javascript',a);code='JAVASCRIPT_HREF';detail='javascript-href';}
    if(a.closest('form')){count('formRejected',a);code='FORM_LINK_REJECTED';}
    if(a.matches('[disabled],[aria-disabled=true],.disabled')||a.closest('[inert],[aria-disabled=true]')||a.hasAttribute('download')||(a.getAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get'))code='UNSAFE_LINK';
    try{u=new URL(raw,location.href);}catch{code='UNSAFE_LINK';}
    if(u&&knownRead(u))count('readPath',a);
    if(u&&!['http:','https:'].includes(u.protocol)){if(code!=='JAVASCRIPT_HREF')code='UNSAFE_LINK';}
    else if(u&&(u.origin!==location.origin||u.username||u.password)){count('originRejected',a);code='ORIGIN_CHANGED';}
    if(!code)try{globalThis.rakeezRoutePolicy(location.origin,u.href,context);}catch(e){code=e.message;detail=e.routeDetail??'unexpected-path';if(['unknown-key','empty-allowed-value','invalid-allowed-value','duplicate-key'].includes(detail))count('queryRejected',a);}
    if(!code&&kind==='read'&&!knownRead(u))code='UNOBSERVED_READ_PATH';
    if(!code&&kind==='entry'&&!knownEntry(u))code='UNSAFE_ROUTE';
    if(!code&&kind==='role'&&a.hasAttribute('onclick')&&!knownEntry(u))code='UNSAFE_LINK';
    if(a.closest('form'))detail='form';else if(a.hasAttribute('download'))detail='download';else if(a.matches('[disabled],[aria-disabled=true],.disabled')||a.closest('[aria-disabled=true],.disabled'))detail='disabled';else if(a.getAttribute('data-method')&&a.getAttribute('data-method').toLowerCase()!=='get')detail='non-get';else if(code==='ORIGIN_CHANGED')detail='origin';
    return {u,code,diagnostic:code&&mode!=='guard'?globalThis.rakeezRouteDiagnostic('link-discovery',code,kind,raw??'',detail):null};
  };
  const cards=[];let gatewayRejected=0,gatewayDiagnostic=null;
  if(mode==='home')for(const a of Array.from(document.querySelectorAll('a[href]')).filter(visible).filter(a=>roleText(a)==='الصفحة الرئيسية')){
    const card=cardFor(a);if(!card)continue;
    const roleValues=roleValuesIn(card);if(roleValues.length!==1||!teacher.includes(roleValues[0]))continue;
    const homes=Array.from(card.querySelectorAll('a[href]')).filter(visible).filter(n=>cardFor(n)===card&&roleText(n)==='الصفحة الرئيسية');
    let raw;try{raw=new URL(a.getAttribute('href'),location.href);}catch{}
    const transition=raw&&/^\/Dashboards\/Schools\/ChangeUserTypeToTeacherFromParent\/([a-f0-9]{32})\/?$/i.exec(raw.pathname);
    const cardContext=transition?{kind:'selected-teacher-card',href:raw.pathname+raw.search,roleTargetId:transition[1].toLowerCase()}:null;
    const {u,code,diagnostic}=validateAnchor(a,'entry',cardContext);if(code||homes.length!==1||!u||!knownEntry(u)){gatewayRejected++;gatewayDiagnostic??=diagnostic??globalThis.rakeezRouteDiagnostic('link-discovery','UNSAFE_LINK','role',a.getAttribute('href'),'ambiguous-home');continue;}

    const path=u.pathname+u.search;
    const tables=metadata(card,true),label=tables.find(t=>t.category==='school')?.text.split('\t')[1]??'مدرسة '+(cards.length+1);if(!cards.some(c=>c.path===path&&c.label===label))cards.push({path,label,tables,context:cardContext?{...cardContext,schoolName:tables.find(t=>t.category==='school')?.text.split('\t')[1]}:null});
  }
  const dashboards=[];
  const controls=Array.from(document.querySelectorAll('a[href],button,[role=tab],[role=menuitem]')).filter(visible);
  if(controls.length>200)return fail('PAGE_LIMIT');
  const matching=label=>controls.filter(n=>roleText(n)===label);
  const safeRead=label=>matching(label).filter(n=>n.tagName==='A'&&!validateAnchor(n).code);
  const navMarkers=['قائمة الطلاب','سجلات المتابعة اليومية'].filter(l=>matching(l).length>0).length;
  const actionMarkers=['الجدول الدراسي','سجلات متابعة الفصول','تقارير المعلم'].filter(l=>matching(l).length>0).length;
  const readTargets=[...new Set([...safeRead('قائمة الطلاب'),...safeRead('الجدول الدراسي')].map(a=>{const u=new URL(a.href);return u.pathname+u.search;}))];
  const coherent=labels=>matching(labels[0]).some(first=>{
    for(let scope=first.parentElement,depth=0;scope&&scope!==body&&depth<12;scope=scope.parentElement,depth++)if(labels.every(label=>matching(label).some(n=>scope.contains(n))))return true;return false;
  });
  const semanticDashboard=entryPath&&navMarkers===2&&actionMarkers>=2&&coherent(['قائمة الطلاب','سجلات المتابعة اليومية'])&&(coherent(['الجدول الدراسي','سجلات متابعة الفصول'])||coherent(['الجدول الدراسي','تقارير المعلم']));
  if(semanticDashboard)dashboards.push(body);
  const dashboard=semanticDashboard;
  // AI: structural role proof is confined to the complete, bound live dashboard.
  const semanticControls=!source&&dashboard&&['قائمة الطلاب','الجدول الدراسي'].every(label=>matching(label).length===1&&safeRead(label).length===1&&!matching(label)[0].hasAttribute('onclick'));
  const busy=Array.from(document.querySelectorAll('[aria-busy=true],.loading,[role=progressbar]')).some(visible);
  const semanticRoleProof=semanticControls&&document.readyState==='complete'&&!busy;
  const roleProofKind=activeTeacher.length?'active-role':greetings.length===1?'greeting':semanticRoleProof?'semantic-dashboard':'none';
  const proofDiagnostic={entryKind:cards.length?'teacher-gateway':dashboard?'teacher-dashboard':'unresolved-entry',roleProofKind,proofNavMarkers:Math.min(navMarkers,2),proofActionMarkers:Math.min(actionMarkers,3),proofReadLinks:Math.min(readTargets.length,20),schoolBindingState:runContext?.schoolBinding??'none',schoolBadgePresent:labelValues(body,['اسم المدرسة']).length>0||Array.from(document.querySelectorAll('.school-name')).filter(visible).map(roleText).some(validValue),schoolIdPresent:observedSchoolIds.length===1,readProofPresent:!!runContext?.readProof};
  const entry={pageKind:cards.length||gatewayRejected?'teacher-gateway':dashboard?'teacher-dashboard':'unresolved-entry',readyState:document.readyState,roleMarkers:Math.min(roleValuesIn(body).length,10),schoolOptions:Math.min(cards.length,20),navMarkers,actionMarkers,safeReadLinks:Math.min(readTargets.length,20),iframeCount:Math.min(document.querySelectorAll('iframe').length,20),linkStats};
  let safeReportLinks=0,explicitRoles=0;
  const roleFail=(code,stage='role-selection')=>({...fail(code),diagnostic:{version:'0.4.5',stage,reason:code,category:'role',entry},proofDiagnostic});
  if(adminConflict)return roleFail('NON_TEACHER_ROLE');
  if(runContext?.schoolId&&observedSchoolIds.some(id=>id!==runContext.schoolId.toLowerCase()))return roleFail('SCHOOL_CONTEXT_CHANGED');
  if(observedSchoolIds.length>1)return roleFail('SCHOOL_CONTEXT_CHANGED');
  // Compare only explicitly labelled/badged school values, never a generic report heading.
  const schoolBadges=[...new Set([...labelValues(body,['اسم المدرسة']),...Array.from(document.querySelectorAll('.school-name')).filter(visible).map(roleText).filter(validValue)])];
  if(schoolBadges.length>1)return roleFail('SCHOOL_CONTEXT_CHANGED');
  const shownSchool=schoolBadges[0];
  if(runContext?.schoolName&&shownSchool&&runContext.schoolName!==shownSchool)return roleFail('SCHOOL_CONTEXT_CHANGED');
  if(mode==='gateway'&&entryPath&&(document.readyState!=='complete'||Array.from(document.querySelectorAll('[aria-busy=true],.loading,[role=progressbar]')).some(visible)))return {...roleFail('ENTRY_PENDING'),retry:true};
  // AI: optional MyStudents timeout requires positive teacher + selected school
  // evidence in this document, not merely absence of an administrator badge.
  // AI: proof belongs to this live teacher document, never to a badge-less fetched menu.
  const welcomeCandidates=dashboard?Array.from(body.querySelectorAll('p,span,h1,h2,h3')).filter(visible).filter(n=>!Array.from(n.children).some(child=>/^مرحبا بك /.test(roleText(child)))).map(roleText).filter(v=>/^مرحبا بك /.test(v)):[];
  const welcomeNames=[...new Set(welcomeCandidates.map(v=>v.slice('مرحبا بك '.length)).filter(v=>validValue(v)&&!/[0-9٠-٩]/.test(v)))];
  // AI: bind identity and exact read targets, not optional control multiplicity.
  // Structural coherence/unique safe primary links are still required on every
  // read. Fragments follow the existing same-document route policy; queries do not.
  const currentTeacherProof=()=>JSON.stringify({url:location.origin+location.pathname+location.search,school:shownSchool,schoolId:observedSchoolIds[0],semantic:semanticControls?{readTargets:[...readTargets].sort()}:null,roles:[...new Set(activeTeacher)].sort(),greetings,teacher:[...new Set([...labelValues(body,['اسم المعلم','اسم المعلمة']),...welcomeNames])].sort()});
  const mismatch=()=>{
    try{const expected=JSON.parse(runContext.readProof),current=JSON.parse(currentTeacherProof());
      for(const [key,category] of [['url','route'],['school','school'],['schoolId','school'],['roles','role'],['greetings','role'],['teacher','teacher'],['semantic','presentation']])if(JSON.stringify(expected[key])!==JSON.stringify(current[key]))return category;
      return 'none';
    }catch{return 'invalid-proof';}
  };
  if(mode==='read-proof'||mode==='read-proof-settle'){
    if(!entryPath||document.readyState!=='complete'||document.querySelector('input[type=password],form[action*="Login" i]'))return roleFail('LOGIN_OR_LOGOUT');
    if(greetings.length>1)return roleFail('AMBIGUOUS_ROLE');
    if(!runContext?.schoolId||observedSchoolIds.length!==1)return roleFail('SCHOOL_CONTEXT_UNCONFIRMED');
    if(observedSchoolIds[0]!==runContext.schoolId.toLowerCase()||shownSchool&&runContext.schoolName&&shownSchool!==runContext.schoolName)return roleFail('SCHOOL_CONTEXT_CHANGED');
    // AI: only the owned canonical return may wait for animated semantic
    // controls. Every non-semantic identity field must already match. Never
    // retry an observed teacher/school/role/login change as a loading state.
    if(mode==='read-proof-settle'&&runContext.readProof){
      try{const expected=JSON.parse(runContext.readProof),current=JSON.parse(currentTeacherProof()),semantic=expected.semantic;delete expected.semantic;delete current.semantic;
        if(semantic&&JSON.stringify(expected)===JSON.stringify(current)&&runContext.readProof!==currentTeacherProof())return {...roleFail('SOURCE_PENDING'),retry:true};
      }catch{return roleFail('TEACHER_CONTEXT_CHANGED');}
    }
    // A transient busy marker is not an identity change. Wait without reading
    // only while positive teacher/school identity AND all structural read proof
    // remain equal. Missing identity or a changed role never enters this wait.
    if(busy&&runContext.readProof){
      const current=JSON.parse(currentTeacherProof());
      if(mismatch()==='none'&&current.teacher.length&&shownSchool&&semanticControls)return {...roleFail('SOURCE_PENDING'),retry:true};
    }
    if(!activeTeacher.length&&greetings.length!==1&&!semanticRoleProof)return roleFail('UNCONFIRMED_TEACHER_ROLE');
    if((!shownSchool||!activeTeacher.length&&greetings.length!==1)&&!runContext.readProof)return roleFail('UNCONFIRMED_TEACHER_ROLE');
    const proof=currentTeacherProof();
    if(runContext.readProof&&runContext.readProof!==proof){proofDiagnostic.proofMismatch=mismatch();return roleFail('TEACHER_CONTEXT_CHANGED');}
    globalThis.rakeezTeacherReadGuard=()=>readAutomaticTeacherPage('read-proof',null,{...runContext,readProof:proof});
    globalThis.rakeezTeacherReadGuard.jobId=runContext.readJobId;
    globalThis.rakeezSetupPageReader=(kind,context,input)=>readAutomaticTeacherPage(kind,null,context,input);
    return {ok:true,proof,proofDiagnostic};
  }
  if(mode==='roster-guard'){
    if(document.querySelector('input[type=password],form[action*="Login" i]'))return roleFail('LOGIN_OR_LOGOUT');
    if(greetings.length>1)return roleFail('AMBIGUOUS_ROLE');
    if(!activeTeacher.length&&greetings.length!==1&&!(semanticRoleProof&&runContext?.readProof))return roleFail('UNCONFIRMED_TEACHER_ROLE');
    if(!runContext?.schoolId||!runContext.schoolName||shownSchool!==runContext.schoolName)return roleFail('SCHOOL_CONTEXT_CHANGED');
    try{globalThis.rakeezRoutePolicy(location.origin,location.href,runContext);}catch(e){return roleFail(e.message);}
    if(semanticRoleProof&&(!runContext.readProof||runContext.readProof!==currentTeacherProof()||observedSchoolIds.length!==1||observedSchoolIds[0]!==runContext.schoolId.toLowerCase()))return roleFail('TEACHER_CONTEXT_CHANGED');
    return {ok:true,domain:location.hostname,proofDiagnostic};
  }
  if(mode==='guard'){if(greetings.length>1)return roleFail('AMBIGUOUS_ROLE');return {ok:true,domain:location.hostname};}
  if(mode==='home'&&(cards.length||gatewayRejected)){
    if(gatewayRejected)return {...roleFail('UNSAFE_OR_AMBIGUOUS_SCHOOL_CARD','link-discovery'),diagnostic:{...gatewayDiagnostic,stage:'link-discovery',reason:'UNSAFE_OR_AMBIGUOUS_SCHOOL_CARD',entry}};
    const chosen=selectedSchool?cards.find(c=>c.path===selectedSchool.path&&c.label===selectedSchool.label):cards.length===1?cards[0]:null;
    if(selectedSchool&&!chosen)return roleFail('SCHOOL_CHOICE_STALE');
    if(!chosen)return {ok:true,entry,schoolChoices:cards.map(({path,label})=>({path,label})),links:[],tables:[],warnings:[],skipped:[]};
    return {ok:true,entry,runContext:chosen.context,links:[{kind:'gateway',path:chosen.path,context:chosen.context}],tables:chosen.tables,warnings:[],skipped:[]};
  }
  const labels={role:teacher,metadata:['بياناتي','معلوماتي','البيانات الشخصية'],classes:['فصولي','الفصول الدراسية','الفصول التي أدرسها'],students:['قائمة الطلاب','أسماء الطلاب','طلاب الفصل','بيانات الطلاب'],timetable:['جدولي','جدولي الأسبوعي','الجدول الأسبوعي','الجدول الدراسي']};
  const anchors=source?[]:Array.from(document.querySelectorAll('a[href]')).filter(visible);if(anchors.length>150)return fail('PAGE_LIMIT');
  const links=[],skipped=[];
  for(const a of anchors){
    const title=roleText(a);let kind=Object.keys(labels).find(k=>labels[k].includes(title));
    // Only observed href shapes, never construct a report URL/identifier.
    let reportKind=null;
    try{const u=new URL(a.getAttribute('href'),location.href);const match=/^\/TeachersReports\/(?:[A-Za-z]+\/)*(MyInfo|TeacherSchedule|Teacher|ClassStudentInfo)\/[A-Za-z0-9_-]{1,80}\/?$/i.exec(u.pathname);if(match&&title)reportKind=({myinfo:'metadata',teacherschedule:'timetable',teacher:'classes',classstudentinfo:'students'})[match[1].toLowerCase()];}catch{}
    if(!kind&&reportKind)kind=reportKind;
    try{const u=new URL(a.getAttribute('href'),location.href);if(!kind&&title&&/^\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/[^/]+\/?$/i.test(u.pathname))kind='students';}catch{}
    if(!kind&&['التالي','الصفحة التالية'].includes(title)&&['students','classes','timetable'].includes(mode))kind=mode;
    if(!kind)continue;
    const {u,code,diagnostic:routeDiagnostic}=validateAnchor(a,kind==='role'?'role':'read');
    if(code){
      const diagnostic={...routeDiagnostic,stage:'link-discovery',reason:code,category:kind,entry};
      if(kind==='role'||code==='ORIGIN_CHANGED'||!u)return {...fail(code),diagnostic};
      skipped.push({kind,code,diagnostic});continue;
    }
    const path=u.pathname+u.search;
    if(!links.some(l=>l.kind===kind&&l.path===path))links.push({kind,path,report:!!reportKind,pagination:['التالي','الصفحة التالية'].includes(title)});
  }
  if(dashboard&&!links.some(l=>l.kind!=='role')){const failure=roleFail('READ_LINKS_UNAVAILABLE','link-discovery');failure.diagnostic.related=skipped.slice(0,4).map(s=>s.diagnostic);return failure;}
  const roles=links.filter(l=>l.kind==='role');
  safeReportLinks=new Set(links.filter(l=>l.report).map(l=>l.path)).size;explicitRoles=new Set(roles.map(l=>l.path)).size;
  if(adminConflict)return roleFail('NON_TEACHER_ROLE');
  if(greetings.length>1)return roleFail('AMBIGUOUS_ROLE');
  const confirmed=dashboard||activeTeacher.length>0||(greetings.length===1&&safeReportLinks>0);
  if(mode==='home'&&!confirmed){if(roles.length!==1)return roleFail('AMBIGUOUS_OR_MISSING_TEACHER_ROLE');return {ok:true,entry,rolePending:true,links:roles,skipped,domain:location.hostname,title:(document.title??'').replace(/https?:\/\/\S+/g,'').slice(0,80),tables:[],warnings:[]};}
  if(['role','gateway'].includes(mode)&&!confirmed)return roleFail('UNCONFIRMED_TEACHER_ROLE');
  const specs={department:['إدارة التعليم'],teacher:['اسم المعلم'],school:['اسم المدرسة'],principal:['اسم المدير'],classes:['الفصل','المادة'],students:['اسم الطالب','الفصل'],timetable:['اليوم','الحصة','الوقت','الفصل','المادة']};
  const tables=[],warnings=[];
  const dashboardMetadata=dashboard?metadata(dashboards[0]):[];

  const scalar={teacher:[],school:[],principal:[],department:[]};
  scalar.department.push(...labelValues(body,['إدارة التعليم','الإدارة التعليمية','إدارة التعليم التابعة لها']));
  scalar.teacher.push(...labelValues(document,['اسم المعلم','اسم المعلمة']));
  if(source){scalar.school.push(...labelValues(document,['اسم المدرسة']),...Array.from(document.querySelectorAll('.school-name')).filter(visible).map(roleText).filter(validValue));scalar.principal.push(...labelValues(document,['اسم المدير','مدير المدرسة','قائد المدرسة','قادة المدرسة']));}
  const allTables=Array.from(document.querySelectorAll('table')).filter(visible);if(allTables.length>30)return fail('PAGE_LIMIT');
  for(const table of allTables){
    if(table.parentElement?.closest('table')||table.querySelector('table'))continue;
    const rows=Array.from(table.rows);if(rows.length>301)return fail('ROW_LIMIT');
    const roleHeaders=rows[0]?Array.from(rows[0].cells):[];
    const horizontal=roleHeaders.length&&roleHeaders.every(c=>c.tagName==='TH'&&plain(c))&&roleHeaders.some(c=>Object.keys(scalar).some(k=>text(c)===specs[k][0]));
    if(horizontal){
      for(const category of Object.keys(scalar)){
        const positions=roleHeaders.flatMap((c,i)=>text(c)===specs[category][0]?[i]:[]);
        if(positions.length>1){warnings.push({category,code:'AMBIGUOUS_ROLE_VALUE'});continue;}
        if(!positions.length)continue;
        for(const row of rows.slice(1)){if(!visible(row))continue;const cell=row.cells[positions[0]];if(row.cells.length!==roleHeaders.length||!cell||!plain(cell)||cell.colSpan!==1||cell.rowSpan!==1){warnings.push({category,code:'UNRESOLVED_MAPPING'});continue;}scalar[category].push(text(cell));}
      }
    }else for(const row of rows){
      if(!visible(row)||row.cells.length!==2||!Array.from(row.cells).every(c=>plain(c)&&c.colSpan===1&&c.rowSpan===1))continue;
      for(const category of Object.keys(scalar))if(text(row.cells[0])===specs[category][0]){
        const value=text(row.cells[1]);if(Object.keys(scalar).some(k=>value===specs[k][0]))warnings.push({category,code:'UNRESOLVED_ROLE_LABEL'});else scalar[category].push(value);
      }
    }
    if(rows.length<2||!visible(rows[0]))continue;
    const head=Array.from(rows[0].cells);if(head.length>50||!head.every(plain))continue;
    const headings=head.map(text);
    const category=headings.includes('اسم الطالب')?'students':headings.includes('اليوم')?'timetable':headings.includes('الفصل')?'classes':null;
    if(!category||source&&category!==mode)continue;
    if(warnings.some(w=>w.category===category&&w.code==='AMBIGUOUS_TABLE'))continue;
    if(tables.some(t=>t.category===category)){warnings.push({category,code:'AMBIGUOUS_TABLE'});tables.splice(tables.findIndex(t=>t.category===category),1);continue;}
    const columns=[];let context='',invalid=head.some(c=>c.colSpan!==1||c.rowSpan!==1)?'MERGED_OR_IRREGULAR':'';
    if(category==='students'&&!headings.includes('الفصل')){
      const scope=table.closest('section,article')??table;const explicit=Array.from(scope.querySelectorAll('caption,h1,h2,h3')).filter(plain).map(text).filter(t=>/^الفصل: .{2,80}$/.test(t));
      if(new Set(explicit).size===1)context=explicit[0].slice(7);else invalid='UNRESOLVED_CLASSROOM';
    }
    for(const label of specs[category]){
      const indices=headings.flatMap((h,i)=>h===label?[i]:[]);
      if(indices.length>1){invalid='AMBIGUOUS_HEADER';break;}
      if(!indices.length){if(category==='timetable'&&['الحصة','الوقت'].includes(label)||category==='classes'&&label==='المادة')continue;if(label==='الفصل'&&context){columns.push({label,index:-1});continue;}invalid='UNRESOLVED_MAPPING';break;}
      columns.push({label,index:indices[0]});
    }
    const output=[columns.map(c=>c.label).join('\t')];
    for(const row of rows.slice(1)){
      if(!visible(row))continue;
      if(row.cells.length!==head.length||Array.from(row.cells).some(c=>c.colSpan!==1||c.rowSpan!==1)){invalid='MERGED_OR_IRREGULAR';break;}
      const values=[];for(const {index} of columns){const cell=index<0?null:row.cells[index];if(cell&&!plain(cell)){invalid='UNSUPPORTED_VISIBLE_CELL';break;}const value=cell?text(cell):context;if(value.length>80||/[\t\r\n]/.test(value)){invalid='INVALID_FIELD';break;}values.push(value);}if(invalid)break;output.push(values.join('\t'));
    }
    if(invalid)warnings.push({category,code:invalid});else tables.push({category,text:output.join('\n')});
  }
  for(const dt of Array.from(document.querySelectorAll('dt')).filter(plain)){
    const dd=dt.nextElementSibling;if(dd?.tagName!=='DD'||!plain(dd))continue;for(const category of Object.keys(scalar))if(text(dt)===specs[category][0])scalar[category].push(text(dd));
  }
  if(dashboard){
    for(const t of dashboardMetadata)scalar[t.category].push(t.text.split('\t')[1]);
    if(welcomeNames.length===1)scalar.teacher.push(welcomeNames[0]);else if(welcomeNames.length>1)warnings.push({category:'teacher',code:'AMBIGUOUS_ROLE_VALUE'});
  }
  if(['students','timetable'].includes(mode)&&(!tables.some(t=>t.category===mode)||warnings.some(w=>w.category===mode))&&!links.some(l=>l.kind===mode&&l.path!==location.pathname+location.search))return {...fail('UNSUPPORTED_SOURCE_SCHEMA'),diagnostic:{version:'0.4.0',stage:'source-schema',reason:'UNSUPPORTED_SOURCE_SCHEMA',category:mode,schema:{tables:allTables.length,expectedCategory:tables.some(t=>t.category===mode),unresolved:warnings.some(w=>w.category===mode)}}};
  for(const [category,values] of Object.entries(scalar)){
    const distinct=[...new Set(values)];if(distinct.length===1)tables.push({category,text:specs[category][0]+'\t'+distinct[0]});else if(distinct.length>1)warnings.push({category,code:'AMBIGUOUS_ROLE_VALUE'});
  }
  if(warnings.some(w=>w.category==='school'))return roleFail('SCHOOL_CONTEXT_CHANGED');
  // AI: preliminary proof authorizes bounded source GET only; the worker requires
  // corroborated explicit school evidence before any receiver envelope exists.
  const context=source?null:{...routeContext,...(shownSchool?{schoolName:shownSchool}:{}),schoolBinding:shownSchool?'bound':'preliminary',...(routeContext?.schoolId&&(shownSchool||semanticRoleProof)&&(activeTeacher.length||greetings.length===1||semanticRoleProof)?{readProof:currentTeacherProof()}: {})};
  Object.assign(proofDiagnostic,{schoolBindingState:context?.schoolBinding??'none',schoolBadgePresent:!!shownSchool,schoolIdPresent:observedSchoolIds.length===1,readProofPresent:!!context?.readProof});
  return {ok:true,entry,proofDiagnostic,runContext:context,rolePending:false,links:links.filter(l=>l.kind!=='role'),skipped,tables,warnings,domain:location.hostname,title:(document.title??'').replace(/https?:\/\/\S+/g,'').slice(0,80)};
}
