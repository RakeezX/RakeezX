import { html, icon, fmtDate, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';
import { repaint } from '../repaint.js';
import { MINISTRY_LOGO_URL } from '../lib/ministry-brand.js';
import { printReport } from '../lib/report-print.js';
import { PORTFOLIO_CRITERIA, portfolioYearEvidence, portfolioDesignSummary } from '../lib/portfolio-design-preview.js';
import { buildPortfolioEvidenceSuggestions, guideForCriterion } from '../lib/portfolio-smart-evidence.js';
import { F09_EVIDENCE_TEMPLATES, templatesForCriterion } from '../lib/portfolio-evidence-templates.js';

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
let editingCriterion = '09';
let selectedSuggestionId = null;
const photoLayouts = new Map();
const photoGroups = new Map();
const selectedByCriterion = new Map();
const descriptions = new Map();
const titles = new Map();
const layoutFor = key => photoLayouts.get(key) ?? 'two';
const photosFor = key => photoGroups.get(key) ?? [];
let photoError = '';
function context() {
  const year = store.activeYear();
  const terms = year ? store.termsOf(year.id) : [];
  const groups = terms.map(term => ({
    report: store.executionReport({ yearId: year.id, termId: term.id }),
    teachings: store.teachings(term.id, { includeArchived: true }).map(teaching => ({
      ...teaching,
      sectionLabel: sectionLabel(store.getSection(teaching.sectionId)),
      subjectName: store.getSubject(teaching.subjectId)?.name ?? '',
    })),
  }));
  const evidence = portfolioYearEvidence(groups);
  const allTeachings = groups.flatMap(group=>group.teachings);
  const teachingIds = [...new Set(allTeachings.map(teaching=>teaching.id))];
  const sources = buildPortfolioEvidenceSuggestions({
    yearId:year?.id,teachingIds,attendance:evidence,asOf:evidence.asOf,
    slots:teachingIds.flatMap(id=>store.slotsOf(id)),
    sessions:teachingIds.flatMap(id=>store.sessionsOf(id)),
    classRules:teachingIds.flatMap(id=>store.classRulesOf(id)),
    items:teachingIds.flatMap(id=>store.items(id)),
    scores:store.state.scores ?? [],
    assignments:store.state.assignments ?? [],
    submissions:store.state.submissions ?? [],
  });
  const recorded = sources.filter(candidate=>candidate.criterion===editingCriterion);
  const templates = templatesForCriterion(editingCriterion);
  const candidates = [...recorded,...templates];
  const manualId='manual:'+editingCriterion;
  const lastChoice=selectedByCriterion.get(editingCriterion);
  const chosenId=selectedSuggestionId ?? lastChoice ?? candidates[0]?.id ?? manualId;
  const proposal=chosenId===manualId?null:(candidates.find(s=>s.id===chosenId)||candidates[0]||null);
  selectedSuggestionId=proposal?.id ?? manualId;
  selectedByCriterion.set(editingCriterion,selectedSuggestionId);
  const photoKey=proposal?.id ?? manualId;
  const guide=guideForCriterion(editingCriterion);
  const summaryBase = portfolioDesignSummary(evidence);
  const summary = {...summaryBase,criteria:summaryBase.criteria.map(c=>({...c,
    page:c.number===editingCriterion && (proposal||photosFor(photoKey).length) ? '4':'—'}))};
  const criterion = PORTFOLIO_CRITERIA.find(c => c.number === editingCriterion) ?? PORTFOLIO_CRITERIA[8];
  const canPrint=!!proposal || photosFor(photoKey).length>0 || !!descriptions.get(photoKey)?.trim();
  const title=titles.get(photoKey)??proposal?.title??guide?.evidence??criterion.title;
  const profile = store.state.profile ?? {};
  const person = {
    teacher: short(profile.teacherName, 'اسم المعلم'),
    school: short(profile.schoolName, 'اسم المدرسة'),
    department: short(profile.educationDepartment, 'إدارة التعليم'),
  };
  return {year,terms,evidence,summary,person,criterion,guide,proposal,candidates,sources,photoKey,
    photos:photosFor(photoKey),photoLayout:layoutFor(photoKey),
    description:descriptions.get(photoKey)??proposal?.description??'',title,canPrint};
}

const ministry = (className='')=>html`<img class="folio-ministry ${className}" data-report-ministry src="${MINISTRY_LOGO_URL}" width="866" height="659" alt="وزارة التعليم" loading="eager" decoding="async">`;
const pageLabel = (name, page) => html`<div class="folio-sheet__overline" aria-hidden="true">
  <span>رَكيز المعلم · ملف الإنجاز</span><span>${name} · ${page}</span>
</div>`;
const foot = page=>html`<div class="folio-sheet__footer" aria-hidden="true"><span>أُعد بواسطة ركيز المعلم</span><span>${digits.format(page)}</span></div>`;

function cover(ctx) {
  const {year, person, evidence} = ctx;
  const yearMark = String(year?.label ?? '').match(/14\d{2}/)?.[0] ?? '';
  return html`<section class="folio-sheet folio-cover" data-portfolio-page="1" aria-label="غلاف ملف الإنجاز">
    <div class="folio-cover__hero">
      <div class="folio-cover__grain" aria-hidden="true"></div>
      <div class="folio-cover__top">
        <span class="folio-cover__classification">المملكة العربية السعودية</span>
        <div class="folio-cover__ministry">${ministry()}</div>
        <span class="folio-cover__classification">ملف الإنجاز المهني</span>
      </div>
      <div class="folio-cover__title">
        <span class="folio-cover__kicker">ملف الإنجاز المهني</span>
        <h2>شواهد الأداء<br>الوظيفي</h2>
        <span class="folio-cover__rule"></span>
        <p>مسيرة من العطاء والممارسات التعليمية والإنجازات المهنية</p>
      </div>
      <div class="folio-cover__year" aria-hidden="true">${yearMark}</div>
    </div>
    <div class="folio-cover__details">
      <div class="folio-cover__meta-label">صاحب الإنجاز</div>
      <div class="folio-cover__teacher">${person.teacher}</div>
      <div class="folio-cover__school">${person.school}</div>
      <div class="folio-cover__keyline"></div>
      <div class="folio-cover__bottom">
        <div><span>العام الدراسي</span><strong>${short(year?.label)}</strong></div>
        <div><span>نوع الملف</span><strong>ملف الإنجاز المهني</strong></div>
        <div><span>إدارة التعليم</span><strong>${person.department}</strong></div>
      </div>

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
      <p>المجالات المهنية الأحد عشر التي توثق خبرة المعلم وأعماله خلال العام الدراسي.</p>
    </div>
    <div class="folio-contents__guide"><span>الباب</span><span>المعيار</span><span>الصفحة</span></div>
    <div class="folio-contents__rows">
      ${summary.criteria.map(c=>html`<div class="folio-contents__row">
        <span class="folio-contents__number">${c.number}</span>
        <span class="folio-contents__title">${c.title}</span>
        <span class="folio-contents__page">${c.page === '—' ? '' : c.page}</span>
      </div>`)}
    </div>
    <div class="folio-contents__note"><span class="folio-dot"></span>
      أعمال تعليمية ومهنية تجمع التخطيط والتدريس والتقويم والتواصل، في ملف واحد منظم.
    </div>
    ${foot(2)}
  </section>`;
}

function coverage(ctx) {
  const {summary, evidence} = ctx;
  return html`<section class="folio-sheet folio-interior folio-coverage" data-portfolio-page="3" aria-label="لوحة توثيق الشواهد">
    ${pageLabel('موجز الإنجازات', '03')}
    <div class="folio-interior__headline">
      <span class="folio-interior__eyebrow">حصيلة عام دراسي</span>
      <h2>أعمال وإنجازات المعلم</h2>
      <p>نظرة منظمة على أعمال المعلم المسجلة في ركيز عبر فصوله ومواده خلال العام الدراسي.</p>
    </div>
    <div class="folio-coverage__metrics">
      <div><span>المجالات المهنية</span><strong>${digits.format(summary.criteriaCount)}</strong><small>مجالًا في ملف الإنجاز</small></div>
      <div><span>الفصول الدراسية</span><strong>${evidence.sectionCount ? digits.format(evidence.sectionCount) : '—'}</strong><small>ضمن أعمال المعلم</small></div>
      <div><span>المواد الدراسية</span><strong>${evidence.subjectCount ? digits.format(evidence.subjectCount) : '—'}</strong><small>خلال العام الدراسي</small></div>
    </div>
    <div class="folio-coverage__section">
      <h3>مجالات العطاء المهني</h3>
      <p>يجمع ركيز المجالات المهنية في مكان واحد، مع إمكانية إرفاق الشواهد الخاصة بكل مجال.</p>
    </div>
    <div class="folio-coverage__list">
      ${summary.criteria.map(c=>html`<div class="folio-coverage__row">
        <span class="folio-coverage__num">${c.number}</span>
        <span class="folio-coverage__title">${c.title}</span>

      </div>`)}
    </div>

    ${foot(3)}
  </section>`;
}

function witnessImageTools(ctx) {
  return html`<div class="folio-evidence__media-tools noprint" role="group" aria-label="صور الشاهد المحدد">
    <label class="folio-evidence__upload">
      <span>+ إضافة صور للشاهد</span>
      <input type="file" multiple accept="image/png,image/jpeg,image/webp" data-change="photo" aria-label="إضافة صور للشاهد" />
    </label>
    <label class="folio-evidence__layout">
      <span>توزيع الصور</span>
      <select class="select" data-change="layout" aria-label="توزيع الصور">
        <option value="one" ${ctx.photoLayout==='one'?'selected':''}>صورة في الصف</option>
        <option value="two" ${ctx.photoLayout==='two'?'selected':''}>صورتان في الصف</option>
        <option value="three" ${ctx.photoLayout==='three'?'selected':''}>ثلاث صور في الصف</option>
      </select>
    </label>
    ${ctx.photos.length?html`<button class="btn btn--ghost" data-act="clear-photo">حذف جميع الصور</button>`:''}
  </div>`;
}

function evidencePage(ctx) {
  const {evidence,year,criterion,photos,photoLayout,proposal} = ctx;
  const isAttendance = proposal?.id === 'rakeez:attendance:'+year?.id;
  const rows = evidence.rows.slice(0,4);
  const hasData = isAttendance && evidence.recordedSessions > 0;
  const cols = photoLayout === 'one' ? 1 : photoLayout === 'three' ? 3 : 2;
  const firstPhotos = photos.slice(0, {one:2,two:4,three:6}[photoLayout] ?? 4);
  const rowsOfPhotos = Math.ceil(firstPhotos.length / cols) || 1;
  const photoHeight = Math.min(164, Math.max(72, Math.floor(290 / rowsOfPhotos)));
  const sectionCounts = new Map();
  if (hasData) for (const row of evidence.rows) {
    const key = row.section || 'فصل';
    sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1);
  }
  const chartRows = [...sectionCounts].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const chartMax = Math.max(1,...chartRows.map(row=>row[1]));
  return html`<section class="folio-sheet folio-interior folio-evidence" data-portfolio-page="4" aria-label="شاهد مهني مختار">
    ${pageLabel('شاهد مهني', '04')}
    <div class="folio-interior__headline folio-interior__headline--compact">
      <span class="folio-interior__eyebrow">${criterion.number} · ${criterion.title}</span>
      <div class="folio-evidence__inline-edit noprint">
        <input class="folio-evidence__title-edit" data-change="suggestion-title" value="${ctx.title}"
          maxlength="100" aria-label="عنوان الشاهد" />
        <textarea class="folio-evidence__description-edit" data-change="suggestion-description"
          aria-label="وصف الشاهد" maxlength="450" rows="2" placeholder="اكتب وصفًا موجزًا للشاهد">${ctx.description}</textarea>
      </div>
      <div class="folio-evidence__print-copy">
        <h2>${ctx.title}</h2>
        ${ctx.description?html`<p>${ctx.description}</p>`:''}
      </div>
    </div>
    <div class="folio-evidence__meta">
      <div><small>العام الدراسي</small><strong>${short(year?.label)}</strong></div>
      <div><small>المعيار المهني</small><strong>${criterion.title}</strong></div>
      <div><small>نطاق الإنجاز</small><strong>جميع الفصول والمواد</strong></div>
    </div>
    ${hasData?html`
      <div class="folio-evidence__metrics">
        <div><span>حصص جرى رصدها</span><strong>${digits.format(evidence.recordedSessions)}</strong></div>
        <div><span>حصص اكتمل رصدها</span><strong>${digits.format(evidence.fullSessions)}</strong></div>
        <div><span>فصول شملتها المتابعة</span><strong>${digits.format(new Set(evidence.rows.map(row=>row.section)).size)}</strong></div>
      </div>
      <div class="folio-evidence__section-head"><h3>نماذج من أعمال المتابعة</h3><span>${short(year?.label)}</span></div>
      <table class="folio-evidence__table">
        <thead><tr><th>التاريخ</th><th>الفصل</th><th>المادة</th><th>الحصة</th></tr></thead>
        <tbody>${rows.map(row=>html`<tr><td>${date(row.date)}</td><td>${row.section}</td>
          <td>${row.subject}</td><td>${digits.format(row.period)}</td></tr>`)}</tbody>
      </table>
      ${!photos.length && chartRows.length ? html`<div class="folio-evidence__chart">
        <div class="folio-evidence__section-head"><h3>توزيع أعمال المتابعة على الفصول</h3><span>${digits.format(evidence.recordedSessions)} حصة موثقة بالرصد</span></div>
        ${chartRows.map(([label,count])=>html`<div class="folio-evidence__chart-row">
          <span>${label}</span><div class="folio-evidence__chart-track"><i style="width:${Math.round(count/chartMax*100)}%"></i></div>
          <b>${digits.format(count)}</b>
        </div>`)}
      </div>` : ''}
      `:''}
    ${proposal && !isAttendance?html`
      <div class="folio-evidence__metrics">
        ${proposal.metrics.slice(0,3).map(([label,value])=>html`<div><span>${label}</span><strong>${typeof value==='number'?digits.format(value):value}</strong></div>`)}
      </div>
      ${proposal.table?.length?html`<div class="folio-evidence__section-head"><h3>نماذج من الأعمال المسجلة</h3></div>
        <table class="folio-evidence__table"><thead><tr>${proposal.tableHeaders.map(h=>html`<th>${h}</th>`)}</tr></thead>
          <tbody>${proposal.table.map(row=>html`<tr>${row.map(cell=>html`<td>${cell}</td>`)}</tr>`)}</tbody></table>`:''}
    `:''}
    ${proposal?.sourceKind==='template' && !photos.length && proposal.visualSteps?.length ? html`
      <div class="folio-evidence__illustration" role="group" aria-label="مخطط توضيحي للنشاط">
        <div class="folio-evidence__image-caption"><h3>خطوات النشاط</h3><span>مخطط توضيحي</span></div>
        <div class="folio-evidence__steps">
          ${proposal.visualSteps.map((step,i)=>html`<div class="folio-evidence__step">
            <span class="folio-evidence__step-number">${digits.format(i+1)}</span>
            <strong>${step}</strong>
          </div>`)}
        </div>
      </div>` : ''}
    <div class="folio-evidence__image-block ${firstPhotos.length ? '' : 'noprint'}">
      <div class="folio-evidence__image-caption"><h3>صور الشاهد</h3><span>${photos.length ? `${digits.format(photos.length)} صور` : ''}</span></div>
      ${witnessImageTools(ctx)}
      ${firstPhotos.length ? html`<div class="folio-evidence__gallery folio-evidence__gallery--${photoLayout}" style="--folio-photo-height:${photoHeight}px">
        ${firstPhotos.map((photo, i)=>html`<figure class="folio-evidence__gallery-item">
          <img class="folio-evidence__photo" src="${photo.url}" alt="صورة داعمة رقم ${digits.format(i+1)}" loading="eager" decoding="async" />
          <figcaption class="folio-evidence__image-tools noprint"><span>${photo.name}</span>
            <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="-1" aria-label="تقديم الصورة" ${i===0?'disabled':''}>↑</button>
            <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="1" aria-label="تأخير الصورة" ${i===photos.length-1?'disabled':''}>↓</button>
            <button type="button" data-act="remove-photo" data-id="${photo.id}" aria-label="حذف الصورة">×</button>
          </figcaption>
        </figure>`) }
      </div>` : ''}
    </div>
    ${foot(4)}
  </section>`;
}

