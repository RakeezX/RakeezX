/** Public, synthetic N71/V2 preview. Never imports Product account or Cloud modules. */
const app=document.getElementById('app');
document.title='معاينة تغيير المادة والمناهج V2 — رَكيز المعلم';
app.className='v2-lab';
app.innerHTML=String.raw`
<style>
.v2-lab{--lab-ink:var(--text,#182727);--lab-muted:var(--text-2,#5f7473);--lab-bg:var(--bg,#f5f9f8);--lab-card:var(--bg-elev,#fff);--lab-line:var(--border,#dce9e5);--lab-green:#087b62;min-height:100dvh;background:var(--lab-bg);color:var(--lab-ink);font-family:var(--font,system-ui);line-height:1.75;overflow-wrap:anywhere;padding:24px 18px 64px}
.v2-lab *{box-sizing:border-box}.v2-lab main{width:min(1140px,100%);margin:auto}
.v2-lab header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:20px;border-bottom:1px solid var(--lab-line);flex-wrap:wrap}
.v2-lab .brand-lockup{width:min(260px,52vw)}
.v2-lab a{color:var(--lab-green);text-underline-offset:4px}
.v2-lab .eyebrow{color:var(--lab-green);font-size:13px;font-weight:800;margin-bottom:8px}
.v2-lab h1{font-size:clamp(26px,4vw,37px);line-height:1.45;margin:0 0 12px}
.v2-lab h2{font-size:clamp(19px,3vw,24px);line-height:1.45;margin:0 0 10px}
.v2-lab h3{font-size:17px;margin:0 0 8px}
.v2-lab p{margin:8px 0}.v2-lab .intro{padding:30px 0 12px}
.v2-lab .lead{font-size:17px;color:var(--lab-muted);max-width:730px}
.v2-lab .notice{background:var(--lab-card);border:1px solid var(--lab-line);border-right:4px solid var(--lab-green);padding:12px 15px;border-radius:12px;margin:18px 0;font-size:14px}
.v2-lab .grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.8fr);gap:18px;align-items:start}
.v2-lab .stack{display:grid;gap:18px}.v2-lab .card{background:var(--lab-card);border:1px solid var(--lab-line);border-radius:18px;padding:24px;box-shadow:0 5px 22px rgba(23,71,63,.04);min-width:0}
.v2-lab .muted{color:var(--lab-muted);font-size:14px}.v2-lab .data-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin:10px 0}
.v2-lab .data-row strong{font-weight:800}.v2-lab .pill{display:inline-flex;background:#e8f5ef;color:#126c50;border-radius:99px;padding:2px 11px;font-size:12px;font-weight:800}
.v2-lab .scenarios{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0 20px}
.v2-lab button{font:inherit;cursor:pointer;min-height:44px;padding:9px 14px;border:1px solid var(--lab-line);border-radius:10px;color:var(--lab-ink);background:var(--lab-card)}
.v2-lab button:hover{background:var(--lab-bg)}.v2-lab button[aria-pressed=true]{border-color:var(--lab-green);background:#e8f5ef;color:#075b4b;font-weight:800}
.v2-lab button.primary{background:#087b62;color:#fff;border-color:#087b62;font-weight:800}.v2-lab button.primary:hover{background:#08644f}
.v2-lab button:disabled{cursor:not-allowed;opacity:.55}.v2-lab select{display:block;width:100%;font:inherit;min-height:48px;margin:8px 0 14px;padding:8px 14px;background:var(--lab-card);border:1px solid var(--lab-line);border-radius:10px;color:var(--lab-ink)}
.v2-lab label{display:block;font-weight:800;font-size:14px;margin:14px 0 2px}
.v2-lab .result{background:var(--lab-bg);border:1px solid var(--lab-line);padding:17px;border-radius:12px;margin:12px 0;min-height:100px}
.v2-lab .result[data-kind=blocked]{border-color:#ebd4af;background:#fff8ed}
.v2-lab .result[data-kind=ready]{border-color:#bee6d3;background:#f1fbf5}
.v2-lab .result[data-kind=done]{border-color:#bee6d3;background:#f1fbf5}
.v2-lab .mini{list-style:none;margin:14px 0 6px;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.v2-lab .mini li{border:1px solid var(--lab-line);padding:10px;border-radius:10px}
.v2-lab .mini strong{display:block;font-size:19px}.v2-lab .actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}
.v2-lab .muted-list{list-style:disc;padding-right:20px;color:var(--lab-muted);font-size:14px}
.v2-lab .progress-list{margin:12px 0 0;padding-right:22px}.v2-lab .progress-list li{padding:5px 0;color:var(--lab-muted)}
.v2-lab .progress-list li[data-complete]{color:var(--lab-green);font-weight:800}
.v2-lab .preview-foot{border-top:1px solid var(--lab-line);margin-top:32px;padding-top:20px;color:var(--lab-muted);font-size:13px}
.v2-lab :focus-visible{outline:3px solid var(--lab-green);outline-offset:4px}
@media(max-width:780px){.v2-lab .grid{grid-template-columns:1fr}.v2-lab .card{padding:19px}}
@media(max-width:490px){.v2-lab{padding:16px 12px 36px}.v2-lab .scenarios{grid-template-columns:1fr}.v2-lab .actions>*{width:100%}}
</style>
<main dir="rtl" data-n71-v2-public-lab>
  <header><span class="brand-lockup" role="img" aria-label="رَكيز المعلم"><img class="brand-lockup__image brand-lockup__image--light" src="assets/header-light-standard.svg" width="345" height="56" alt=""><img class="brand-lockup__image brand-lockup__image--dark" src="assets/header-dark-standard.svg" width="345" height="56" alt=""></span><a href="./#/classes">العودة لركيز</a></header>
  <section class="intro"><div class="eyebrow">معاينة تصميم وتجربة تفاعلية</div><h1>تغيير المادة دون ضياع سجل المعلم</h1><p class="lead">جرّب أثر تغيير المادة، وشاهد كيف نحافظ على الحضور والدرجات وروابط المنهج عند إضافة مادة أخرى، قبل تفعيل المزامنة السحابية الحقيقية.</p></section>
  <p class="notice"><strong>بيانات اصطناعية فقط.</strong> هذه تجربة عرض مستقلة، لا تتصل بحسابك ولا ترسل بيانات ولا تنفّذ كتابة سحابية. الحفظ هنا محاكاة داخل الصفحة فقط.</p>
  <div class="grid">
    <div class="stack">
      <section class="card" aria-labelledby="subject-lab-title">
        <div class="eyebrow">01 · رحلة تعديل الفصل</div><h2 id="subject-lab-title">تغيير المادة أو إضافة مادة مستقلة</h2>
        <div class="data-row"><span>الفصل</span><strong>رابع / 1</strong></div>
        <div class="data-row"><span>المادة الحالية</span><strong data-current-subject>العلوم</strong></div>
        <div class="data-row"><span>سجلات الطلاب</span><span class="pill">كشف واحد للفصل</span></div>
        <p class="muted">اختر حالة مختلفة لترى كيف يحمي ركيز البيانات:</p>
        <div class="scenarios" role="group" aria-label="حالات تجربة تغيير المادة">
          <button type="button" aria-pressed="true" data-scenario="clean">اختيار خاطئ</button>
          <button type="button" aria-pressed="false" data-scenario="history">عليها درجات</button>
          <button type="button" aria-pressed="false" data-scenario="pending">مزامنة معلّقة</button>
        </div>
        <label for="v2-target">المادة المطلوبة</label>
        <select id="v2-target"><option value="digital">المهارات الرقمية</option><option value="arabic">اللغة العربية</option><option value="same">العلوم (المادة الحالية)</option></select>
        <div class="result" role="status" aria-live="polite" data-subject-result></div>
        <div class="actions"><button class="primary" type="button" data-subject-review>معاينة الأثر</button><button type="button" data-subject-apply disabled>تجربة تصحيح الاختيار</button><button type="button" data-subject-add>إضافة مادة مستقلة</button></div>
        <p class="muted" data-demo-state>لم تُجرَ أي كتابة فعلية. هذه شاشة تفاعلية لعرض سياسة حماية السجلات فقط.</p>
      </section>
      <section class="card" aria-labelledby="backup-lab-title">
        <div class="eyebrow">02 · N71 V2</div><h2 id="backup-lab-title">تجربة استعادة نسخة إلى جهاز آخر</h2>
        <p class="muted">يعرض المثال خطوات فحص نسخة V5، مطابقة المالك، حفظ نية الاستعادة، اعتمادها، ثم فتحها على جهاز B.</p>
        <ul class="mini"><li>الطلاب<strong>12</strong></li><li>الدرجات المسجلة<strong>12</strong></li><li>سياق المنهج<strong>V2</strong></li><li>مقرر مربوط<strong>العلوم</strong></li></ul>
        <ol class="progress-list" data-restore-steps><li>فحص نسخة V5 وبصمتها</li><li>مطابقة المالك والروابط</li><li>تجهيز الطلب وتثبيت بصمته</li><li>اعتماد الطلب ومنع التكرار</li><li>استعادة آمنة على جهاز B</li></ol>
        <div class="result" role="status" aria-live="polite" data-restore-result>لم تبدأ المحاكاة. لا يوجد اتصال بخادم فعلي.</div>
        <div class="actions"><button class="primary" type="button" data-restore-run>تشغيل المحاكاة</button><button type="button" data-restore-repeat disabled>إعادة الطلب نفسه</button><button type="button" data-restore-reset>إعادة ضبط التجربة</button></div>
      </section>
    </div>
    <aside class="stack">
      <section class="card"><div class="eyebrow">كيف يتصرف ركيز؟</div><h2>سجل المادة يبقى واضحًا</h2><p>إسناد المادة مستقل عن كشف طلاب الفصل. ولهذا فإن إضافة مادة ثانية تشارك قائمة الطلاب، دون إعادة تسمية الدرجات القديمة.</p><ul class="muted-list"><li>الدرجات السابقة تظل في مادتها.</li><li>الحضور والحصص لا ينتقلان تلقائيًا.</li><li>مزامنة غير مكتملة تمنع التبديل.</li><li>المادة المسندة سابقًا لا تتكرر.</li></ul></section>
      <section class="card"><div class="eyebrow">ما الذي لم يُفعّل بعد؟</div><h2>الوضع الحقيقي على الموقع</h2><p>المعاينة توضح التصميم والسلوك المقصود. <strong>تغيير المادة مع حفظ سحابي جديد، واستعادة Sidecars من Cloud، ما زالا يحتاجان اختبارات مزود ومراجعة الأمان قبل Production.</strong></p><p class="muted">هذا الفصل بين المعاينة والميزة الحية يحمي حساب المعلم من فقد البيانات.</p></section>
    </aside>
  </div>
  <footer class="preview-foot">رَكيز المعلم · مختبر معاينة V6 / V2 · جميع الأسماء والدرجات في هذه الصفحة افتراضية.</footer>
</main>`;

