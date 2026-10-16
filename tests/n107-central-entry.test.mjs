// AI: source/route/offline inventory checks only; these are NOT rendered UI QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { match } from '../src/router.js';
test('both central routes load real view modules and are in the offline shell',async()=>{
  for(const path of ['/classes/import','/classes/koshoof']) {
    const result=match(path);assert.ok(result);const module=await result.route.load();assert.equal(typeof module.default.render,'function');assert.equal(module.default.back(),'#/classes');
  }
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  for(const path of ['src/lib/class-import-file.js','src/views/class-import-center.js'])assert.ok(sw.includes("'./"+path+"'"));
});
test('source inventory: state-A-only secondary entry, shared top toolbar, upper demo, retained delete handler',async()=>{
  const home=await readFile(new URL('../src/views/home.js',import.meta.url),'utf8'),classes=await readFile(new URL('../src/views/teachings.js',import.meta.url),'utf8');
  assert.match(home,/onboarding.state === 'A' \? html`<a class="btn class-import-secondary"/);
  assert.equal(classes.match(/\$\{classesToolbar\(\)\}/g).length,2);
  assert.ok(!classes.includes('demoFooter')); assert.equal(classes.match(/data-act="add-demo"/g).length,1);
  assert.ok(!classes.includes('class-card__koshoof'));
  assert.ok(classes.includes('aria-label="حذف الفصل"'));
  assert.ok(classes.includes('id="class-delete-next-btn"'));assert.ok(classes.includes('id="class-delete-confirm-btn"'));
});
