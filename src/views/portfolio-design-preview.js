import { html, raw, icon, fmtDate, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';
import { repaint } from '../repaint.js';
import { MINISTRY_LOGO_URL } from '../lib/ministry-brand.js';
import { printReport } from '../lib/report-print.js';
import { PORTFOLIO_CRITERIA, portfolioYearEvidence, portfolioDesignSummary } from '../lib/portfolio-design-preview.js';
import { buildPortfolioEvidenceSuggestions, guideForCriterion } from '../lib/portfolio-smart-evidence.js';
import { F09_EVIDENCE_TEMPLATES, templatesForCriterion } from '../lib/portfolio-evidence-templates.js';
import { buildAnnualPortfolioPlan } from '../lib/portfolio-annual-plan.js';

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
let viewingFullPortfolio = false;
const includedWitnesses = new Set();
const excludedWitnesses = new Set();
let navigatorOpen = false;
let criterionEditorOpen = false;
let libraryFilter = 'all';
let libraryQuery = '';
let nextExtraCriterionNumber = 12;
const criterionNames = new Map();
const hiddenCriteria = new Set();
const extraCriteria = [];
const customWitnesses = [];
const hiddenWitnesses = new Set();
const sectionPreferences = new Map();
const photoLayouts = new Map();
const photoGroups = new Map();
const selectedByCriterion = new Map();
const descriptions = new Map();
const titles = new Map();
const layoutFor = key => photoLayouts.get(key) ?? 'two';
const photosFor = key => photoGroups.get(key) ?? [];
const showSection = (key,section) => sectionPreferences.get(key)?.[section] !== false;
const allCriteria = () => [
  ...PORTFOLIO_CRITERIA.map(c=>({...c,title:criterionNames.get(c.number)||c.title,originalTitle:c.title,custom:false})),
  ...extraCriteria.map(c=>({...c,title:criterionNames.get(c.number)||c.title,originalTitle:c.title,custom:true})),
];
function forgetWitness(id){
  for(const photo of photosFor(id)) URL.revokeObjectURL(photo.url);
  photoGroups.delete(id);photoLayouts.delete(id);descriptions.delete(id);
  titles.delete(id);sectionPreferences.delete(id);hiddenWitnesses.delete(id);
  includedWitnesses.delete(id);excludedWitnesses.delete(id);
}
// One-step, session-only undo. Delay revoking removed photo URLs until undo expires.
let pendingUndo = null;
function clearUndo() {
  if(!pendingUndo) return;
  const old=pendingUndo;pendingUndo=null;old.discard?.();
}
function offerUndo(message,restore,discard) {
  clearUndo();pendingUndo={message,restore,discard};
}
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
  const criteria=allCriteria();
  const criterion=criteria.find(c=>c.number===editingCriterion)||criteria[0];
  if(editingCriterion!==criterion.number)editingCriterion=criterion.number;
  const recorded = sources.filter(candidate=>candidate.criterion===editingCriterion);
  const templates = templatesForCriterion(editingCriterion);
  const personal = customWitnesses.filter(w=>w.criterion===editingCriterion);
  const candidates = [...recorded,...personal,...templates];
  const available = candidates.filter(w=>!hiddenWitnesses.has(w.id));
  const lastChoice=selectedByCriterion.get(editingCriterion);
  const chosenId=selectedSuggestionId ?? lastChoice ?? available[0]?.id ?? null;
  const proposal=available.find(w=>w.id===chosenId)||available[0]||null;
  selectedSuggestionId=proposal?.id ?? null;
  if(proposal)selectedByCriterion.set(editingCriterion,proposal.id);
  const photoKey=proposal?.id ?? 'manual:'+editingCriterion;
  const guide=guideForCriterion(editingCriterion);
  const summaryBase = portfolioDesignSummary(evidence);
  const annual=buildAnnualPortfolioPlan({
    criteria,sources,templates:F09_EVIDENCE_TEMPLATES,custom:customWitnesses,
    hiddenCriteria,hiddenWitnesses,included:includedWitnesses,excluded:excludedWitnesses,
    titles,descriptions,photos:photoGroups,layouts:photoLayouts,
    sections:sectionPreferences,yearId:year?.id,
  });
  const summary={...summaryBase,criteriaCount:annual.criteriaCount,criteria:annual.toc};
  const canPrint=annual.witnessCount>0;
  const title=titles.get(photoKey)??proposal?.title??guide?.evidence??criterion.title;
  const visibleCandidates=available.filter(w=>{
    if(libraryFilter==='rakeez' && (w.sourceKind==='template'||w.sourceKind==='custom'))return false;
    if(libraryFilter==='templates' && w.sourceKind!=='template')return false;
    if(libraryFilter==='my' && w.sourceKind!=='custom')return false;
    const q=libraryQuery.trim().toLocaleLowerCase('ar');
    const title=titles.get(w.id)??w.title;
    const description=descriptions.get(w.id)??w.description??'';
    return !q || (title+' '+description).toLocaleLowerCase('ar').includes(q);
  });
  const criteriaNav=criteria.map(c=>({
    ...c,excluded:hiddenCriteria.has(c.number),
    candidateCount:sources.filter(w=>w.criterion===c.number).length+
      templatesForCriterion(c.number).filter(w=>!hiddenWitnesses.has(w.id)).length+
      customWitnesses.filter(w=>w.criterion===c.number).length,
  }));
  const includedSections={
    metrics:showSection(photoKey,'metrics'),
    table:showSection(photoKey,'table'),
    chart:showSection(photoKey,'chart'),
    illustration:showSection(photoKey,'illustration'),
    photos:showSection(photoKey,'photos'),
  };
  const profile = store.state.profile ?? {};
  const person = {
    teacher: short(profile.teacherName, 'اسم المعلم'),
    school: short(profile.schoolName, 'اسم المدرسة'),
    department: short(profile.educationDepartment, 'إدارة التعليم'),
  };
  return {year,terms,evidence,summary,annual,person,criterion,guide,proposal,candidates,sources,photoKey,
    visibleCandidates,criteriaNav,libraryFilter,libraryQuery,hiddenCount:candidates.filter(w=>hiddenWitnesses.has(w.id)).length,
    criterionExcluded:hiddenCriteria.has(editingCriterion),criterionEditorOpen,
    includedSections,photos:photosFor(photoKey),photoLayout:layoutFor(photoKey),
    description:descriptions.get(photoKey)??proposal?.description??'',title,canPrint,
    viewingFullPortfolio,currentlyIncluded:annual.entries.some(x=>x.proposal.id===proposal?.id)};
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

function contents(ctx,list=ctx.summary.criteria,page=2) {
  const {summary} = ctx;
  return html`<section class="folio-sheet folio-interior folio-contents" data-portfolio-page="${page}" aria-label="فهرس ملف الإنجاز">
    ${pageLabel('الفهرس', String(page).padStart(2,'0'))}
    <div class="folio-interior__headline">
      <span class="folio-interior__eyebrow">دليل التنقل</span>
      <h2>المحتويات</h2>
      <p>المعايير والأقسام المهنية التي يضمّها المعلم في ملفه السنوي.</p>
    </div>
    <div class="folio-contents__guide"><span>الباب</span><span>المعيار</span><span>الصفحة</span></div>
    <div class="folio-contents__rows">
      ${list.map(c=>html`<div class="folio-contents__row">
        <span class="folio-contents__number">${c.number}</span>
        <span class="folio-contents__title">${c.title}</span>
        <span class="folio-contents__page">${c.page === '—' ? '' : c.page}</span>
      </div>`)}
    </div>
    <div class="folio-contents__note"><span class="folio-dot"></span>
      أعمال تعليمية ومهنية تجمع التخطيط والتدريس والتقويم والتواصل، في ملف واحد منظم.
    </div>
    ${foot(page)}
  </section>`;
}

function coverage(ctx,list=ctx.summary.criteria,page=3) {
  const {summary, evidence} = ctx;
  return html`<section class="folio-sheet folio-interior folio-coverage" data-portfolio-page="${page}" aria-label="لوحة توثيق الشواهد">
    ${pageLabel('موجز الإنجازات', String(page).padStart(2,'0'))}
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
      ${list.map(c=>html`<div class="folio-coverage__row">
        <span class="folio-coverage__num">${c.number}</span>
        <span class="folio-coverage__title">${c.title}</span>

      </div>`)}
    </div>

    ${foot(page)}
  </section>`;
}

function witnessSectionsControls(ctx, hasData, chartRows) {
  const options=[
    ...((hasData || ctx.proposal?.metrics?.length) ? [['metrics','مؤشرات العمل']] : []),
    ...((hasData || ctx.proposal?.table?.length) ? [['table','الجدول']] : []),
    ...(hasData && chartRows.length ? [['chart','توزيع المتابعة على الفصول']] : []),
    ...(ctx.proposal?.visualSteps?.length ? [['illustration','المخطط التوضيحي']] : []),
    ['photos','الصور المرفقة'],
  ];
  return html`<div class="folio-evidence__sections noprint">
    <strong>محتوى الشاهد</strong>
    <div class="folio-evidence__section-options" role="group" aria-label="إظهار وإخفاء عناصر الشاهد">
      ${options.map(([id,name])=>html`<label>
        <input type="checkbox" data-change="toggle-section" data-section="${id}"
          ${ctx.includedSections[id]?'checked':''} />
        <span>${name}</span>
      </label>`)}
    </div>
  </div>`;
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

function evidencePage(ctx,page=4,editor=true) {
  const {evidence,year,criterion,photos,photoLayout,proposal} = ctx;
  const isAttendance = proposal?.id === 'rakeez:attendance:'+year?.id;
  const rows = evidence.rows.slice(0,4);
  const hasData = isAttendance && evidence.recordedSessions > 0;
  const cols = photoLayout === 'one' ? 1 : photoLayout === 'three' ? 3 : 2;
  const reserveFirstPageForChart = hasData && ctx.includedSections.chart;
  const firstPhotos = ctx.includedSections.photos && !reserveFirstPageForChart
    ? photos.slice(0, {one:2,two:4,three:6}[photoLayout] ?? 4) : [];
  const rowsOfPhotos = Math.ceil(firstPhotos.length / cols) || 1;
  const photoHeight = Math.min(164, Math.max(72, Math.floor(290 / rowsOfPhotos)));
  const sectionCounts = new Map();
  if (hasData) for (const row of evidence.rows) {
    const key = row.section || 'فصل';
    sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1);
  }
  const chartRows = [...sectionCounts].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const chartMax = Math.max(1,...chartRows.map(row=>row[1]));
  return html`<section class="folio-sheet folio-interior ${editor?'folio-evidence':'folio-export-witness'}" ${raw(editor?'data-focus-page="4"':'data-portfolio-page="'+page+'"')} aria-label="شاهد مهني">
    ${pageLabel('شاهد مهني', String(page).padStart(2,'0'))}
    <div class="folio-interior__headline folio-interior__headline--compact">
      <span class="folio-interior__eyebrow">${criterion.number} · ${criterion.title}</span>
      ${editor?html`<div class="folio-evidence__inline-edit noprint">
        <input class="folio-evidence__title-edit" data-change="suggestion-title" value="${ctx.title}"
          maxlength="100" aria-label="عنوان الشاهد" />
        <textarea class="folio-evidence__description-edit" data-change="suggestion-description"
          aria-label="وصف الشاهد" maxlength="450" rows="2" placeholder="اكتب وصفًا موجزًا للشاهد">${ctx.description}</textarea>
      </div>`:''}
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
      ${ctx.includedSections.metrics?html`<div class="folio-evidence__metrics">
        <div><span>حصص جرى رصدها</span><strong>${digits.format(evidence.recordedSessions)}</strong></div>
        <div><span>حصص اكتمل رصدها</span><strong>${digits.format(evidence.fullSessions)}</strong></div>
        <div><span>فصول شملتها المتابعة</span><strong>${digits.format(new Set(evidence.rows.map(row=>row.section)).size)}</strong></div>
      </div>`:''}
      ${ctx.includedSections.table?html`<div class="folio-evidence__section-head"><h3>نماذج من أعمال المتابعة</h3><span>${short(year?.label)}</span></div>
      <table class="folio-evidence__table">
        <thead><tr><th>التاريخ</th><th>الفصل</th><th>المادة</th><th>الحصة</th></tr></thead>
        <tbody>${rows.map(row=>html`<tr><td>${date(row.date)}</td><td>${row.section}</td>
          <td>${row.subject}</td><td>${digits.format(row.period)}</td></tr>`)}</tbody>
      </table>`:''}
      ${ctx.includedSections.chart && chartRows.length ? html`<div class="folio-evidence__chart">
        <div class="folio-evidence__section-head"><h3>توزيع أعمال المتابعة على الفصول</h3><span>${digits.format(evidence.recordedSessions)} حصة موثقة بالرصد</span></div>
        ${chartRows.map(([label,count])=>html`<div class="folio-evidence__chart-row">
          <span>${label}</span><div class="folio-evidence__chart-track"><i style="width:${Math.round(count/chartMax*100)}%"></i></div>
          <b>${digits.format(count)}</b>
        </div>`)}
      </div>` : ''}
      `:''}
    ${proposal && !isAttendance?html`
      ${ctx.includedSections.metrics && proposal.metrics.length?html`<div class="folio-evidence__metrics">
        ${proposal.metrics.slice(0,3).map(([label,value])=>html`<div><span>${label}</span><strong>${typeof value==='number'?digits.format(value):value}</strong></div>`)}
      </div>`:''}
      ${ctx.includedSections.table && proposal.table?.length?html`<div class="folio-evidence__section-head"><h3>نماذج من الأعمال المسجلة</h3></div>
        <table class="folio-evidence__table"><thead><tr>${proposal.tableHeaders.map(h=>html`<th>${h}</th>`)}</tr></thead>
          <tbody>${proposal.table.map(row=>html`<tr>${row.map(cell=>html`<td>${cell}</td>`)}</tr>`)}</tbody></table>`:''}
    `:''}
    ${ctx.includedSections.illustration && proposal?.sourceKind==='template' && !photos.length && proposal.visualSteps?.length ? html`
      <div class="folio-evidence__illustration" role="group" aria-label="مخطط توضيحي للنشاط">
        <div class="folio-evidence__image-caption"><h3>خطوات النشاط</h3><span>مخطط توضيحي</span></div>
        <div class="folio-evidence__steps">
          ${proposal.visualSteps.map((step,i)=>html`<div class="folio-evidence__step">
            <span class="folio-evidence__step-number">${digits.format(i+1)}</span>
            <strong>${step}</strong>
          </div>`)}
        </div>
      </div>` : ''}
    <div class="folio-evidence__image-block ${firstPhotos.length && ctx.includedSections.photos ? '' : 'noprint'}">
      <div class="folio-evidence__image-caption"><h3>صور الشاهد</h3><span>${photos.length ? `${digits.format(photos.length)} صور` : ''}</span></div>

      ${ctx.includedSections.photos && firstPhotos.length ? html`<div class="folio-evidence__gallery folio-evidence__gallery--${photoLayout}" style="--folio-photo-height:${photoHeight}px">
        ${firstPhotos.map((photo, i)=>html`<figure class="folio-evidence__gallery-item">
          <img class="folio-evidence__photo" src="${photo.url}" alt="صورة داعمة رقم ${digits.format(i+1)}" loading="eager" decoding="async" />
          ${editor?html`<figcaption class="folio-evidence__image-tools noprint"><span>${photo.name}</span>
            <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="-1" aria-label="تقديم الصورة" ${i===0?'disabled':''}>↑</button>
            <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="1" aria-label="تأخير الصورة" ${i===photos.length-1?'disabled':''}>↓</button>
            <button type="button" data-act="remove-photo" data-id="${photo.id}" aria-label="حذف الصورة">×</button>
          </figcaption>`:''}
        </figure>`) }
      </div>` : ''}
    </div>
    ${foot(page)}
  </section>`;
}

function photoContinuation(ctx,startPage=5,editor=true) {
  const {photos,photoLayout,criterion} = ctx;
  const chartOnFirstPage=ctx.proposal?.id==='rakeez:attendance:'+ctx.year?.id &&
    ctx.evidence.recordedSessions>0 && ctx.includedSections.chart;
  const first = chartOnFirstPage ? 0 : ({one:2,two:4,three:6}[photoLayout] ?? 4);
  const capacity = {one:4,two:8,three:9}[photoLayout] ?? 8;
  const cols = photoLayout === 'one' ? 1 : photoLayout === 'three' ? 3 : 2;
  const pages=[];
  if(!ctx.includedSections.photos)return pages;
  for(let offset=first; offset<photos.length; offset+=capacity) {
    const batch=photos.slice(offset,offset+capacity);
    const num=startPage+pages.length;
    const imageHeight=Math.min(190,Math.max(110,Math.floor(610/Math.ceil(batch.length/cols))));
    pages.push(html`<section class="folio-sheet folio-interior ${editor?'folio-evidence':'folio-export-witness'} folio-evidence--continuation" ${raw(editor?'data-focus-continuation="'+num+'"':'data-portfolio-page="'+num+'"')} aria-label="صور مرفقة بالشاهد">
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
            ${editor?html`<figcaption class="folio-evidence__image-tools noprint"><span>${photo.name}</span>
              <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="-1" aria-label="تقديم الصورة" ${offset+i===0?'disabled':''}>↑</button>
              <button type="button" data-act="move-photo" data-id="${photo.id}" data-dir="1" aria-label="تأخير الصورة" ${offset+i===photos.length-1?'disabled':''}>↓</button>
              <button type="button" data-act="remove-photo" data-id="${photo.id}" aria-label="حذف الصورة">×</button>
            </figcaption>`:''}
          </figure>`)}
        </div>
      </div>
      ${foot(num)}
    </section>`);
  }
  return pages;
}

