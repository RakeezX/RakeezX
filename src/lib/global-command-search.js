/** AI N139: read-only, current-workspace navigation. No index or persisted state. */
import { html, icon, openSheet } from './dom.js';
import * as store from '../store.js';
import * as cloud from './cloud.js';
import { getActiveDatabaseName } from './db.js';
import { runtimeSyncOwnershipGuard } from './sync-ownership.js';
import { normalizeSearchText } from '../models.js';
import { currentStudentSearchResults } from './student-search-ui.js';
import { teachingRouteId } from '../router.js';

// Explicit whitelist; teaching services always require a current teaching identity.
export const COMMAND_PAGES = [
  ['التنقل', 'الرئيسية', '/', 'البداية'],
  ['التنقل', 'الفصول', '/classes', 'الصفوف'],
  ['التنقل', 'الجدول', '/schedule', 'جدول الحصص'],
  ['التنقل', 'الأرشيف', '/archive', 'ارشيف'],
  ['التنقل', 'الإعدادات', '/settings', 'اعدادات'],
  ['الأدوات', 'التقويم', '/calendar', 'المواعيد'],
  ['الأدوات', 'المنهج', '/curriculum', 'التحضير'],
  ['الأدوات', 'أوقات الحصص', '/schedule/times', 'التوقيت'],
  ['التقارير', 'التقارير', '/reports', 'تقرير'],
  ['التقارير', 'كشف الدرجات', '/reports/grades', 'تقرير درجات'],
  ['التقارير', 'متابعة الطلاب', '/reports/followup', 'تقرير المتابعة'],
  ['التقارير', 'الشهادات', '/reports/certificates', 'شهادة'],
];
export const COMMAND_SERVICES = [
  ['الخدمات', 'الحضور والغياب', 'attendance', 'حضور غياب تحضير'],
  ['الخدمات', 'الرصد السريع', 'quicklog', 'رصد سريع سلوك مشاركة'],
  ['الخدمات', 'الدرجات', 'grades', 'درجات كشف تقييم'],
  ['الخدمات', 'توزيع البنود', 'items', 'بنود توزيع الدرجات'],
  ['الأدوات', 'الاختيار العشوائي', 'picker', 'قرعة عشوائي'],
  ['الأدوات', 'المجموعات', 'groups', 'مجموعات'],
  ['التقارير', 'تقارير الفصل', 'reports', 'تقرير تقارير'],
];

export function commandSearchScope(source = store, identity = cloud, guard = runtimeSyncOwnershipGuard,
  database = getActiveDatabaseName(), storage = globalThis.localStorage) {
  const workspace = source.getActiveWorkspace();
  if (!source.state.ready || !workspace) return null;
  if (workspace.type === 'demo') return !identity.session && !identity.user ? `demo:${workspace.databaseName}` : null;
  if (workspace.type !== 'account' || workspace.ownershipState !== 'claimed' ||
      !identity.session || identity.session.user?.id !== workspace.authUserId ||
      identity.user?.id !== workspace.authUserId || identity.authStatus().state !== 'authenticated') return null;
  try {
    const auth = JSON.parse(storage.getItem(identity.AUTH_STORAGE_KEY) || 'null');
    const bound = guard.getWorkspace();
    if (!auth?.access_token || auth.user?.id !== workspace.authUserId || database !== workspace.databaseName ||
        bound.id !== workspace.id || bound.databaseName !== workspace.databaseName ||
        !guard.cloudAccess({ operation: 'read', authenticatedUserId: workspace.authUserId }).allowed) return null;
    return `${workspace.authUserId}:${workspace.databaseName}`;
  } catch { return null; }
}

// Catalog words use the shared normalization, with optional Arabic definite article.
const words = text => normalizeSearchText(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).map(word => word.replace(/^ال(?=.{2})/u, ''));
const hasWords = (tokens, text) => {
  const available = words(text);
  return tokens.every(token => available.some(word => /^\d+$/.test(token) ? word === token : word.startsWith(token)));
};

