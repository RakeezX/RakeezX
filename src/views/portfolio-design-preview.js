import { html, icon, fmtDate, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';
import { repaint } from '../repaint.js';
import { MINISTRY_LOGO_URL } from '../lib/ministry-brand.js';
import { printReport } from '../lib/report-print.js';
import { portfolioAttendanceEvidence, portfolioDesignSummary } from '../lib/portfolio-design-preview.js';

const styleUrl = new URL('../styles/portfolio-design-preview.css', import.meta.url).href;
function loadStyle() {
  if (document.querySelector('link[data-rakeez-portfolio-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  link.dataset.rakeezPortfolioStyle = '';
  document.head.append(link);
}
const short = (value, fallback='غير مسجل') => String(value ?? '').trim() || fallback;
const digits = new Intl.NumberFormat('ar-SA', { useGrouping: false });
const date = value => value ? fmtDate(value, false) : '—';
let selectedTeachingId = '';
let photoUrl = null;
let photoName = '';
let photoError = '';
const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

function teachingLabel(teaching) {
  return [sectionLabel(store.getSection(teaching.sectionId)), store.getSubject(teaching.subjectId)?.name].filter(Boolean).join(' · ');
}
function context() {
  const year = store.activeYear(), term = store.activeTerm();
  const report = store.executionReport({yearId: year?.id, termId: term?.id});
  const teachings = [...store.teachings()].sort((a,b)=>{
    const aGrade = Number(store.getSection(a.sectionId)?.grade)||0;
    const bGrade = Number(store.getSection(b.sectionId)?.grade)||0;
    return aGrade-bGrade || collator.compare(teachingLabel(a),teachingLabel(b));
  });
  const evidenceByTeaching = new Map(teachings.map(t=>[t.id,portfolioAttendanceEvidence(report,t.id)]));
  const selected = teachings.find(t=>t.id===selectedTeachingId) ||
    teachings.find(t=>(evidenceByTeaching.get(t.id)?.recordedSessions??0)>0) || teachings[0] || null;
  selectedTeachingId = selected?.id ?? '';
  const evidence = selected ? evidenceByTeaching.get(selected.id) : portfolioAttendanceEvidence(report,null);
  const summary = portfolioDesignSummary(evidence);
  const profile = store.state.profile ?? {};
  const person = {
    teacher: short(profile.teacherName, 'لم يُسجل اسم المعلم'),
    school: short(profile.schoolName, 'لم تُسجل المدرسة'),
    department: short(profile.educationDepartment, 'إدارة التعليم غير مسجلة'),
  };
  return {year,term,teaching:selected,teachings,evidence,summary,person,
    section: selected ? sectionLabel(store.getSection(selected.sectionId)) : 'غير محدد',
    subject: selected ? store.getSubject(selected.subjectId)?.name ?? 'غير محددة' : 'غير محددة'};
}

const ministry = (className='')=>html`<img class="folio-ministry ${className}" data-report-ministry src="${MINISTRY_LOGO_URL}" width="866" height="659" alt="وزارة التعليم" loading="eager" decoding="async">`;
const pageLabel = (name, page) => html`<div class="folio-sheet__overline" aria-hidden="true">
  <span>رَكيز المعلم · ملف الإنجاز</span><span>${name} · ${page}</span>
</div>`;
const foot = page=>html`<div class="folio-sheet__footer" aria-hidden="true"><span>وثيقة تصميم تجريبية · ركيز المعلم</span><span>${digits.format(page)}</span></div>`;

function cover(ctx) {
  const {year, term, person} = ctx;
  const yearMark = String(year?.label ?? '').match(/14\d{2}/)?.[0] ?? '';
  return html`<section class="folio-sheet folio-cover" data-portfolio-page="1" aria-label="غلاف ملف الإنجاز">
    <div class="folio-cover__hero">
      <div class="folio-cover__grain" aria-hidden="true"></div>
      <div class="folio-cover__top">
        <div class="folio-cover__ministry">${ministry()}</div>
        <span class="folio-cover__classification">التوثيق المهني للمعلم</span>
      </div>
      <div class="folio-cover__title">
        <span class="folio-cover__kicker">ملف الإنجاز</span>
        <h2>شواهد الأداء<br>الوظيفي</h2>
        <span class="folio-cover__rule"></span>
        <p>توثيق منظم للممارسات التعليمية والشواهد المرتبطة بها</p>
      </div>
      <div class="folio-cover__year" aria-hidden="true">${yearMark}</div>
    </div>
    <div class="folio-cover__details">
      <div class="folio-cover__meta-label">بيانات الملف</div>
      <div class="folio-cover__teacher">${person.teacher}</div>
      <div class="folio-cover__school">${person.school}</div>
      <div class="folio-cover__keyline"></div>
      <div class="folio-cover__bottom">
        <div><span>العام الدراسي</span><strong>${short(year?.label)}</strong></div>
        <div><span>الفترة</span><strong>${short(term?.name)}</strong></div>
        <div><span>إدارة التعليم</span><strong>${person.department}</strong></div>
      </div>
      <div class="folio-cover__mark">نسخة نموذجية للتصميم — ليست اعتمادًا للأداء الوظيفي</div>
    </div>
  </section>`;
}

function contents(ctx) {
  const {summary} = ctx;
  return html`<section class="folio-sheet folio-interior folio-contents" data-portfolio-page="2" aria-label="فهرس ملف الإنجاز">
    ${pageLabel('الفهرس', '02')}
    <div class="folio-interior__headline">
      <span class="folio-interior__eyebrow">دليل التنقل</span>
      <h2>المحتويات</h2>
      <p>أحد عشر معيارًا، مع تمييز ما أُدرج في هذه النسخة التجريبية عن الأقسام التي لم تُضف لها شواهد.</p>
    </div>
    <div class="folio-contents__guide"><span>الباب</span><span>المعيار</span><span>الصفحة</span></div>
    <div class="folio-contents__rows">
      ${summary.criteria.map(c=>html`<div class="folio-contents__row">
        <span class="folio-contents__number">${c.number}</span>
        <span class="folio-contents__title">${c.title}</span>
        <span class="folio-contents__page">${c.page}</span>
      </div>`)}
    </div>
    <div class="folio-contents__note"><span class="folio-dot"></span>
      أرقام الصفحات تظهر عند إدراج محتوى فعلي. وجود المعيار في الفهرس لا يعني استيفاءه.
    </div>
    ${foot(2)}
  </section>`;
}

function coverage(ctx) {
  const {summary, evidence} = ctx;
  return html`<section class="folio-sheet folio-interior folio-coverage" data-portfolio-page="3" aria-label="لوحة توثيق الشواهد">
    ${pageLabel('لوحة التوثيق', '03')}
    <div class="folio-interior__headline">
      <span class="folio-interior__eyebrow">نظرة على الملف</span>
      <h2>لوحة التوثيق</h2>
      <p>تعرض هذه اللوحة <strong>توفر مصادر الشواهد في النموذج فقط</strong>، ولا تمثل تقييمًا أو درجة أداء وظيفي.</p>
    </div>
    <div class="folio-coverage__metrics">
      <div><span>المعايير</span><strong>${digits.format(summary.criteriaCount)}</strong><small>عنصرًا تنظيميًا</small></div>
      <div><span>شواهد أولية</span><strong>${digits.format(summary.evidenceCount)}</strong><small>وفق السجلات المتاحة</small></div>
      <div><span>مصادر مسجلة</span><strong>${digits.format(summary.sourcedCriteriaCount)}</strong><small>معايير لها بيانات داعمة</small></div>
    </div>
    <div class="folio-coverage__section">
      <h3>موقف التوثيق الحالي</h3>
      <p>يُعرض شاهد رصد الحضور كنموذج أولي يدعم «الإدارة الصفية» ولا يستوفي المعيار بمفرده.</p>
    </div>
    <div class="folio-coverage__list">
      ${summary.criteria.map(c=>html`<div class="folio-coverage__row">
        <span class="folio-coverage__num">${c.number}</span>
        <span class="folio-coverage__title">${c.title}</span>
        <span class="folio-coverage__status ${c.hasSource ? 'is-present' : ''}">
          ${c.hasSource ? 'شاهد أولي' : 'لم يُضف بعد'}
        </span>
      </div>`)}
    </div>
    <div class="folio-coverage__truth">
      <strong>حدود هذا النموذج</strong>
      <span>${evidence.recordedSessions ? 'توجد سجلات حضور فعلية للحصص المختارة.' : 'لا توجد سجلات حضور مؤهلة للاشتقاق في الإسناد المختار.'}
      لا تُستنتج الاستراتيجيات المستخدمة أو جودة التدريس أو تحقق المعيار من هذه السجلات.</span>
    </div>
    ${foot(3)}
  </section>`;
}

function evidencePage(ctx) {
  const {teaching,section,subject,evidence,year,term} = ctx;
  const rows=evidence.rows.slice(0,3);
  const hasData=evidence.recordedSessions>0;
  return html`<section class="folio-sheet folio-interior folio-evidence" data-portfolio-page="4" aria-label="نموذج شاهد الإدارة الصفية">
    ${pageLabel('الشاهد الأول', '04')}
    <div class="folio-interior__headline folio-interior__headline--compact">
      <span class="folio-interior__eyebrow">09 · الإدارة الصفية · شاهد داعم</span>
      <h2>متابعة رصد حضور الطلاب</h2>
      <p>وثيقة مستخلصة من سجلات ركيز، ولا تثبت بمفردها جودة الإدارة الصفية أو حضور جميع الطلاب.</p>
    </div>
    <div class="folio-evidence__meta">
      <div><small>الفصل والمادة</small><strong>${teaching ? [section, subject].join(' · ') : 'غير محدد'}</strong></div>
      <div><small>السنة والفترة</small><strong>${short(year?.label)} · ${short(term?.name)}</strong></div>
      <div><small>نوع المصدر</small><strong>سجلات داخل ركيز</strong></div>
    </div>
    ${hasData?html`
      <div class="folio-evidence__metrics">
        <div><span>حصص لها رصد</span><strong>${digits.format(evidence.recordedSessions)}</strong></div>
        <div><span>رصد مكتمل</span><strong>${digits.format(evidence.fullSessions)}</strong></div>
        <div><span>رصد جزئي</span><strong>${digits.format(evidence.partialSessions)}</strong></div>
      </div>
      <div class="folio-evidence__section-head"><h3>أحدث الحصص المسجلة</h3><span>حتى ${date(evidence.asOf)}</span></div>
      <table class="folio-evidence__table">
        <thead><tr><th>التاريخ</th><th>الحصة</th><th>الرصد</th><th>الحالة</th></tr></thead>
        <tbody>${rows.map(row=>html`<tr><td>${date(row.date)}</td><td>${digits.format(row.period)}</td>
          <td><bdi dir="ltr">${row.recorded}/${row.expected}</bdi></td><td>${row.state}</td></tr>`)}</tbody>
      </table>
      ${evidence.rows.length>rows.length?html`<p class="folio-evidence__small-note">عُرضت أحدث ${rows.length} حصص من أصل ${evidence.rows.length}، ولا تتضمن هذه الصفحة كل السجل.</p>`:''}
      `:html`<div class="folio-evidence__empty">لا يوجد رصد حضور محفوظ في الإسناد المختار. هذا موضع معاينة فقط، ولا يُنشأ شاهد ببيانات افتراضية.</div>`}
    <div class="folio-evidence__image-block">
      <div class="folio-evidence__image-caption"><h3>صورة داعمة (اختيارية)</h3><span>تضاف بمراجعة المعلم</span></div>
      ${photoUrl?html`<img class="folio-evidence__photo" src="${photoUrl}" alt="الصورة التي اختارها المعلم لدعم الشاهد" />`:html`
        <div class="folio-evidence__image-placeholder"><span class="folio-evidence__photo-icon" aria-hidden="true">✧</span>
          <strong>لم تُرفق صورة</strong><span>يمكن إضافة صورة داعمة محليًا من أدوات المعاينة</span></div>`}
    </div>
    <div class="folio-evidence__provenance">
      <b>مصدر البيانات:</b> ${evidence.source}، ضمن الفصل والمادة والفترة المحددة.
      ${hasData?html` عدد علامات الرصد: <bdi dir="ltr">${evidence.recordedMarks}/${evidence.expectedMarks}</bdi>.`:''}
      ${evidence.omitted?html` استُبعد ${evidence.omitted} سجلًا غير متسق أو مكررًا.`:''}
      <span>لا تظهر أسماء الطلاب أو درجاتهم الفردية في الملف.</span>
    </div>
    ${foot(4)}
  </section>`;
}

export default {
  title: ()=>'ملف الإنجاز — نموذج التصميم',
  subtitle: ()=>store.activeYear()?.label ?? '',
  back: ()=>'#/reports',
  wide: true,
  beforeRender() { loadStyle(); selectedTeachingId = ''; photoError = ''; },
  onUnmount() { if(photoUrl) URL.revokeObjectURL(photoUrl); photoUrl=null; photoName=''; photoError=''; },
  render() {
    const ctx = context();
    return html`<div class="folio-page" dir="rtl">
      <header class="folio-workspace noprint">
        <div><span class="folio-workspace__eyebrow">ملف الإنجاز · مراجعة التصميم</span>
          <h1>ملف الإنجاز المهني</h1>
          <p>أربع صفحات نموذجية تجمع هوية ركيز ومخرجاته الفعلية. لا يتم حفظ الصور أو إنشاء سجلات جديدة.</p></div>
        <span class="folio-workspace__status">Preview فقط</span>
      </header>
      <section class="folio-toolbar noprint" aria-label="التحكم في نموذج الملف">
        <label class="field folio-toolbar__class"><span class="field__label">الفصل والمادة لنموذج الشاهد</span>
          <select class="select" data-change="teaching">
            ${ctx.teachings.map(t=>html`<option value="${t.id}" ${t.id===selectedTeachingId?'selected':''}>${teachingLabel(t)}</option>`)}
          </select>
        </label>
        <label class="folio-toolbar__upload"><span>${photoUrl?'استبدال الصورة الداعمة':'إضافة صورة داعمة'}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-change="photo" aria-label="إضافة صورة داعمة" />
        </label>
        ${photoUrl?html`<button class="btn btn--ghost" data-act="clear-photo">إزالة الصورة</button>`:''}
        <button class="btn btn--primary" data-act="print">${icon('print')} طباعة / PDF</button>
        <p class="folio-toolbar__helper">الصورة المختارة تبقى على جهازك داخل هذه المعاينة، ولا تُرفع إلى الخادم. ${photoName?`المرفق: ${photoName}`:''}${photoError?` · ${photoError}`:''}</p>
      </section>
      <nav class="folio-nav noprint" aria-label="صفحات النموذج">
        ${[['1','الغلاف'],['2','الفهرس'],['3','لوحة التوثيق'],['4','نموذج الشاهد']].map(([n,title])=>html`
          <button type="button" class="folio-nav__item" data-act="go" data-page="${n}">
            <span>${digits.format(Number(n))}</span> ${title}</button>`)}
      </nav>
      <div class="print-report folio-document" data-folio-document>
        ${cover(ctx)}${contents(ctx)}${coverage(ctx)}${evidencePage(ctx)}
      </div>
    </div>`;
  },
  actions: {
    teaching(el) { selectedTeachingId=el.value; repaint(); },
    go(el) { document.querySelector(`[data-portfolio-page="${el.dataset.page}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}); },
    photo(el) {
      const file = el.files?.[0];
      if(!file) return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>6*1024*1024) {
        photoError = 'اختر صورة JPG أو PNG أو WebP لا تزيد عن 6 ميجابايت';
        toast(photoError,'warn');repaint();return;
      }
      if(photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl=URL.createObjectURL(file);
      photoName=String(file.name).slice(0,85);
      photoError='';
      repaint();
    },
    'clear-photo'() { if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;photoName='';repaint(); },
    async print(){
      const photo = document.querySelector('.folio-evidence__photo');
      if(photo && !photo.complete) {
        try { await photo.decode(); }
        catch { toast('تعذّر تحميل الصورة الداعمة. راجعها أو أزلها قبل الطباعة.', 'danger'); return false; }
      }
      return printReport('ملف الإنجاز المهني - نموذج التصميم');
    },
  },
};
