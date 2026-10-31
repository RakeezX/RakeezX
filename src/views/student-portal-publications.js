/** AI: actual mounted V2 teacher controls and strictly permitted student rendering. */
import { PUBLICATION_FLAGS, publicationFailure, projectPublicationStudentData } from '../lib/student-portal-publication-client.js';
import { manualTaskDraft } from '../lib/n88-manual-task-link-safety.js';
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dates = r => `${r.startDate?`<p>البداية: <time dir="ltr">${esc(r.startDate)}</time></p>`:''}${r.dueDate?`<p>التسليم: <time dir="ltr">${esc(r.dueDate)}</time></p>`:''}`;
const link = r => r.link?`<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">رابط الشرح أو الاختبار <span aria-hidden="true">↗</span></a>`:'';
export function renderStudentPublications(raw) {
  const data=projectPublicationStudentData(raw);
  const work=(category,title)=>{const rows=data.work.filter(r=>r.categories.includes(category));return rows.length?`<section data-section="${category}"><h2>${title}</h2>${rows.map(r=>`<article class="n88-unified-work" data-work-id="${esc(r.id)}"><h3>${esc(r.title)}</h3>${dates(r)}${r.description?`<p class="n88-guidance-text">${esc(r.description)}</p>`:''}${link(r)}</article>`).join('')}</section>`:'';};
  return work('required','المطلوب مني')+work('scheduled','الأعمال القادمة')+(data.grades.length?`<section class="n88-unified-grades"><h2>درجاتي المنشورة</h2><p>تُعرض درجة كل بند اختاره المعلم دون جمع البنود المخفية.</p><dl class="n88-v2-grades">${data.grades.map(r=>`<div><dt>${esc(r.title)}</dt><dd dir="ltr">${r.value===null?'لم تُرصد':esc(r.value)}</dd></div>`).join('')}</dl></section>`:'')+work('completed','الأعمال المكتملة')+(!data.work.length&&!data.grades.length?'<p class="n88-unified-empty">لا توجد أعمال أو درجات منشورة حاليًا.</p>':'');
}