export function commandSearchResults(query, source = store, scope = commandSearchScope(source)) {
  if (!scope) return [];
  const tokens = words(query), workspace = source.getActiveWorkspace();
  const owned = row => row && !row.deleted && (workspace.type === 'demo' || row.ownerId == null || row.ownerId === workspace.authUserId);
  const year = source.activeYear(), term = source.activeTerm();
  const academicReady = [year, term].every(owned) && term.yearId === year.id && year.status !== 'archived' && term.status !== 'closed';
  const current = (academicReady ? source.teachings() : []).filter(teaching => {
    const section = source.getSection(teaching.sectionId), subject = source.getSubject(teaching.subjectId);
    return [teaching, section, subject].every(owned) && section.status !== 'archived' &&
      teaching.termId === source.activeTerm()?.id && section.yearId === source.activeYear()?.id;
  });
  const results = COMMAND_PAGES.filter(([, label, , aliases]) => hasWords(tokens, `${label} ${aliases}`))
    .map(([group, label, path]) => ({ group, label, href: `#${path}` }));
  for (const teaching of current) {
    const label = `${source.sectionLabel(source.getSection(teaching.sectionId))} · ${source.getSubject(teaching.subjectId).name}`;
    const href = `#/teaching/${teachingRouteId(teaching.id)}`;
    if (tokens.length && hasWords(tokens, label)) results.push({ group: 'الفصول والمواد', label, href });
  }
  if (tokens.length) for (const [group, service, suffix, aliases] of COMMAND_SERVICES) {
    const serviceWords = words(`${service} ${aliases}`);
    if (!tokens.some(token => serviceWords.includes(token))) continue;
    const contextTokens = tokens.filter(token => !serviceWords.includes(token));
    const candidates = current.filter(teaching => hasWords(contextTokens,
      `${source.sectionLabel(source.getSection(teaching.sectionId))} ${source.getSubject(teaching.subjectId).name}`));
    // A class/service query never guesses a subject or a section from a partial label.
    if (contextTokens.length && candidates.length !== 1) continue;
    for (const teaching of candidates) results.push({ group, label: `${service} · ${source.sectionLabel(source.getSection(teaching.sectionId))} · ${source.getSubject(teaching.subjectId).name}`,
      href: `#/teaching/${teachingRouteId(teaching.id)}/${suffix}` });
  }
  if (tokens.length) {
    // Reuse N39's active-only matcher/identity aggregation, with the verified current slice.
    const safeSource = { ...source, teachings: () => current, students: id => source.students(id).filter(student => owned(student) &&
      (workspace.type === 'demo' || source.enrollmentsOf(student.id).some(enrollment =>
        enrollment.id === student.enrollmentId && enrollment.sectionId === source.getTeaching(id).sectionId &&
        enrollment.status === 'active' && owned(enrollment)))) };
    for (const { student, contexts } of currentStudentSearchResults(query, safeSource)) {
      results.push({ group: 'الطلاب النشطون', label: `${student.name} · ${contexts.map(context => `${context.classLabel} · ${context.subject}`).join('، ')}`,
        href: `#/student/${encodeURIComponent(student.id)}${contexts.length === 1 ? `?teaching=${encodeURIComponent(contexts[0].teaching.id)}` : ''}` });
    }
  }
  return results.slice(0, 60);
}

export const commandSearchAction = () => html`<button type="button" class="iconbtn command-search-action" data-command-search data-fk="command-search" aria-label="البحث الشامل" title="البحث الشامل (Ctrl+K / ⌘K)" aria-keyshortcuts="Control+k Meta+k">${icon('search')}</button>`;

let installed = false, close = null;
export function installCommandSearch() {
  if (installed) return;
  installed = true;
  const mounted = () => !!document.querySelector('#main .topbar') && !!commandSearchScope();
  const open = () => {
    if (!mounted() || document.querySelector('[aria-modal="true"], dialog[open], .sheet-backdrop') || close) return;
    const scope = commandSearchScope();
    const opener = document.activeElement;
    let navigating = false;
    openSheet({ title: 'البحث الشامل', desc: 'صفحات رَكيز وفصولك وطلابك النشطون. حدّد الفصل والمادة للوصول إلى خدمة بعينها.',
      body: html`<div class="command-search"><label class="field"><span class="field__label">ابحث عن صفحة أو فصل أو طالب</span><input class="input" type="search" data-command-query data-autofocus autocomplete="off" aria-controls="command-results" placeholder="مثال: حضور خامس 2 العلوم"></label><p class="muted" role="status" aria-live="polite" data-command-status></p><div id="command-results"></div></div>`,
      onMount: (root, done) => {
        close = done;
        const input = root.querySelector('[data-command-query]'), list = root.querySelector('#command-results');
        const update = () => {
          if (!mounted() || scope !== commandSearchScope()) { list.replaceChildren(); done(); return; }
          const results = commandSearchResults(input.value);
          root.querySelector('[data-command-status]').textContent = results.length ? `${results.length} نتيجة · استخدم Tab ثم Enter للفتح` : 'لا توجد نتيجة محددة. جرّب اسم الصفحة، أو حدّد رقم الشعبة والمادة مع الخدمة.';
          const groups = [...new Set(results.map(result => result.group))];
          list.innerHTML = html`${groups.map(group => html`<section class="command-search-group" aria-label="${group}"><h2>${group}</h2>${results.filter(result => result.group === group).map(result => html`<a class="command-search-result" href="${result.href}">${result.label}${icon('chev')}</a>`)}</section>`)}`.value;
        };
        input.addEventListener('input', update);
        input.addEventListener('keydown', event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('a')?.focus(); }
        });
        list.addEventListener('click', event => { if (event.target.closest('a')) { navigating = true; done(); } });
        update();
      },
    }).finally(() => {
      close = null;
      // A store repaint may replace the topbar while its sheet owns focus.
      if (!navigating && !opener?.isConnected && mounted() && scope === commandSearchScope())
        document.querySelector('[data-command-search]')?.focus({ preventScroll: true });
    });
  };
  document.addEventListener('click', event => { if (event.target.closest?.('[data-command-search]')) open(); });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.shiftKey ||
        !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || !mounted() ||
        document.querySelector('[aria-modal="true"], dialog[open], .sheet-backdrop') ||
        event.target.isContentEditable || event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]')) return;
    event.preventDefault(); open();
  });
  // Invalidate synchronously on account/workspace changes, including a background logout.
  store.onWorkspaceDeactivation(() => close?.());
  store.subscribe(() => close?.());
  cloud.subscribe(() => close?.());
  window.addEventListener('storage', event => { if (event.key === null || event.key === cloud.AUTH_STORAGE_KEY) close?.(); });
  window.addEventListener('hashchange', () => close?.());
}
