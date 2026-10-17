/** AI: standalone fabricated invitation journey, with no application dependencies. */
const app = document.getElementById('app');
document.title = 'تجربة دعوة الطالب — رَكيز المعلم';
app.className = 'n88-guest';
app.innerHTML = `
<style>
.n88-guest{min-height:100dvh;background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.75;padding:24px;overflow-wrap:anywhere}
.n88-guest *{box-sizing:border-box}.n88-guest main{max-width:1040px;margin:auto}
.n88-guest .n88-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:24px;border-bottom:1px solid var(--border)}
.n88-guest .brand-lockup{width:245px}.n88-guest a{color:var(--brand-text);padding:10px 0}
.n88-guest h1{font-size:clamp(26px,4vw,36px);line-height:1.4;margin:0 0 12px}.n88-guest h2{font-size:24px;line-height:1.5;margin:8px 0}.n88-guest h3{font-size:18px;margin:0 0 8px}.n88-guest p{margin:8px 0}
.n88-guest .n88-intro{padding:32px 0 24px}.n88-guest .n88-intro>p{color:var(--text-2);max-width:650px;font-size:18px}
.n88-guest .n88-notice{display:inline-block;color:var(--text-2);background:var(--bg-sunk);border-radius:var(--r-sm);padding:8px 12px;font-size:13px;margin-top:16px}
.n88-guest .n88-steps{list-style:none;padding:0;margin:0 0 20px;display:flex;gap:12px}.n88-guest .n88-steps li{flex:1;border-bottom:3px solid var(--border);padding:8px 0;color:var(--text-2)}.n88-guest .n88-steps [aria-current]{border-color:var(--brand);color:var(--brand-text);font-weight:700}
.n88-guest .n88-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:start}
.n88-guest .n88-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px;box-shadow:var(--shadow-1);min-width:0}
.n88-guest .n88-eyebrow{color:var(--brand-text);font-size:14px;font-weight:700}.n88-guest .n88-muted{color:var(--text-2);font-size:14px}
.n88-guest .n88-invitation{margin:24px 0;padding:20px;border:1px solid var(--brand-border);border-radius:var(--r-md);background:var(--brand-soft)}
.n88-guest .n88-facts{display:flex;gap:24px;flex-wrap:wrap;margin:16px 0 0}.n88-guest dt{color:var(--text-2);font-size:13px}.n88-guest dd{margin:2px 0 0;font-weight:700}
.n88-guest button{font:inherit;min-height:48px;padding:10px 18px;border:1px solid var(--border-strong);border-radius:var(--r-md);background:var(--bg-elev);color:var(--text);cursor:pointer}.n88-guest button:hover{background:var(--bg-sunk)}
.n88-guest button.n88-primary{width:100%;background:var(--action-primary);border-color:var(--action-primary);color:var(--action-primary-ink);font-weight:700}.n88-guest button.n88-primary:hover{background:var(--action-primary-hover)}
.n88-guest :focus-visible{outline:3px solid var(--brand-text);outline-offset:4px}
.n88-guest details{margin-top:24px;border-top:1px solid var(--border);padding-top:12px}.n88-guest summary{cursor:pointer;padding:10px 0;color:var(--brand-text)}
.n88-guest label{display:block;font-size:14px;margin-top:12px}.n88-guest input{width:100%;min-height:48px;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border-strong);border-radius:var(--r-sm);padding:10px;margin:8px 0}.n88-guest [data-error]{color:var(--danger);font-size:14px}
.n88-guest .n88-guide{padding:0 20px 0 0;margin:16px 0 0}.n88-guest .n88-guide li{padding:8px 0}.n88-guest .n88-guide span{display:block;color:var(--text-2);font-size:14px}
.n88-guest .n88-success{color:var(--ok);font-size:14px;margin-bottom:16px}
.n88-guest .n88-activities{list-style:none;padding:0;margin:20px 0 0}.n88-guest .n88-activities li{padding:16px 0;border-top:1px solid var(--border);display:flex;align-items:start;gap:12px;justify-content:space-between}.n88-guest .n88-activities strong{display:block}
.n88-guest .n88-state{font-size:12px;padding:4px 8px;border-radius:var(--r-sm);background:var(--bg-sunk);white-space:nowrap;color:var(--text-2)}.n88-guest .n88-state--done{color:var(--ok);background:var(--ok-soft)}.n88-guest .n88-state--working{color:var(--warn);background:var(--warn-soft)}
.n88-guest progress{width:100%;height:12px;accent-color:var(--brand);margin:16px 0}.n88-guest .n88-number{font-size:36px;color:var(--brand-text);font-weight:700}.n88-guest [data-reset]{margin-top:20px;width:100%}
@media(max-width:650px){.n88-guest{padding:20px 16px 32px}.n88-guest .n88-header{align-items:start;flex-direction:column;gap:8px;padding-bottom:16px}.n88-guest .brand-lockup{width:220px}.n88-guest .n88-intro{padding-top:24px}.n88-guest .n88-grid{grid-template-columns:1fr}.n88-guest .n88-card{padding:20px}.n88-guest .n88-activities li{flex-wrap:wrap}}
</style>
<main dir="rtl" data-n88-public>
<header class="n88-header"><span class="brand-lockup" role="img" aria-label="رَكيز المعلم"><img class="brand-lockup__image brand-lockup__image--light" src="assets/header-light-standard.svg" width="345" height="56" alt=""><img class="brand-lockup__image brand-lockup__image--dark" src="assets/header-dark-standard.svg" width="345" height="56" alt=""></span><a href="./">العودة لرَكيز المعلم</a></header>
<div class="n88-intro"><h1>دعوة صغيرة، متابعة أوضح</h1><p>يعطي المعلم الطالب دعوة خاصة ليفتحها ويرى واجباته وتقدّمه.</p><p class="n88-notice"><strong>بيانات تجريبية</strong> · مثال مصطنع للجميع، دون دخول فعلي أو إرسال أو حفظ.</p></div>
<ol class="n88-steps" aria-label="خطوات تجربة الدعوة"><li data-teacher-step aria-current="step">1 · المعلم يجهّز الدعوة</li><li data-student-step>2 · الطالب يتابع تعلّمه</li></ol><div data-content></div>
</main>`;
const content = app.querySelector('[data-content]');
function entry() {
 app.querySelector('[data-teacher-step]').setAttribute('aria-current','step');
 app.querySelector('[data-student-step]').removeAttribute('aria-current');
 content.innerHTML = `<div class="n88-grid"><section class="n88-card" data-teacher><div class="n88-eyebrow">المعلم</div><h2>دعوة طالب جاهزة للتجربة</h2><p class="n88-muted">افتح الدعوة لترى كيف تظهر الأنشطة والتقدّم للطالب.</p>
 <div class="n88-invitation"><h3>بطاقة دعوة · طالب تجريبي</h3><p>المهارات الرقمية · الصف السادس</p><dl class="n88-facts"><div><dt>المعلم</dt><dd>أحمد · مثال</dd></div><div><dt>محتوى الدعوة</dt><dd>3 أنشطة وتقدّم الطالب</dd></div></dl></div>
 <button class="n88-primary" type="button" data-open>جرّب دعوة طالب ←</button>
 <details><summary>تجربة الدخول برمز بدل الدعوة</summary><form><label for="n88-example">اكتب رمز المثال <bdi>DEMO-ONLY</bdi></label><input id="n88-example" dir="ltr" autocomplete="off" spellcheck="false" maxlength="32" aria-describedby="n88-example-help n88-example-error"><p id="n88-example-help" class="n88-muted">استخدم الرمز المكتوب فقط، دون أي بيانات شخصية.</p><p id="n88-example-error" data-error role="status" aria-live="polite"></p><button type="submit">فتح مثال الطالب</button></form></details></section>
 <aside class="n88-card"><h2>كيف يستفيد الطالب؟</h2><ol class="n88-guide"><li><strong>يفتح دعوة المعلم</strong><span>ليصل إلى مساحة متابعة تعلّمه.</span></li><li><strong>يعرف ما عليه إنجازه</strong><span>أنشطته مرتّبة مع حالة كل نشاط.</span></li><li><strong>يرى تقدّمه بوضوح</strong><span>ما اكتمل، وما يعمل عليه، وخطوته التالية.</span></li></ol></aside></div>`;
}
function show() {
 app.querySelector('[data-teacher-step]').removeAttribute('aria-current');
 app.querySelector('[data-student-step]').setAttribute('aria-current','step');
 content.innerHTML = `<div class="n88-grid" data-student><section class="n88-card"><p class="n88-success" role="status">✓ فُتح مثال الدعوة بنجاح</p><div class="n88-eyebrow">الطالب · المهارات الرقمية</div><h2 tabindex="-1">مرحبًا، طالب تجريبي</h2><p class="n88-muted">الصف السادس · مع المعلم أحمد</p><h3 style="margin-top:24px">أنشطتي</h3>
 <ul class="n88-activities"><li><div><strong>تنسيق مستند نصي</strong><span class="n88-muted">تطبيق · الدرجة: 8 من 10</span></div><span class="n88-state n88-state--done">مكتمل</span></li><li><div><strong>تصميم عرض عن الأمان الرقمي</strong><span class="n88-muted">مشروع · أضف شريحة لحماية كلمة المرور</span></div><span class="n88-state n88-state--working">قيد العمل</span></li><li><div><strong>خطوات حل مشكلة برمجية</strong><span class="n88-muted">تدريب · رتّب خطوات الحل</span></div><span class="n88-state">لم يبدأ</span></li></ul></section>
 <aside class="n88-card"><h2>تقدّمي</h2><p><span class="n88-number">1</span> من 3 أنشطة مكتمل</p><progress value="1" max="3" aria-label="نشاط واحد مكتمل من ثلاثة">1 من 3</progress><h3>خطوتي التالية</h3><p class="n88-muted">أكمل شريحة حماية كلمة المرور في مشروع الأمان الرقمي.</p><button type="button" data-reset>العودة للمعلم وبدء التجربة من جديد</button></aside></div>`;
 content.querySelector('h2').focus();
}
app.addEventListener('click', event => {
 if(event.target.closest('[data-open]')) show();
 if(event.target.closest('[data-reset]')) { entry(); content.querySelector('[data-open]').focus(); }
});
app.addEventListener('submit', event => {
 if(!event.target.matches('form')) return;
 event.preventDefault();
 const input=content.querySelector('input');
 if(input.value.trim().toUpperCase()==='DEMO-ONLY') show();
 else { input.setAttribute('aria-invalid','true'); content.querySelector('[data-error]').textContent='اكتب DEMO-ONLY لفتح المثال.'; input.focus(); }
});
entry();
