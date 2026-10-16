/** AI: isolated public illustration; deliberately has no application imports. */
const app = document.getElementById('app');
document.title = 'تجربة دعوة الطالب — رَكيز المعلم';
app.className = 'n88-guest';
app.innerHTML = `
  <style>
    .n88-guest { --paper:#fff; --ink:#172d32; --muted:#405a60; --line:#bacdce; --accent:#086b59;
      background:#eef5f3; color:var(--ink); min-height:100dvh; padding:clamp(16px,4vw,48px);
      font-family:system-ui,sans-serif; line-height:1.8; overflow-wrap:anywhere; }
    [data-theme="dark"] .n88-guest { --paper:#1c2b30; --ink:#edf6f5; --muted:#bdd0d1; --line:#577276; --accent:#83e0c4; background:#101c20; }
    .n88-guest * { box-sizing:border-box; }
    .n88-guest main { max-width:960px; margin:auto; }
    .n88-guest h1 { font-size:clamp(24px,4vw,36px); line-height:1.5; margin:12px 0; }
    .n88-guest h2 { font-size:21px; margin:0 0 12px; }
    .n88-guest p { margin:12px 0; }
    .n88-guest .n88-notice { border-inline-start:4px solid var(--accent); padding:12px 16px; background:var(--paper); }
    .n88-guest .n88-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; margin:24px 0; }
    .n88-guest section { border:1px solid var(--line); border-radius:16px; padding:24px; background:var(--paper); min-width:0; }
    .n88-guest button,.n88-guest a { color:var(--accent); font:inherit; }
    .n88-guest button { background:var(--paper); border:2px solid var(--accent); border-radius:10px; padding:10px 16px; cursor:pointer; min-height:48px; }
    .n88-guest a { display:inline-block; padding:12px 0; text-decoration:underline; }
    .n88-guest input { display:block; width:100%; min-height:48px; margin:8px 0; padding:10px; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:8px; font:inherit; }
    .n88-guest :focus-visible { outline:3px solid var(--accent); outline-offset:4px; }
    .n88-guest small { color:var(--muted); }
    .n88-guest progress { width:100%; accent-color:var(--accent); }
    .n88-guest [data-error] { min-height:1.8em; }
    @media(max-width:600px) { .n88-guest .n88-grid { grid-template-columns:1fr; } .n88-guest section { padding:18px; } }
  </style>
  <main dir="rtl" data-n88-public>
    <header><small>رَكيز المعلم · تصور دعوة الطالب</small><h1>تجربة دعوة الطالب</h1>
      <p class="n88-notice"><strong>نموذج تجريبي دون بيانات طلاب أو دخول فعلي</strong><br>كل الأنشطة والدرجات هنا مصطنعة. لا دعوة حقيقية ولا إرسال أو حفظ.</p>
    </header>
    <div data-content></div>
    <a href="./">العودة لرَكيز المعلم</a>
  </main>`;
const content = app.querySelector('[data-content]');
function entry() {
  content.innerHTML = `<div class="n88-grid">
    <section><h2>1. فتح الدعوة بضغطة</h2>
      <p>في التصور المقترح، يسلّم المعلم الدعوة للطالب مباشرة. يفتح الطالب الرابط أو يمسح QR من ورقة لفتح الرابط نفسه.</p>
      <p>هنا لا يوجد QR قابل للمسح أو رابط مشاركة؛ الزر يحاكي الفكرة فقط.</p>
      <button type="button" data-open>تجربة فتح رابط الدعوة</button>
    </section>
    <section><h2>2. بديل يدوي للرابط</h2>
      <p>اكتب <bdi>DEMO-ONLY</bdi> لعرض المثال فقط. لا تدخل اسمًا أو رمزًا حقيقيًا.</p>
      <form><label for="n88-example">رمز توضيحي فقط</label>
        <input id="n88-example" dir="ltr" autocomplete="off" spellcheck="false" maxlength="32" aria-describedby="n88-example-error">
        <p id="n88-example-error" data-error role="status" aria-live="polite"></p>
        <button type="submit">عرض المثال بالرمز</button>
      </form>
    </section></div>`;
}
function show() {
  content.innerHTML = `<section style="margin:24px 0" data-student>
    <h2 tabindex="-1">مرحبًا، طالب افتراضي</h2>
    <p>عرض توضيحي للقراءة فقط · لا تسليم أو تعديل أو دخول حقيقي.</p>
    <h3>أنشطتي الافتراضية</h3><ul><li>قراءة قصة قصيرة — لم يبدأ</li><li>مشروع الأشكال — قيد العمل</li><li>تدريب الجمع — مكتمل</li></ul>
    <h3>تقدمي الافتراضي</h3><p>1 من 3 أنشطة مكتمل</p>
    <progress value="1" max="3" aria-label="نشاط واحد مكتمل من ثلاثة">1 من 3</progress>
    <p>مثال درجة مصطنعة: 8 من 10</p>
    <button type="button" data-reset>العودة لتجربة الدعوة</button>
  </section>`;
  content.querySelector('h2').focus();
}
app.addEventListener('click', event => {
  if (event.target.closest('[data-open]')) show();
  if (event.target.closest('[data-reset]')) { entry(); content.querySelector('[data-open]').focus(); }
});
app.addEventListener('submit', event => {
  if (!event.target.matches('form')) return;
  event.preventDefault();
  const input = content.querySelector('input');
  if (input.value.trim().toUpperCase() === 'DEMO-ONLY') show();
  else {
    input.setAttribute('aria-invalid', 'true');
    content.querySelector('[data-error]').textContent = 'استخدم المثال DEMO-ONLY فقط، دون بيانات شخصية.';
    input.focus();
  }
});
entry();