function photoContinuation(ctx) {
  const {photos,photoLayout,criterion} = ctx;
  const first = {one:2,two:4,three:6}[photoLayout] ?? 4;
  const capacity = {one:4,two:8,three:9}[photoLayout] ?? 8;
  const cols = photoLayout === 'one' ? 1 : photoLayout === 'three' ? 3 : 2;
  const pages=[];
  for(let offset=first; offset<photos.length; offset+=capacity) {
    const batch=photos.slice(offset,offset+capacity);
    const num=5+pages.length;
    const imageHeight=Math.min(190,Math.max(110,Math.floor(610/Math.ceil(batch.length/cols))));
    pages.push(html`<section class="folio-sheet folio-interior folio-evidence folio-evidence--continuation" data-portfolio-page="${num}" aria-label="صور مرفقة بالشاهد">
      ${pageLabel('صور الشاهد', String(num).padStart(2,'0'))}
      <div class="folio-interior__headline folio-interior__headline--compact">
        <span class="folio-interior__eyebrow">${criterion.number} · ${criterion.title}</span>
        <h2>شواهد مصوّرة — تابع</h2>
        <p>مجموعة صور داعمة للأعمال المهنية ضمن هذا المعيار.</p>
      </div>
      <div class="folio-evidence__image-block">
        <div class="folio-evidence__gallery folio-evidence__gallery--${photoLayout}" style="--folio-photo-height:${imageHeight}px">
          ${batch.map((photo,i)=>html`<figure class="folio-evidence__gallery-item">
            <img class="folio-evidence__photo" src="${photo.url}" alt="صورة داعمة رقم ${digits.format(offset+i+1)}" loading="eager" decoding="async" />
            <figcaption class="folio-evidence__image-tools noprint"><span>${photo.name}</span>
              <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="-1" aria-label="تقديم الصورة" ${offset+i===0?'disabled':''}>↑</button>
              <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="1" aria-label="تأخير الصورة" ${offset+i===photos.length-1?'disabled':''}>↓</button>
              <button type="button" data-act="remove-photo" data-id="${photo.id}" aria-label="حذف الصورة">×</button>
            </figcaption>
          </figure>`)}
        </div>
      </div>
      ${foot(num)}
    </section>`);
  }
  return pages;
}