function criteriaNavigator(ctx) {
  return html`<aside class="folio-criteria noprint" aria-label="مجالات ملف الإنجاز">
    <div class="folio-criteria__head">
      <div><span>ملف الإنجاز</span><h2>المعايير المهنية</h2></div>
      <button type="button" class="folio-criteria__all ${viewingFullPortfolio?'is-active':''}"
        data-act="show-full-portfolio" aria-pressed="${viewingFullPortfolio}">▤ عرض الملف كاملًا</button>
      <button type="button" class="folio-criteria__toggle" data-act="toggle-criteria"
        aria-expanded="${navigatorOpen}" aria-controls="folio-criteria-list">
        ${ctx.criterion.number} · ${ctx.criterion.title} <span aria-hidden="true">⌄</span>
      </button>
    </div>
    <div id="folio-criteria-list" class="folio-criteria__list ${navigatorOpen?'is-expanded':''}">
      <p class="folio-criteria__legend">✓ علامة الصح تعني أن المعيار ضمن الملف، وإزالتها تخفيه.</p>
      ${ctx.criteriaNav.map(c=>html`<div class="folio-criteria__row">
        <button type="button" class="folio-criteria__item
          ${c.number===editingCriterion&&!viewingFullPortfolio?'is-selected':''} ${c.excluded?'is-excluded':''}"
          data-act="select-criterion" data-id="${c.number}"
          aria-current="${c.number===editingCriterion&&!viewingFullPortfolio?'true':'false'}">
          <span class="folio-criteria__number">${c.number}</span>
          <span class="folio-criteria__title">${c.title}</span>
          <span class="folio-criteria__count" aria-label="${c.candidateCount} خيارات">${digits.format(c.candidateCount)}</span>
        </button>
        <div class="folio-criteria__row-tools">
          <button type="button" class="folio-criteria__edit-trigger"
            data-act="edit-criterion-row" data-id="${c.number}"
            aria-label="تعديل اسم ${c.title}" title="تعديل اسم المعيار في ملفك">
            <span aria-hidden="true">✎</span> تعديل
          </button>
          <label class="folio-criteria__inclusion"
            title="${c.excluded?'ضع علامة الصح لإظهار المعيار في الملف':'أزل علامة الصح لإخفاء المعيار من الملف'}">
            <input type="checkbox" data-change="criterion-inclusion" data-id="${c.number}"
              aria-label="إدراج ${c.title} في الملف" ${c.excluded?'':'checked'} />
          </label>
        </div>
        ${criterionEditorOpen&&c.number===editingCriterion?html`<div class="folio-criteria__inline-editor">
          <label class="folio-criteria__edit-label">تعديل اسم المعيار في ملفي
            <input class="input" data-change="criterion-name"
              value="${c.title}" maxlength="70" aria-label="اسم القسم في ملفي" />
          </label>
          <p>يتغير الاسم في ملفك فقط، مع بقاء اسم المعيار الأصلي محفوظًا.</p>
          <div class="folio-criteria__edit-actions">
            <button class="btn btn--ghost" type="button" data-act="close-criterion-editor">تم</button>
            ${!c.custom&&criterionNames.has(c.number)?html`<button class="btn btn--ghost" type="button"
              data-act="reset-criterion-name">الاسم الأصلي</button>`:''}
            ${c.custom?html`<button class="btn btn--ghost folio-criteria__delete-custom" type="button"
              data-act="delete-custom-criterion">حذف القسم الخاص</button>`:''}
          </div>
        </div>`:''}
      </div>`)}
      <button type="button" class="folio-criteria__add" data-act="add-criterion">+ إضافة قسم خاص</button>
    </div>
  </aside>`;
}

