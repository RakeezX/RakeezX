import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { withIsolatedLocalBrowser } from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const root = process.cwd();
const port = 4179;
const url = `http://127.0.0.1:${port}`;
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n90-class-terminology-20261014.json';
const runId = 'a9c6dd3c-a72d-4212-9079-1811d86ba6d5';
const sourceFiles = [
  'src/views/home.js', 'src/views/student.js', 'src/views/students.js',
  'src/lib/student-lifecycle-ui.js', 'src/lib/migrate.js',
];
const { readFile } = await import('node:fs/promises');
const userCopy = sourceFiles.map((file) => readFile(`${root}/${file}`, 'utf8'));
const sources = await Promise.all(userCopy);
assert.match(sources[0], /أنشئ فصلًا وأسند إليه مادتك/);
assert.match(sources[1], /فصل محذوف/);
assert.match(sources[2], /لا يوجد فصل آخر في هذه السنة/);
assert.match(sources[2], /لا طلاب في \$\{sectionLabel\(section\) \|\| 'الفصل'\}/);
assert.match(sources[2], /تحقق من كشف الفصل/);
assert.match(sources[2], /الفصل الجديد/);
assert.match(sources[4], /رمز فصل/);

const require = createRequire(`${root}/package.json`);
const vite = `${root}/node_modules/vite/bin/vite.js`;
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, stdio: 'ignore',
});
try {
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    try { ready = (await fetch(url)).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.equal(ready, true, 'task-owned Vite server should start');
  await withIsolatedLocalBrowser({ taskFile, runId, url }, async ({ createContext }) => {
    const context = await createContext({ locale: 'ar' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const text = document.querySelector('#app')?.textContent?.trim() ?? '';
      return text.length > 0 && !text.includes('جارٍ تجهيز مساحة عملك');
    }, null, { timeout: 15000 });
    const rendered = await page.evaluate(async () => {
      const [{ default: view }, { render }] = await Promise.all([
        import('/src/views/home.js'), import('/src/lib/dom.js'),
      ]);
      const root = document.createElement('section');
      document.body.append(root);
      render(root, view.render());
      return root.innerText;
    });
    assert.ok(rendered.includes('أنشئ فصلك الأول') && rendered.includes('إنشاء أول فصل'), 'actual home view should render its empty-class guidance');
    const css = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.href));
    assert.ok(css.some((href) => href.endsWith('/src/styles/app.css')));
  });
} finally {
  if (server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(3000)]);
  }
}

console.log('PASS n90_visible_class_terms; PASS n90_empty_class_and_student_message_render (actual home module DOM/CSS and focused student-template assertions)');