function suggestionsPanel(ctx) {
  const {guide,proposal,candidates} = ctx;
  return html`<section class="folio-suggestion-studio noprint" aria-label="مساعد تجهيز الشواهد">
    <header class="folio-suggestion-studio__head">
      <div><span>مساعد ركيز</span><h2>مكتبة الشواهد الجاهزة</h2>
        <p>اختر شاهدًا من أعمالك المسجلة أو قالبًا مناسبًا، وعدّله مباشرة داخل صفحة الشاهد.</p></div>
      <strong class="folio-suggestion-studio__count">${digits.format(candidates.length)} خيارات</strong>
    </header>
    <div class="folio-suggestion-studio__candidates">
      ${candidates.map(item=>html`<button type="button"
        class="folio-suggestion-studio__choice ${proposal?.id===item.id?'is-selected':''}"
        data-act="pick-suggestion" data-id="${item.id}" aria-pressed="${proposal?.id===item.id}">
          <strong>${item.title}</strong>
          <small>${item.sourceKind==='template'?'قالب قابل للتخصيص':'من بيانات ركيز'}</small>
      </button>`)}
      <button type="button" class="folio-suggestion-studio__choice ${!proposal?'is-selected':''}"
        data-act="manual-suggestion" aria-pressed="${!proposal}">
        <strong>شاهد جديد</strong><small>أبدأ بعنوان ووصف وصور خاصة بي</small>
      </button>
    </div>
    <details class="folio-suggestion-studio__details">
      <summary>أمثلة ومصادر داعمة لهذا المعيار</summary>
      <div class="folio-suggestion-studio__details-body">
        <p><strong>مكونات الشاهد:</strong> ${guide?.content||''}</p>
        <p><strong>إضافة مقترحة:</strong> ${proposal?.imageHint||guide?.minimum||''}</p>
        <p><strong>مصادر لاحقة:</strong> مدرستي (${guide?.madrasati||'غير متاح'})، نور (${guide?.noor||'غير متاح'}).</p>
      </div>
    </details>
  </section>`;
}