function suggestionsPanel(ctx) {
  const {guide,proposal,visibleCandidates} = ctx;
  return html`<section class="folio-suggestion-studio noprint" aria-label="مكتبة الشواهد">
    <header class="folio-suggestion-studio__head">
      <div><span>الشواهد</span><h2>اختر شاهدًا أو أنشئ شاهدًا جديدًا</h2></div>
      <button class="btn btn--primary" type="button" data-act="manual-suggestion">+ شاهد جديد</button>
    </header>
    <div class="folio-library__tools">
      <input class="input folio-library__search" data-input="library-search"
        value="${ctx.libraryQuery}" placeholder="ابحث عن شاهد…" aria-label="بحث في الشواهد" />
      <div class="folio-library__filters" role="group" aria-label="مصدر الشواهد">
        ${[['all','الكل'],['rakeez','من ركيز'],['templates','نماذج جاهزة'],['my','شواهدي']].map(([id,label])=>html`
          <button type="button" data-act="library-filter" data-id="${id}"
            class="folio-library__filter ${ctx.libraryFilter===id?'is-active':''}"
            aria-pressed="${ctx.libraryFilter===id}">${label}</button>`)}
      </div>
    </div>
    <div class="folio-suggestion-studio__candidates" data-library-results>
      ${visibleCandidates.map(item=>html`<button type="button"
        class="folio-suggestion-studio__choice ${proposal?.id===item.id?'is-selected':''}"
        data-library-card data-search="${((titles.get(item.id)??item.title)+' '+(descriptions.get(item.id)??item.description??'')).toLocaleLowerCase('ar')}"
        data-act="pick-suggestion" data-id="${item.id}" aria-pressed="${proposal?.id===item.id}">
          <strong>${titles.get(item.id)||item.title}</strong>
          <span>${item.description?.slice(0,84)||'شاهد قابل للتعديل وإضافة الصور'}</span>
          <small>${item.sourceKind==='template'?'قالب مقترح':
            item.sourceKind==='custom'?'شاهد خاص':'من سجلات ركيز'}</small>
      </button>`)}
      <p class="folio-library__empty" data-library-empty ${visibleCandidates.length?'hidden':''}>لا توجد شواهد مطابقة.</p>
    </div>
    ${ctx.hiddenCount?html`<button type="button" class="folio-library__restore"
      data-act="restore-witnesses">إظهار الشواهد المخفية (${digits.format(ctx.hiddenCount)})</button>`:''}
    ${proposal?html`<div class="folio-library__selected">
      <span>المحدد: <strong>${titles.get(proposal.id)||proposal.title}</strong></span>
      <div class="folio-library__selected-controls">
        ${proposal.sourceKind==='custom'?html`
          <button type="button" class="folio-library__selected-action" data-act="move-witness"
            data-dir="-1" aria-label="تقديم شاهدي"
            ${customWitnesses.filter(w=>w.criterion===editingCriterion).findIndex(w=>w.id===proposal.id)===0?'disabled':''}>↑</button>
          <button type="button" class="folio-library__selected-action" data-act="move-witness"
            data-dir="1" aria-label="تأخير شاهدي"
            ${customWitnesses.filter(w=>w.criterion===editingCriterion).findIndex(w=>w.id===proposal.id)===customWitnesses.filter(w=>w.criterion===editingCriterion).length-1?'disabled':''}>↓</button>`:''}
        <button type="button" class="folio-library__selected-action is-include" data-act="toggle-witness-in-file"
          aria-pressed="${ctx.currentlyIncluded}">${ctx.currentlyIncluded?'✓ ضمن الملف':'＋ أضف إلى الملف'}</button>
        <button type="button" class="folio-library__selected-action is-danger" data-act="hide-witness">
          ${proposal.sourceKind==='custom'?'حذف شاهدي':'إخفاء من مكتبتي'}</button>
      </div>
    </div>`:''}
    ${pendingUndo?html`<div class="folio-undo" role="status">
      <span>${pendingUndo.message}</span>
      <button type="button" data-act="undo-change">تراجع</button>
    </div>`:''}
    <details class="folio-suggestion-studio__details">
      <summary>تفاصيل المعيار ومصادر الشواهد</summary>
      <div class="folio-suggestion-studio__details-body">
        <p><strong>أمثلة:</strong> ${guide?.content||''}</p>
        <p><strong>مصادر مستقبلية:</strong> مدرستي (${guide?.madrasati||'غير متاح'})،
          نور (${guide?.noor||'غير متاح'}).</p>
      </div>
    </details>
  </section>`;
}


