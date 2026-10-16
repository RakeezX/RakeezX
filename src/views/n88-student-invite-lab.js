import { html, render } from '../lib/dom.js';
import { getActiveWorkspace } from '../store.js';
import { demoWorkspaceOnly, acceptsIllustrativeCode, DEMO_CODE, EXAMPLE } from '../lib/n88-invite-lab.js';

const allowed = () => demoWorkspaceOnly(getActiveWorkspace());
const denied = () => html`<section class="surface n88-lab" dir="rtl" data-n88-denied>
  <h2>النموذج غير متاح في مساحة الحساب</h2>
  <p>هذه التجربة متاحة في مساحة العرض التجريبية فقط. لا تتيح دخول طالب حقيقي.</p>
  <a class="btn" href="#/">العودة للرئيسية</a></section>`;
const entry = () => html`<div class="n88-lab__grid">
  <section class="surface"><h2>1. المعلم يسلّم الدعوة</h2>
    <p>في التصور المقترح، يسلّم المعلم دعوة فردية للطالب بعد التحقق منه مباشرة.</p>
    <p>على الجهاز نفسه: يضغط الطالب الرابط. من ورقة أو جهاز آخر: يمسح QR لفتح الرابط نفسه.</p>
    <p class="n88-lab__notice">لا يوجد QR قابل للمسح أو رابط مشاركة هنا؛ الزر يحاكي فتح الدعوة فقط، ولا يرسل شيئًا.</p>
    <button class="btn btn--primary" type="button" data-n88-open>تجربة فتح رابط الدعوة</button>
  </section>
  <section class="surface"><h2>2. بديل عند تعذّر فتح الرابط</h2>
    <p>جرّب كتابة المثال <bdi>${DEMO_CODE}</bdi>. ليس رمز دخول حقيقيًا، ولا يثبت الهوية.</p>
    <form data-n88-form><label for="n88-code">رمز توضيحي فقط</label>
      <input class="input" id="n88-code" name="example" dir="ltr" autocomplete="off" spellcheck="false" maxlength="32" aria-describedby="n88-error">
      <p id="n88-error" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">عرض المثال بالرمز</button>
    </form>
  </section></div>`;
const student = () => html`<section class="surface" data-n88-student>
  <h2 tabindex="-1" data-n88-heading>مرحبًا، ${EXAMPLE.name}</h2>
  <p>عرض توضيحي للقراءة فقط · لا تسليم ولا تعديل ولا دخول حقيقي.</p>
  <h3>أنشطتي الافتراضية</h3><ul>${EXAMPLE.tasks.map(task => html`<li>${task}</li>`)}</ul>
  <h3>تقدمي الافتراضي</h3><p>${EXAMPLE.progress}</p>
  <progress value="1" max="3" aria-label="نشاط واحد مكتمل من ثلاثة">1 من 3</progress>
  <p>${EXAMPLE.grade}</p>
  <button type="button" class="btn" data-n88-reset>العودة لتجربة الدعوة</button>
</section>`;

export default {
  title: () => 'تجربة دعوة الطالب',
  render() {
    if (!allowed()) return denied();
    return html`<section class="n88-lab" dir="rtl" data-n88-lab>
      <p class="n88-lab__notice"><strong>نموذج تجريبي ببيانات افتراضية فقط</strong><br>لا مصادقة ولا دعوات حقيقية. تُمسح التجربة عند مغادرة الشاشة أو تحديثها.</p>
      <div data-n88-content>${entry()}</div>
      <a class="btn" href="#/">العودة للرئيسية</a>
    </section>`;
  },
  afterPaint(root) {
    const lab = root.querySelector('[data-n88-lab]');
    if (!lab) return;
    const content = lab.querySelector('[data-n88-content]');
    const guard = () => {
      if (allowed()) return true;
      render(lab, denied());
      return false;
    };
    const show = () => {
      if (!guard()) return;
      render(content, student());
      content.querySelector('[data-n88-heading]').focus();
    };
    lab.addEventListener('click', event => {
      if (!guard()) return;
      if (event.target.closest('[data-n88-open]')) show();
      if (event.target.closest('[data-n88-reset]')) {
        render(content, entry());
        content.querySelector('[data-n88-open]').focus();
      }
    });
    lab.addEventListener('submit', event => {
      if (!event.target.matches('[data-n88-form]')) return;
      event.preventDefault();
      if (!guard()) return;
      const input = content.querySelector('#n88-code');
      if (acceptsIllustrativeCode(input.value)) show();
      else {
        input.setAttribute('aria-invalid', 'true');
        content.querySelector('#n88-error').textContent = 'استخدم المثال DEMO-ONLY فقط، ولا تدخل بيانات شخصية.';
        input.focus();
      }
    });
  },
};