export default {
  title: ()=>'ملف الإنجاز — نموذج التصميم',
  subtitle: ()=>store.activeYear()?.label ?? '',
  back: ()=>'#/reports',
  wide: true,
  beforeRender() { loadStyle(); editingCriterion = '09'; selectedSuggestionId=null; photoError = ''; },
  onUnmount() {
    for (const group of photoGroups.values()) for (const photo of group) URL.revokeObjectURL(photo.url);
    photoGroups.clear(); photoLayouts.clear(); selectedByCriterion.clear(); descriptions.clear(); titles.clear();
    selectedSuggestionId=null; photoError = '';
  },
  render() {
    const ctx = context();
    const extraPages = photoContinuation(ctx);
    const navPages = [['1','الغلاف'],['2','الفهرس'],['3','موجز الإنجازات'],['4','الشاهد المختار'],
      ...extraPages.map((_,i)=>[String(i+5),'صور الشاهد'])];
    return html`<div class="folio-page" dir="rtl">
      <header class="folio-workspace noprint">
        <div><span class="folio-workspace__eyebrow">ملف الإنجاز · مراجعة التصميم</span>
          <h1>ملف الإنجاز المهني</h1>
          <p>ملف شامل لأعمال المعلم في جميع مواده وفصوله خلال العام الدراسي، مع شواهد وصور لكل معيار.</p></div>
        <span class="folio-workspace__status">Preview فقط</span>
      </header>
      <section class="folio-toolbar noprint" aria-label="التحكم في نموذج الملف">
        <label class="field folio-toolbar__class"><span class="field__label">المعيار الذي تود تنسيق شواهده</span>
          <select class="select" data-change="criterion" aria-label="معيار الشاهد">
            ${PORTFOLIO_CRITERIA.map(c=>html`<option value="${c.number}" ${c.number===editingCriterion?'selected':''}>${c.number} · ${c.title}</option>`)}
          </select>
        </label>
        <button class="btn btn--primary" data-act="print" ${ctx.canPrint?'':'disabled'}>${icon('print')} طباعة / PDF</button>
        ${photoError?html`<p class="folio-toolbar__helper" role="status">${photoError}</p>`:''}
      </section>
      ${suggestionsPanel(ctx)}
      <nav class="folio-nav noprint" aria-label="صفحات النموذج">
        ${navPages.map(([n,title])=>html`
          <button type="button" class="folio-nav__item" data-act="go" data-page="${n}">
            <span>${digits.format(Number(n))}</span> ${title}</button>`)}
      </nav>
      <div class="print-report folio-document" data-folio-document>
        ${cover(ctx)}${contents(ctx)}${coverage(ctx)}${evidencePage(ctx)}${extraPages}
      </div>
    </div>`;
  },
  actions: {
    criterion(el) { editingCriterion = el.value; selectedSuggestionId=null; photoError = ''; repaint(); },
    'pick-suggestion'(el) { selectedSuggestionId=el.dataset.id; selectedByCriterion.set(editingCriterion,selectedSuggestionId); repaint(); },
    'manual-suggestion'() { selectedSuggestionId='manual:'+editingCriterion;selectedByCriterion.set(editingCriterion,selectedSuggestionId); repaint(); },
    'suggestion-title'(el) { const key=context().photoKey; titles.set(key,el.value.slice(0,100)); repaint(); },
    'suggestion-description'(el) { const key=context().photoKey; descriptions.set(key,el.value.slice(0,450)); repaint(); },
    layout(el) { photoLayouts.set(context().photoKey, el.value); repaint(); },
    go(el) { document.querySelector(`[data-portfolio-page="${el.dataset.page}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}); },
    photo(el) {
      const incoming = [...(el.files ?? [])];
      if(!incoming.length) return;
      const key=context().photoKey;
      const existing = photosFor(key);
      const allowed = new Set(['image/png','image/jpeg','image/webp']);
      if (existing.length + incoming.length > 6 ||
          incoming.some(file=>!allowed.has(file.type) || file.size>6*1024*1024) ||
          [...incoming].reduce((n,file)=>n+file.size,existing.reduce((n,p)=>n+p.bytes,0))>24*1024*1024) {
        photoError = 'يسمح النموذج بست صور كحد أقصى لكل شاهد، حجم الواحدة 6 ميجابايت والمجموع 24 ميجابايت.';
        toast(photoError,'warn'); repaint(); return;
      }
      const additions = incoming.map(file=>({
        id:crypto.randomUUID(), url:URL.createObjectURL(file), name:String(file.name).slice(0,70), bytes:file.size,
      }));
      photoGroups.set(key,[...existing,...additions]);
      photoError = ''; repaint();
    },
    'remove-photo'(el) {
      const key=context().photoKey, group=photosFor(key), p=group.find(photo=>photo.id===el.dataset.id);
      if(!p) return;
      URL.revokeObjectURL(p.url);
      photoGroups.set(key,group.filter(photo=>photo.id!==p.id));
      repaint();
    },
    'move-photo'(el) {
      const key=context().photoKey,group=[...photosFor(key)];
      const index=group.findIndex(photo=>photo.id===el.dataset.id);
      const next=index+Number(el.dataset.dir);
      if(index<0 || next<0 || next>=group.length) return;
      [group[index],group[next]]=[group[next],group[index]];
      photoGroups.set(key,group);
      repaint();
    },
    'clear-photo'() {
      const key=context().photoKey;
      for(const photo of photosFor(key)) URL.revokeObjectURL(photo.url);
      photoGroups.delete(key); repaint();
    },
    async print(){
      const ctx=context();
      if(!ctx.canPrint) {
        toast('اختر شاهدًا جاهزًا أو أضف وصفًا وصورًا لشاهدك.', 'warn');
        return false;
      }
      try {
        await Promise.all([...document.querySelectorAll('.folio-evidence__photo')].map(img =>
          img.decode ? img.decode() : (img.complete && img.naturalWidth ? Promise.resolve() : Promise.reject())
        ));
      } catch {
        toast('تعذّر تحميل إحدى الصور. راجع الصور قبل الطباعة.', 'danger'); return false;
      }
      return printReport('ملف الإنجاز المهني');
    },
  },
};