function pagesOf(array,size=11) {
  const out=[];for(let n=0;n<array.length;n+=size)out.push(array.slice(n,n+size));
  return out.length?out:[[]];
}
function entryContext(ctx,entry) {
  return {...ctx,criterion:entry.criterion,proposal:entry.proposal,
    photoKey:entry.proposal.id,photos:entry.photos,photoLayout:entry.layout,
    title:entry.title,description:entry.description,includedSections:entry.includedSections};
}
function exportPages(ctx) {
  const blocks=pagesOf(ctx.annual.toc),n=blocks.length;
  const pages=[cover(ctx)];
  for(let i=0;i<n;i++)pages.push(contents(ctx,blocks[i],2+i));
  for(let i=0;i<n;i++)pages.push(coverage(ctx,blocks[i],2+n+i));
  for(const entry of ctx.annual.entries) {
    const item=entryContext(ctx,entry);
    pages.push(evidencePage(item,entry.page,false),
      ...photoContinuation(item,entry.page+1,false));
  }
  return pages;
}
function editorOptions(ctx) {
  if(!ctx.proposal)return '';
  const hasData=ctx.proposal.id==='rakeez:attendance:'+ctx.year?.id &&
    ctx.evidence.recordedSessions>0;
  const counts=new Set(ctx.evidence.rows.map(r=>r.section));
  return html`<section class="folio-display-controls noprint" aria-label="إعدادات عرض الشاهد">
    <div class="folio-display-controls__head">
      <div><strong>تنسيق محتوى الشاهد</strong>
        <p>هذه أدوات تحرير فقط، ولا تظهر ضمن صفحات ملف الإنجاز أو PDF.</p></div>
    </div>
    ${witnessSectionsControls(ctx,hasData,hasData?[...counts]:[])}
    ${witnessImageTools(ctx)}
  </section>`;
}