const current=app.querySelector('[data-current-subject]');
const result=app.querySelector('[data-subject-result]');
const stateLine=app.querySelector('[data-demo-state]');
const target=app.querySelector('#v2-target');
const applyButton=app.querySelector('[data-subject-apply]');
const run=app.querySelector('[data-restore-run]');
const repeat=app.querySelector('[data-restore-repeat]');
const restoreResult=app.querySelector('[data-restore-result]');
const steps=[...app.querySelectorAll('[data-restore-steps] li')];
const dictionary={digital:'المهارات الرقمية',arabic:'اللغة العربية',same:'العلوم'};
const scenarios={
  clean:{label:'اختيار خاطئ',count:0,students:12,notes:'لم يبدأ الرصد. يمكن تصحيح المادة بعد التحقق من الخادم والمزامنة.'},
  history:{label:'عليها درجات',count:26,students:12,notes:'12 درجة و9 سجلات حضور و5 حصص تاريخية. يُحفظ التاريخ تحت المادة الأصلية.'},
  pending:{label:'مزامنة معلّقة',count:1,students:12,notes:'هناك عملية حفظ لم يصل تأكيدها؛ يمنع التبديل حتى اكتمال التحقق.'},
};
let scenario='clean',reviewed=false,added=[],restored=false;
function showImpact(){
  const changed=target.value!=='same';
  const entry=scenarios[scenario];
  const ready=scenario==='clean'&&changed;
  applyButton.disabled=!ready;
  result.dataset.kind=ready?'ready':'blocked';
  const head=ready?'يمكن تصحيح هذا الاختيار في سيناريو المعاينة':
    !changed?'هذه هي المادة الحالية':
    scenario==='pending'?'تغيير المادة موقوف حتى وضوح المزامنة':
    'لا تنقل درجات المادة السابقة إلى مادة جديدة';
  result.replaceChildren();
  const title=document.createElement('h3');
  title.textContent=head;
  const body=document.createElement('p');
  body.textContent=entry.notes;
  const detail=document.createElement('p');
  detail.className='muted';
  detail.textContent='عدد طلاب الفصل: '+entry.students+' · سجلات متأثرة: '+entry.count+
    ' · لا يوجد طلب حفظ فعلي.';
  result.append(title,body,detail);
  reviewed=true;
  stateLine.textContent=ready?
    'تطبيق التصحيح التالي مجرد محاكاة داخل هذه الصفحة. الاستبدال الحقيقي في حسابك ليس مفعلًا.':
    'السجلات الأصلية لن تتغير. استخدم إضافة مادة مستقلة إن كنت تدرّس مادة جديدة.';
}
app.querySelectorAll('[data-scenario]').forEach(button=>{
  button.addEventListener('click',()=>{
    scenario=button.dataset.scenario;
    reviewed=false;applyButton.disabled=true;
    current.textContent='العلوم';
    app.querySelectorAll('[data-scenario]').forEach(s=>s.setAttribute('aria-pressed',String(s===button)));
    result.dataset.kind='';
    result.textContent='اختر «معاينة الأثر» لعرض حماية حالة '+scenarios[scenario].label+'.';
    stateLine.textContent='البيانات المصطنعة فقط؛ لا تتصل بقاعدة بيانات حقيقية.';
  });
});
target.addEventListener('change',()=>{
  reviewed=false;applyButton.disabled=true;
  result.dataset.kind='';
  result.textContent='اضغط «معاينة الأثر» بعد اختيار المادة.';
});
app.querySelector('[data-subject-review]').addEventListener('click',showImpact);
applyButton.addEventListener('click',()=>{
  if(!reviewed||scenario!=='clean'||target.value==='same')return;
  current.textContent=dictionary[target.value];
  result.dataset.kind='done';
  result.replaceChildren();
  const title=document.createElement('h3');
  title.textContent='نجح التصحيح داخل النموذج التجريبي';
  const body=document.createElement('p');
  body.textContent='أصبح اسم الإسناد المصطنع '+dictionary[target.value]+
    '. كشف الطلاب الاثنا عشر لم يتكرر؛ لا يوجد أي حفظ أو مزامنة حقيقية.';
  result.append(title,body);
  stateLine.textContent='المحاكاة فقط: بعد تحديث الصفحة تعود جميع القيم إلى البداية.';
  applyButton.disabled=true;
});
app.querySelector('[data-subject-add]').addEventListener('click',()=>{
  const name=dictionary[target.value];
  if(target.value==='same'||added.includes(name)){
    stateLine.textContent='المادة هذه موجودة بالفعل في المثال؛ لا نُنشئها مرتين.';
    return;
  }
  added.push(name);
  result.dataset.kind='done';
  result.replaceChildren();
  const title=document.createElement('h3');
  title.textContent='أُضيفت مادة مستقلة إلى المثال';
  const description=document.createElement('p');
  description.textContent='المادة الجديدة: '+name+
    '، والعلوم بقيت بسجل درجاتها وحضورها. كلاهما يشتركان في كشف 12 طالبًا دون تكراره.';
  result.append(title,description);
  stateLine.textContent='هذه إضافة داخل الذاكرة فقط، ليست كتابة على IndexedDB أو Supabase.';
  applyButton.disabled=true;
});
run.addEventListener('click',()=>{
  if(restored)return;
  restored=true;
  steps.forEach(step=>step.setAttribute('data-complete',''));
  restoreResult.dataset.kind='done';
  restoreResult.replaceChildren();
  const title=document.createElement('h3');
  title.textContent='اكتملت محاكاة الاستعادة على جهاز B';
  const body=document.createElement('p');
  body.textContent='12 طالبًا، 12 درجة، وربط مقرر العلوم — دون فقد سجل أو تكرار. الرقم التجريبي لإيصال الطلب: N71-DEMO-01.';
  const note=document.createElement('p');
  note.className='muted';
  note.textContent='هذا تسلسل توضيحي فقط؛ الاختبار الحقيقي على PostgreSQL/IndexedDB منفصل، ولم يُنشأ إيصال Cloudflare أو Supabase من هذه الصفحة.';
  restoreResult.append(title,body,note);
  repeat.disabled=false;run.disabled=true;
});
repeat.addEventListener('click',()=>{
  if(!restored)return;
  restoreResult.dataset.kind='done';
  restoreResult.append(document.createTextNode(' تم عرض الإيصال التجريبي نفسه مجددًا، دون إنشاء نسخة ثانية.'));
});
app.querySelector('[data-restore-reset]').addEventListener('click',()=>{
  restored=false;steps.forEach(step=>step.removeAttribute('data-complete'));
  run.disabled=false;repeat.disabled=true;
  restoreResult.dataset.kind='';
  restoreResult.textContent='لم تبدأ المحاكاة. لا يوجد اتصال بخادم فعلي.';
});
result.textContent='اختر «معاينة الأثر» لمراجعة الحالة قبل محاولة التبديل.';
