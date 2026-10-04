import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('N65: former-student history is a closed disclosure with count and original rows', async () => {
  const students = await source('src/views/students.js');
  const section = students.match(/<details class="section former-students-section"[\s\S]*?<\/details>/)?.[0];
  assert.ok(section, 'history uses a native disclosure');
  assert.match(section, /\$\{formerOpen \? 'open' : ''\}/);
  assert.match(students, /let formerOpen = false/);
  assert.match(students, /formerOpen = event\.currentTarget\.open/);
  assert.match(section, /<summary[^>]*>[\s\S]*?طلاب غادروا هذا الفصل[\s\S]*?\$\{former\.length\}[\s\S]*?<\/summary>/);
  for (const preserved of ['former.map(', 'e.rollNo', 'studentAvatar(s', 's.name', 'ENROLLMENT_STATUS[e.status]', 'fmtDateFull(e.endDate)', 'e.transferNote', 'سجلّهم محفوظ كاملًا']) {
    assert.ok(section.includes(preserved), `historical content retained: ${preserved}`);
  }
});

test('N66: only the redundant contextual Classes link is removed', async () => {
  const app = await source('src/app.js');
  assert.doesNotMatch(app, /<a class="sidebar__item" href="#\/classes">\$\{icon\('back'\)\}<span>كل الفصول<\/span><\/a>/);
  assert.match(app, /\{ href: '#\/classes',\s+icon: 'classes',\s+label: 'الفصول',\s+primary: true \}/);
  assert.match(app, /class-context-nav-bar/);
  for (const route of ['students', 'attendance', 'grades']) assert.ok(app.includes(`#/teaching/\${id}/${route}`));
});

test('N67 and D-086: one sidebar Mini Hub follows desktop and compact breakpoints', async () => {
  const [app, css, components] = await Promise.all([source('src/app.js'), source('src/styles/app.css'), source('src/styles/components.css')]);
  const shell = app.match(/function shell\(path, params\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(shell);
  assert.equal((shell.match(/id="sidebar-mini-hub"/g) ?? []).length, 1);
  assert.doesNotMatch(shell, /!inTeaching\s*\?[^\n]*sidebar-mini-hub/);
  assert.match(css, /\.sidebar\s*\{\s*display:\s*none;/);
  const desktopRule = css.match(/@media \(min-width:\s*(\d+)px\)\s*\{\s*\.layout[^}]*\}[\s\S]*?\.sidebar\s*\{\s*display:\s*flex;\s*\}[\s\S]*?\.tabbar\s*\{\s*display:\s*none;/);
  assert.ok(desktopRule, 'desktop sidebar replaces the compact tabbar');
  const breakpoint = Number(desktopRule[1]);
  assert.ok(1440 >= breakpoint && 390 < breakpoint && 320 < breakpoint);
  assert.match(components, /\.former-students-section__summary\s*\{[^}]*display:\s*flex;[^}]*min-block-size:\s*44px;/);
  assert.match(components, /\.former-students-section__summary > :first-child\s*\{\s*min-inline-size:\s*0;/);
});