async function printAnnualFile() {
  const ctx=context();
  if(!ctx.canPrint){toast('أضف شاهدًا مكتملًا إلى الملف قبل الطباعة.', 'warn');return false;}
  try{
    await Promise.all([...document.querySelectorAll('[data-folio-document] .folio-evidence__photo')].map(img=>
      img.decode?img.decode():(img.complete&&img.naturalWidth?Promise.resolve():Promise.reject())));
  }catch{toast('تعذّر تحميل بعض الصور. أعد المحاولة قبل التصدير.', 'danger');return false;}
  return printReport('ملف الإنجاز المهني الكامل');
}

export default {
  title: ()=>'ملف الإنجاز — نموذج التصميم',
  subtitle: ()=>store.activeYear()?.label ?? '',
  back: ()=>'#/reports',
  wide: true,
  beforeRender() { loadStyle(); editingCriterion='09'; selectedSuggestionId=null;viewingFullPortfolio=false;photoError=''; },
  onUnmount() {
    clearUndo();
    for(const group of photoGroups.values())for(const photo of group)URL.revokeObjectURL(photo.url);
    photoGroups.clear();photoLayouts.clear();selectedByCriterion.clear();
    includedWitnesses.clear();excludedWitnesses.clear();viewingFullPortfolio=false;
    descriptions.clear();titles.clear();criterionNames.clear();hiddenCriteria.clear();
    hiddenWitnesses.clear();sectionPreferences.clear();extraCriteria.length=0;
    customWitnesses.length=0;nextExtraCriterionNumber=12;
    editingCriterion='09';selectedSuggestionId=null;navigatorOpen=false;
    criterionEditorOpen=false;libraryFilter='all';libraryQuery='';photoError='';
  },
  render() {
    const ctx=context();
    const focusExtra=ctx.proposal?photoContinuation(ctx,5,true):[];
    const pages=exportPages(ctx);
    const full=viewingFullPortfolio;
    return html`<div class="folio-page" dir="rtl">
      <header class="folio-workspace noprint">
        <div><span class="folio-workspace__eyebrow">ملف الإنجاز · مراجعة التصميم</span>
          <h1>ملف الإنجاز المهني</h1>
          <p>تصفح معيارًا واحدًا للتحرير أو اعرض الملف السنوي كاملًا بالترتيب الذي اخترته.</p></div>
        <span class="folio-workspace__status">Preview · التغييرات مؤقتة ولم تُحفظ في حسابك</span>
      </header>
      <section class="folio-toolbar noprint" aria-label="إجراءات ملف الإنجاز">
        <div class="folio-toolbar__overview">
          <strong>${digits.format(ctx.annual.witnessCount)} شواهد في الملف</strong>
          <span>${digits.format(ctx.annual.totalPages)} صفحة · ${short(ctx.year?.label)}</span>
        </div>
        <div class="folio-toolbar__actions" role="group" aria-label="طرق إخراج ومشاركة الملف">
          <button class="btn btn--primary" data-act="print" ${ctx.canPrint?'':'disabled'}>طباعة الملف كاملًا</button>
          <button class="btn btn--ghost" data-act="save-pdf" ${ctx.canPrint?'':'disabled'}>حفظ PDF</button>
          <button class="btn btn--ghost" type="button" disabled title="يُفعّل بعد الحفظ والنشر الآمن">مشاركة الرابط</button>
          <button class="btn btn--ghost" type="button" disabled title="يتطلب رابط مشاركة منشورًا صالحًا">رمز QR</button>
        </div>
        <p class="folio-toolbar__helper">لحفظ PDF اختر «حفظ بتنسيق PDF» من نافذة الطباعة. الرابط والباركود سيتاحان بعد تفعيل الحفظ والمشاركة الآمنة.</p>
        ${photoError?html`<p class="folio-toolbar__helper" role="status">${photoError}</p>`:''}
      </section>
      <div class="folio-editor-shell">
        ${criteriaNavigator(ctx)}
        <div class="folio-editor-main ${full?'is-full':'is-focused'}">
          ${full?'':suggestionsPanel(ctx)}
          ${full?'':editorOptions(ctx)}
          <div class="folio-focus noprint" data-folio-focus>
            ${ctx.proposal?html`<div class="folio-focus__heading">
              <strong>معاينة الشاهد · ${ctx.criterion.title}</strong>
              <button type="button" data-act="show-full-portfolio">عرض الملف كاملًا</button>
            </div>
            <div class="folio-focus__pages">
              ${evidencePage(ctx,4,true)}${focusExtra}
            </div>`:html`<div class="folio-library__empty">اختر شاهدًا من المكتبة أو أضف شاهدًا خاصًا.</div>`}
          </div>
          ${full?html`<nav class="folio-nav noprint" aria-label="التنقل بين صفحات الملف">
            ${[['1','الغلاف'],['2','الفهرس'],[String(ctx.annual.frontPageCount),'موجز الأعمال'],
              ...ctx.annual.entries.map(x=>[String(x.page),x.title])].map(([n,label])=>html`
              <button class="folio-nav__item" data-act="go" data-page="${n}">${label}</button>`)}
          </nav>`:''}
          <div class="print-report folio-document" data-folio-document>
            ${pages}
          </div>
        </div>
      </div>
    </div>`;
  },
  actions: {
    'toggle-criteria'() { navigatorOpen=!navigatorOpen;repaint(); },
    'edit-criterion-row'(el) {
      editingCriterion=el.dataset.id;selectedSuggestionId=selectedByCriterion.get(editingCriterion)||null;
      viewingFullPortfolio=false;criterionEditorOpen=true;repaint();
    },
    'criterion-inclusion'(el) {
      const id=el.dataset.id;
      if(el.checked)hiddenCriteria.delete(id);
      else hiddenCriteria.add(id);
      repaint();
    },
    'select-criterion'(el) {
      editingCriterion=el.dataset.id;viewingFullPortfolio=false;
      selectedSuggestionId=selectedByCriterion.get(editingCriterion)||null;
      navigatorOpen=false;criterionEditorOpen=false;libraryQuery='';libraryFilter='all';
      photoError='';repaint();
    },
    'add-criterion'() {
      const number=String(nextExtraCriterionNumber++);
      extraCriteria.push({number,title:'قسم إضافي',weight:0});
      editingCriterion=number; selectedSuggestionId=null;criterionEditorOpen=true;viewingFullPortfolio=false;
      navigatorOpen=true; libraryQuery='';libraryFilter='all';repaint();
    },
    'edit-criterion'(){criterionEditorOpen=true;repaint();},
    'close-criterion-editor'(){criterionEditorOpen=false;repaint();},
    'criterion-name'(el) {
      const value=el.value.trim().slice(0,70);
      if(value) criterionNames.set(editingCriterion,value);
      else criterionNames.delete(editingCriterion);
      repaint();
    },
    'reset-criterion-name'(){criterionNames.delete(editingCriterion);repaint();},
    'toggle-criterion-in-file'(){
      if(hiddenCriteria.has(editingCriterion))hiddenCriteria.delete(editingCriterion);
      else hiddenCriteria.add(editingCriterion);
      repaint();
    },
    'delete-custom-criterion'() {
      const number=editingCriterion, index=extraCriteria.findIndex(c=>c.number===number);
      if(index<0)return;
      const section=extraCriteria[index], name=criterionNames.get(number);
      const excluded=hiddenCriteria.has(number), selected=selectedByCriterion.get(number);
      const removed=customWitnesses.map((w,i)=>({w,i})).filter(x=>x.w.criterion===number);
      offerUndo('حُذف القسم الخاص وشواهده من المعاينة.',()=>{
        extraCriteria.splice(index,0,section);
        for(const {w,i} of removed)customWitnesses.splice(Math.min(i,customWitnesses.length),0,w);
        if(name!==undefined)criterionNames.set(number,name);
        if(excluded)hiddenCriteria.add(number);
        if(selected)selectedByCriterion.set(number,selected);
        editingCriterion=number;selectedSuggestionId=selected||null;
        criterionEditorOpen=false;
      },()=>{for(const {w} of removed)forgetWitness(w.id)});
      extraCriteria.splice(index,1);
      for(const {w} of removed){
        const at=customWitnesses.findIndex(x=>x.id===w.id);
        if(at>=0)customWitnesses.splice(at,1);
      }
      criterionNames.delete(number);hiddenCriteria.delete(number);
      selectedByCriterion.delete(number);
      editingCriterion='09';selectedSuggestionId=selectedByCriterion.get('09')||null;
      criterionEditorOpen=false;repaint();
    },
    'library-filter'(el){libraryFilter=el.dataset.id;repaint();},
    'library-search'(el) {
      libraryQuery=el.value;
      const q=libraryQuery.trim().toLocaleLowerCase('ar');
      const cards=el.closest('.folio-suggestion-studio')?.querySelectorAll('[data-library-card]')||[];
      for(const card of cards)card.hidden=!!q && !(card.dataset.search||'').includes(q);
      const empty=el.closest('.folio-suggestion-studio')?.querySelector('[data-library-empty]');
      if(empty)empty.hidden=[...cards].some(card=>!card.hidden);
    },
    'pick-suggestion'(el) { selectedSuggestionId=el.dataset.id;selectedByCriterion.set(editingCriterion,selectedSuggestionId);viewingFullPortfolio=false;repaint(); },
    'show-full-portfolio'(){viewingFullPortfolio=true;repaint();},
    'show-current-criterion'(){viewingFullPortfolio=false;repaint();},
    'toggle-witness-in-file'(){
      const candidate=context().proposal;if(!candidate)return;
      const id=candidate.id,active=context().currentlyIncluded;
      if(active){includedWitnesses.delete(id);excludedWitnesses.add(id)}
      else {includedWitnesses.add(id);excludedWitnesses.delete(id)}
      repaint();
    },
    'move-witness'(el) {
      const proposal=context().proposal;if(proposal?.sourceKind!=='custom')return;
      const personal=customWitnesses.filter(w=>w.criterion===editingCriterion);
      const index=personal.findIndex(w=>w.id===proposal.id),next=index+Number(el.dataset.dir);
      if(index<0||next<0||next>=personal.length)return;
      const i=customWitnesses.findIndex(w=>w.id===personal[index].id);
      const j=customWitnesses.findIndex(w=>w.id===personal[next].id);
      [customWitnesses[i],customWitnesses[j]]=[customWitnesses[j],customWitnesses[i]];
      repaint();
    },
    'undo-change'() {
      const old=pendingUndo;if(!old)return;
      pendingUndo=null;old.restore();photoError='';repaint();
    },
    'manual-suggestion'() {
      const id='custom:'+editingCriterion+':'+crypto.randomUUID();
      customWitnesses.push({id,criterion:editingCriterion,title:'شاهد جديد',
        description:'',sourceKind:'custom',metrics:[],table:[]});
      selectedSuggestionId=id;selectedByCriterion.set(editingCriterion,id);
      includedWitnesses.add(id);excludedWitnesses.delete(id);viewingFullPortfolio=false;
      titles.set(id,'شاهد جديد');libraryFilter='all';libraryQuery='';repaint();
    },
    'hide-witness'() {
      const proposal=context().proposal;if(!proposal)return;
      const criterion=editingCriterion;
      if(proposal.sourceKind==='custom'){
        const index=customWitnesses.findIndex(w=>w.id===proposal.id);
        if(index<0)return;
        offerUndo('حُذف الشاهد الخاص من المعاينة.',()=>{
          customWitnesses.splice(Math.min(index,customWitnesses.length),0,proposal);
          editingCriterion=criterion;selectedSuggestionId=proposal.id;
          selectedByCriterion.set(criterion,proposal.id);
        },()=>forgetWitness(proposal.id));
        customWitnesses.splice(index,1);
      }else {
        offerUndo('أُخفي الشاهد من مكتبتك.',()=>{
          hiddenWitnesses.delete(proposal.id);
          editingCriterion=criterion;selectedSuggestionId=proposal.id;
          selectedByCriterion.set(criterion,proposal.id);
        });
        hiddenWitnesses.add(proposal.id);
      }
      selectedByCriterion.delete(criterion);
      selectedSuggestionId=null;repaint();
    },
    'restore-witnesses'(){
      clearUndo();
      for(const proposal of context().candidates)hiddenWitnesses.delete(proposal.id);
      repaint();
    },
    'toggle-section'(el){
      const key=context().photoKey;
      const prev=sectionPreferences.get(key)||{};
      sectionPreferences.set(key,{...prev,[el.dataset.section]:el.checked});
      repaint();
    },
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
      clearUndo();
      const additions = incoming.map(file=>({
        id:crypto.randomUUID(), url:URL.createObjectURL(file), name:String(file.name).slice(0,70), bytes:file.size,
      }));
      photoGroups.set(key,[...existing,...additions]);
      photoError = ''; repaint();
    },
    'remove-photo'(el) {
      const key=context().photoKey, group=photosFor(key), index=group.findIndex(photo=>photo.id===el.dataset.id);
      if(index<0)return;
      const photo=group[index];
      offerUndo('حُذفت الصورة من الشاهد.',()=>{
        const current=photosFor(key);
        photoGroups.set(key,[...current.slice(0,index),photo,...current.slice(index)]);
      },()=>URL.revokeObjectURL(photo.url));
      photoGroups.set(key,group.filter(x=>x.id!==photo.id));
      repaint();
    },
    'move-photo'(el) {
      const key=context().photoKey,group=[...photosFor(key)];
      const index=group.findIndex(photo=>photo.id===el.dataset.id);
      const next=index+Number(el.dataset.dir);
      if(index<0 || next<0 || next>=group.length) return;
      clearUndo();
      [group[index],group[next]]=[group[next],group[index]];
      photoGroups.set(key,group);
      repaint();
    },
    'clear-photo'() {
      const key=context().photoKey, removed=photosFor(key);
      if(!removed.length)return;
      offerUndo('حُذفت صور الشاهد من المعاينة.',()=>{
        photoGroups.set(key,removed);
      },()=>{for(const photo of removed)URL.revokeObjectURL(photo.url)});
      photoGroups.delete(key);repaint();
    },
    print(){return printAnnualFile();},
    'save-pdf'(){return printAnnualFile();},
  },
};