export function mountTeacherPublications(root,{client,getContext,subscribe=()=>()=>{}}) {
  let disposed=false,busy=false,generation=0,bound=null,listed=null,selected=null,decisions=null,message='',manual=null,manualId=crypto.randomUUID();
  const doc=root.ownerDocument,win=doc.defaultView;
  const key=()=>{try{return JSON.stringify(getContext());}catch{return null;}};
  const valid=(g,k)=>!disposed&&g===generation&&k!==null&&key()===k;
  const clear=()=>{generation++;bound=key();listed=null;selected=null;decisions=null;manual=null;manualId=crypto.randomUUID();root.replaceChildren();};
  const row=()=>listed?.rows.find(r=>r.id===selected);
  function draw(){
    if(disposed)return;
    const r=row(),unknown=client.pendingState()!=='clear';
    root.innerHTML=`<section class="n88-publications" aria-label="نشر الأعمال والدرجات" aria-busy="${busy}"><h2>نشر الأعمال والدرجات</h2><p>اختر كل بند وما يظهر منه للطالب، ثم احفظ. درجة البند الفرعي مستقلة عن مجموع البند الأب.</p><p role="status" aria-live="polite">${esc(message)}</p><div class="n88-publication-toolbar"><button class="btn" type="button" data-publication-refresh ${busy?'disabled':''}>تحديث البنود</button>${unknown?`<button class="btn" type="button" data-publication-status ${busy?'disabled':''}>التحقق من نتيجة الحفظ</button><p>نتيجة الحفظ غير مؤكدة. لن نعيد الإرسال؛ تحقّق من نتيجته أولًا.</p>`:''}</div>
      ${listed?`<label>البند المحفوظ<select data-publication-source ${busy?'disabled':''}>${listed.rows.filter(r=>!r.tombstone).map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.title)}${r.kind==='subitem'?' — بند فرعي':r.kind==='manual'?' — مهمة المعلم':''}</option>`).join('')}</select></label>${!listed.rows.length?'<p>لا توجد بنود توزيع محفوظة لهذا التدريس.</p>':''}`:''}
      ${r?`<form data-publication-save><h3>${esc(r.title)}</h3>${dates(r)}${r.description?`<p class="n88-guidance-text">${esc(r.description)}</p>`:''}${link(r)}<fieldset ${busy||unknown||r.tombstone?'disabled':''}><legend>ما يظهر للطالب من هذا البند</legend>${PUBLICATION_FLAGS.filter(flag=>flag==='grade'?r.kind!=='manual':r.work).map(flag=>`<label><input type="checkbox" name="${flag}" ${decisions?.[flag]?'checked':''}>${{required:'العمل المطلوب',scheduled:'العمل المجدول',completed:'العمل المكتمل',grade:r.kind==='subitem'?'درجة هذا البند الفرعي فقط':'درجة هذا البند فقط'}[flag]}</label>`).join('')}<button type="submit" class="btn btn--primary">حفظ اختيارات البند</button></fieldset></form>`:''}
      <details class="n88-manual-editor"><summary>إضافة مهمة أو رابط للطلاب</summary><form data-publication-manual><fieldset ${busy||unknown||!listed?'disabled':''}><legend>مهمة يكتبها المعلم</legend><label>عنوان المهمة<input name="title" required maxlength="200" value="${esc(manual?.title)}"></label><label>الوصف (اختياري)<textarea name="description" maxlength="2000">${esc(manual?.description)}</textarea></label><div class="n88-publication-dates"><label>البداية (اختياري)<input name="startDate" type="text" data-rakeez-datetime="date" data-rakeez-date-scope="planning" value="${esc(manual?.startDate)}"></label><label>التسليم (اختياري)<input name="dueDate" type="text" data-rakeez-datetime="date" data-rakeez-date-scope="planning" value="${esc(manual?.dueDate)}"></label></div><label>رابط شرح أو اختبار HTTPS (اختياري)<input name="link" type="text" dir="ltr" maxlength="2048" value="${esc(manual?.link)}"></label><p>لا يُفتح الرابط تلقائيًا. راجع المهمة ثم اختر ظهورها واحفظ.</p><button class="btn" type="submit">مراجعة المهمة</button></fieldset></form></details></section>`;
    // The shared student renderer must not initialize the teacher-only UMD picker
    // in the independently bundled private student document.
    void import('../lib/rakeez-datetime.js').then(({mountDateTimeControls})=>{if(!disposed&&root.isConnected)mountDateTimeControls(root);}).catch(()=>{
      if(!disposed){root.querySelectorAll('[data-rakeez-datetime]').forEach(field=>{field.disabled=true;});message='تعذّر تحميل اختيار التاريخ. حدّث الصفحة قبل إضافة مهمة.';const status=root.querySelector('[role=status]');if(status)status.textContent=message;}
    });
  }
  const adopt=result=>{listed=result;selected=result.rows.find(r=>r.id===selected&&!r.tombstone)?.id??result.rows.find(r=>!r.tombstone)?.id??null;decisions=row()?{...row().decisions}:null;};
  async function run(operation,{read=false,save=false}={}) {
    if(disposed||busy)return;
    if(key()!==bound)clear();const k=bound,g=++generation;if(!k)return;
    busy=true;message=save?'جارٍ حفظ الاختيارات…':'جارٍ التحقق…';draw();
    try{
      const result=await operation();if(!valid(g,k))return;
      if(read)adopt(result);
      else if(save){message=result.state==='confirmed'?'حُفظت اختيارات البند.':'لم يُحفظ التغيير؛ حدّث البنود وراجع الاختيارات.';const next=await client.list();if(!valid(g,k))return;adopt(next);manual=null;manualId=crypto.randomUUID();}
      else if(result?.state){message=result.state==='confirmed'?'تأكد حفظ الاختيارات.':result.state==='clear'?'لا يوجد حفظ معلّق.':'لم يُطبّق التغيير؛ راجع البنود.';const next=await client.list();if(!valid(g,k))return;adopt(next);}
      else {listed={...listed,rows:listed.rows.filter(r=>r.id!==result.id).concat(result)};selected=result.id;decisions={...result.decisions};message='هذه مراجعة للمهمة؛ اختر ظهورها ثم احفظ اختيارات البند.';}
      if(read)message='البنود من أحدث قراءة مؤكدة. الحفظ يتم باختيارك فقط.';
    }catch(error){if(valid(g,k)){
      const kind=publicationFailure(error);
      message=kind==='unknown'?'تعذّر تأكيد الحفظ. تحقّق من النتيجة دون إعادة الإرسال.':kind==='not_started'?'لم يبدأ الحفظ. حدّث البنود وتحقق من الاتصال قبل المحاولة.':kind==='validation'?'تعذّرت مراجعة البيانات. تحقق من الرابط والتواريخ ثم حدّث البنود.':'تعذّر الاتصال. لم نعرض حالة قديمة؛ حاول تحديث البنود.';
      if(read){listed=null;selected=null;decisions=null;}
    }}finally{if(valid(g,k)){busy=false;draw();}}
  }
  const input=e=>{
    if(key()!==bound){clear();draw();return;}
    if(e.target.closest('[data-publication-save]')&&PUBLICATION_FLAGS.includes(e.target.name))decisions={...decisions,[e.target.name]:e.target.checked};
    const f=e.target.closest('[data-publication-manual]');if(f)manual=Object.fromEntries(['title','description','startDate','dueDate','link'].map(k=>[k,f.elements[k].value]));
  };
  const change=e=>{input(e);if(e.target.matches('[data-publication-source]')){selected=e.target.value;decisions=row()?{...row().decisions}:null;draw();}};
  const submit=e=>{
    if(!e.target.matches('[data-publication-save],[data-publication-manual]'))return;e.preventDefault();
    if(key()!==bound){clear();draw();return;}
    if(e.target.matches('[data-publication-save]'))void run(()=>client.save(selected,decisions),{save:true});
    else {
      try{const task=manualTaskDraft({id:manualId,...manual});void run(()=>client.preview(task));}
      catch{message='تحقق من العنوان والتواريخ ورابط HTTPS دون بيانات دخول.';draw();root.querySelector('details').open=true;}
    }
  };
  const click=e=>{if(e.target.closest('[data-publication-refresh]'))void run(()=>client.list(),{read:true});if(e.target.closest('[data-publication-status]'))void run(()=>client.status());};
  const changed=()=>{if(bound!==key()){clear();busy=false;draw();}};
  const hide=()=>{generation++;listed=null;selected=null;decisions=null;manual=null;busy=false;root.replaceChildren();};
  const wake=()=>{changed();if(!disposed&&doc.visibilityState==='visible'&&!listed&&!busy)void run(()=>client.list(),{read:true});};
  root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('submit',submit);root.addEventListener('click',click);
  win.addEventListener('pagehide',hide);win.addEventListener('pageshow',wake);win.addEventListener('focus',changed);const unsubscribe=subscribe(changed);
  clear();draw();void run(()=>client.list(),{read:true});
  return {dispose(){disposed=true;generation++;listed=null;manual=null;unsubscribe?.();client.dispose();win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',wake);win.removeEventListener('focus',changed);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.replaceChildren();}};
}
