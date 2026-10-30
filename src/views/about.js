/** AI N145: public information only; no account or workspace dependencies. */
import { html } from '../lib/dom.js';
import { brandLockup } from '../lib/brand.js';
import { BUILD_META } from '../lib/build-meta.js';

export default {
  title: 'عن ركيز المعلم',
  back: () => '#/settings',
  render: () => html`
    <article class="about-page" dir="rtl" aria-label="عن ركيز المعلم">
      <header class="about-hero">
        ${brandLockup({ prominent: true })}
        <h2>أقل وقت للإدارة. أكثر وقت للتعليم.</h2>
        <p>رَكيز المعلم مساحة عمل لتنظيم الفصول والطلاب والحضور والدرجات والتقارير، لتبقى تفاصيل يومك التعليمي أقرب وأسهل.</p>
        <div class="about-meta"><span data-about-version>الإصدار <bdi>${BUILD_META.appVersion}</bdi></span><span>آخر تحديث لهذه الصفحة: <time datetime="2026-10-30">30 أكتوبر 2026</time></span></div>
      </header>
      <nav class="about-index" aria-label="محتويات الصفحة">
        <button type="button" data-about-section="about-faq">أسئلة شائعة</button>
        <button type="button" data-about-section="about-terms">شروط الاستخدام</button>
        <button type="button" data-about-section="about-privacy">سياسة الخصوصية</button>
        <button type="button" data-about-section="about-contact">التواصل والدعم</button>
      </nav>
      <section class="about-section" id="about-faq" tabindex="-1" aria-labelledby="about-faq-title">
        <h2 id="about-faq-title">أسئلة شائعة</h2>
        <details open><summary>هل أستطيع العمل دون إنترنت؟</summary><p>يمكن متابعة العمل المحلي المعتاد بعد تجهيز التطبيق على جهازك، ضمن صلاحية الحساب المتاحة. المزامنة السحابية وخدمات الإشعارات تحتاج إلى اتصال، وقد يلزم الاتصال للتحقق من الحساب وتحديث التطبيق.</p></details>
        <details open><summary>هل الحفظ على الجهاز يعني اكتمال المزامنة؟</summary><p>لا. الحفظ المحلي يختلف عن تأكيد وصول البيانات إلى السحابة. راجع حالة المزامنة قبل الانتقال إلى جهاز آخر أو مسح بيانات المتصفح؛ فقد تفقد العمل المحفوظ على هذا الجهاز وحده إذا مسحته قبل المزامنة.</p></details>
        <details><summary>هل ركيز جهة تعليمية رسمية؟</summary><p>ركيز تطبيق مستقل، وليس جهة تعليمية رسمية. يساعدك على تنظيم العمل، وتبقى مراجعة صحة الدرجات والتقارير قبل الاعتماد عليها مسؤوليتك.</p></details>
      </section>
      <section class="about-section" id="about-terms" tabindex="-1" aria-labelledby="about-terms-title">
        <h2 id="about-terms-title">شروط الاستخدام</h2>
        <ul>
          <li>استخدم ركيز لأغراض تعليمية مشروعة، وتأكد من أن لديك الصلاحية اللازمة لإدخال البيانات التعليمية ومشاركتها، خصوصًا بيانات الطلاب ومرفقاتهم.</li>
          <li>راجع الأسماء والحضور والدرجات والتقارير قبل مشاركتها أو الاعتماد عليها، واحرص على وجود نسخة مناسبة من عملك المهم.</li>
          <li>احمِ حسابك وجهازك وروابط الطلاب، ولا تشاركها مع غير المخوّلين. يُمنع الاستخدام المسيء أو محاولة الوصول إلى بيانات أو حسابات دون تصريح.</li>
          <li>قد تتطور الميزات المتاحة أو تتغير، وقد تحدث انقطاعات أو أخطاء في الخدمة. حدّث التطبيق بانتظام للاستفادة من الإصلاحات والتحسينات.</li>
        </ul>
      </section>
      <section class="about-section" id="about-privacy" tabindex="-1" aria-labelledby="about-privacy-title">
        <h2 id="about-privacy-title">سياسة الخصوصية</h2>
        <h3>ما البيانات التي تُعالج، ولماذا؟</h3>
        <p>نعالج معلومات الحساب والملف الشخصي، وبيانات المدرسة والفصول والطلاب والحضور والدرجات والمرفقات التي تختار إضافتها، لتشغيل التطبيق وحفظ العمل ومزامنته وتقديم ميزاته. وعند طلب الدعم، تُعالج رسالتك وبيانات التواصل والمعلومات الفنية المصاحبة، مثل إصدار التطبيق ونوع الجهاز وحالة المزامنة، لتشخيص المشكلة وتحسين الخدمة.</p>
        <h3>الحفظ ومقدمو الخدمة</h3>
        <p>يحتفظ التطبيق ببيانات محلية على جهازك، وتُنقل البيانات اللازمة للمزامنة والخدمات المتصلة إلى مقدمي الخدمة. نستعين بمقدمي خدمات الاستضافة والسحابة، وقد تُعالج البيانات خارج السعودية. منطقة قاعدة البيانات الرئيسية هي مومباي، الهند.</p>
        <p>نستخدم بيانات محدودة عن الزيارات والأداء لتحسين الخدمة وحمايتها.</p>
        <h3>الاحتفاظ وطلباتك وحماية بياناتك</h3>
        <p>نحتفظ بالبيانات بحسب حاجة تقديم الخدمة، مع مراعاة طلبات الحذف والالتزامات النظامية. لا يعني الحذف محو جميع النسخ الاحتياطية فورًا. يمكنك طلب الوصول أو النسخ أو التصحيح أو الحذف عبر بريد الدعم أدناه. قد نحتاج إلى التحقق من هويتك لحماية بياناتك.</p>
        <p>نعمل على حماية الحساب والبيانات، لكن لا توجد حماية مضمونة بالكامل. ساعد في حمايتها بقفل الجهاز وحماية الحساب وروابط الطلاب وتحديث التطبيق، ولا ترسل للدعم كلمات مرور أو رموز دخول أو بيانات طلاب غير لازمة.</p>
      </section>
      <section class="about-section about-contact" id="about-contact" tabindex="-1" aria-labelledby="about-contact-title">
        <h2 id="about-contact-title">التواصل والدعم</h2>
        <p>للمساعدة والاقتراحات، راسل بريد الدعم:</p>
        <a href="mailto:support@rakeezx.com" class="about-email"><bdi>support@rakeezx.com</bdi></a>
      </section>
    </article>`,
  afterPaint(root) {
    root.querySelectorAll('[data-about-section]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      const section = root.querySelector(`#${link.dataset.aboutSection}`);
      section?.focus({ preventScroll: true });
      section?.scrollIntoView({ block: 'start' });
    }));
  },
};
