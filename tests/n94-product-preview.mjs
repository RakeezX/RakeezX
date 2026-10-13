// Actual served Product application, sheets, delegates and source CSS. No shell
// template, live Auth identity, service fixture, proxy, or success backend mock.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const base = process.env.N94_PREVIEW_URL;
assert.ok(base && new URL(base).protocol === 'https:', 'Use the named immutable HTTPS Product Preview');
const directory = 'test-results/n94/5d423f2e-0d7a-4af4-8f75-7a8bfe3f6edf';
await mkdir(directory, { recursive: true });
const evidence = { url: base, candidateSha: process.env.N94_CANDIDATE_SHA, checks: [], assets: [], screenshots: [] };
assert.match(evidence.candidateSha, /^[a-f0-9]{40}$/);
const browser = await chromium.launch({ headless: true });
let context, page;
try {
  // The existing readiness helper is reused. Its context helper installs
  // `preparing` on EVERY load (intentional fixture reset), so a persistence test
  // sets that request once instead of reseeding on reload.
  context = await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
  await context.route('https://*.supabase.co/**',route=>route.abort());
  page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-13T06:00:00Z'));
  await page.goto(new URL(base).origin);
  await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  await page.reload();
  await openReadyServedDemo(page, base);
  // Source binding is additional evidence; UI PASS below uses the real DOM.
  for (const path of ['src/views/items.js', 'src/views/grades.js', 'src/store.js', 'src/styles/components.css', 'src/lib/score-foundation.js']) {
    const response = await context.request.get(new URL(path, base).href);
    assert.equal(response.status(), 200);
    const served = await response.body(), local = execFileSync('git', ['show', `${evidence.candidateSha}:${path}`]);
    const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
    // Cloudflare serves the repository's source bytes, not a re-created fixture.
    assert.equal(digest(served), digest(local), `${path}: served candidate byte binding`);
    evidence.assets.push({ path, sha256: digest(served) });
  }
  const fixture = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const item = store.state.items.find((row) => row.scoreMode === 'subitems' && row.distributionMode === 'manual' && !row.deleted);
    const definitions = store.scoreSubitemsOf(item.id);
    const student = store.teachingContext(item.teachingId).roster.find((row) =>
      !store.state.scoreSubitemCompletions.some((completion) => completion.studentId === row.id && completion.subitemId === definitions[0].id && completion.checked));
    return { itemId: item.id, teachingId: item.teachingId, studentId: student.id,
      definitions: definitions.map((row) => ({ id: row.id, value: row.value, createdAt: row.createdAt })) };
  });
  assert.ok(fixture.definitions.length >= 2);
  await page.goto(new URL(`/#/teaching/${fixture.teachingId}/items`, base).href);
  await page.locator(`[data-act="configure"][data-id="${fixture.itemId}"]`).click();
  let dialog = page.getByRole('dialog'); await dialog.waitFor();
  const first = dialog.locator('[data-subitem-row]').nth(0);
  await first.locator('[data-subitem-start]').fill('2030-01-02');
  await first.locator('[data-subitem-due]').fill('2030-01-01');
  await dialog.locator('[data-save-subitems]').click();
  await page.locator('#toast').filter({ hasText: 'موعد التسليم لا يسبق البداية' }).waitFor();
  assert.equal(await dialog.count(), 1);
  await first.locator('[data-subitem-start]').fill('');
  await first.locator('[data-subitem-due]').fill('2026-10-12');
  const latePoints = Math.floor(fixture.definitions[0].value * 50) / 100;
  await first.locator('[data-subitem-late]').fill(String(latePoints));
  const second = dialog.locator('[data-subitem-row]').nth(1);
  await second.locator('[data-subitem-due]').fill('2026-10-12');
  await second.locator('[data-subitem-late]').fill(String(fixture.definitions[1].value));
  evidence.formLayouts=[];
  for(const width of [390,320]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const fields=await dialog.locator('.n94-definition-details input').evaluateAll(inputs=>inputs.map(input=>{
      const r=input.getBoundingClientRect();return {height:r.height,width:r.width,left:r.left,right:r.right};
    }));
    assert.ok(fields.every(r=>r.height>=44&&r.width>=44&&r.left>=0&&r.right<=width));
    const screenshot=`items-form-${theme}-${width}.png`;await page.screenshot({path:join(directory,screenshot),fullPage:true});
    evidence.formLayouts.push({width,theme,fields,screenshot});
  }
  evidence.editorInputs = await dialog.locator('[data-subitem-row]').evaluateAll(rows=>rows.map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.outerHTML,input.value]))));
  await dialog.locator('[data-save-subitems]').click();
  await page.getByRole('button', { name: 'تأكيد التغيير', exact: true }).click();
  await page.locator('#toast').filter({ hasText: 'حُفظ توزيع العناصر' }).waitFor();
  await page.waitForFunction(async (fixture) => {
    const store=await import('/src/store.js');
    return store.scoreSubitemsOf(fixture.itemId)[0].dueDate === '2026-10-12';
  }, fixture);
  const saved = await page.evaluate(async (fixture) => {
    const store=await import('/src/store.js');return store.scoreSubitemsOf(fixture.itemId);
  }, fixture);
  evidence.savedDefinitions = saved;
  for (let i=0;i<fixture.definitions.length;i++) assert.equal(saved[i].createdAt,fixture.definitions[i].createdAt);
  assert.equal(saved[0].startDate,null);assert.equal(saved[0].latePoints,latePoints);
  evidence.checks.push('actual_items_sheet_validation_and_immutable_creation');
  await page.goto(new URL(`/#/teaching/${fixture.teachingId}/grades`, base).href);
  await page.locator(`[data-act="pick"][data-id="${fixture.itemId}"]`).click();
  const button = () => page.locator(`[data-act="subitem-completion"][data-student="${fixture.studentId}"][data-subitem="${fixture.definitions[0].id}"]`);
  const equalButton = () => page.locator(`[data-act="subitem-completion"][data-student="${fixture.studentId}"][data-subitem="${fixture.definitions[1].id}"]`);
  await button().waitFor();
  let clock = Date.parse('2026-10-13T06:00:00Z');
  const advance = async () => { clock += 500;await page.clock.setFixedTime(clock);await page.waitForTimeout(400); };
  const state = async () => page.evaluate(async (fixture) => {
    const store=await import('/src/store.js');const db=await import('/src/lib/db.js');
    const rows=(await db.getAll('scoreSubitemCompletions')).filter(row=>row.studentId===fixture.studentId&&row.subitemId===fixture.definitions[0].id);
    return { rows, value:store.state.scores.find(row=>row.studentId===fixture.studentId&&row.itemId===fixture.itemId)?.value };
  },fixture);
  const expectState = async (selected) => {
    await page.waitForFunction(({ fixture,selected }) => {
      const el=document.querySelector(`[data-act="subitem-completion"][data-student="${fixture.studentId}"][data-subitem="${fixture.definitions[0].id}"]`);
      return el?.classList.contains(`n94-completion--${selected}`)&&!el.disabled;
    },{fixture,selected});
  };
  async function layout(selected) {
    for(const width of [390,320]) for(const theme of ['light','dark']) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const rendered=await button().evaluate(el=>{
        const box=el.getBoundingClientRect(),css=getComputedStyle(el);
        return {height:box.height,width:box.width,left:box.left,right:box.right,
          color:css.color,background:css.backgroundColor,text:el.textContent,label:el.getAttribute('aria-label')};
      });
      assert.ok(rendered.height>=44&&rendered.width>=44);
      assert.ok(rendered.left>=0&&rendered.right<=width,`touch target reachable at ${width}`);
      assert.ok(rendered.label&&rendered.text.includes({unrecorded:'غير مرصود',late:'متأخر',regular:'عادي'}[selected]));
      const luminance=(color)=>{const c=color.match(/\d+/g).slice(0,3).map(x=>Number(x)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
      const a=luminance(rendered.color),b=luminance(rendered.background);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'state text contrast >= 4.5');
      const file=`${selected}-${theme}-${width}.png`;await page.screenshot({path:join(directory,file),fullPage:true});
      evidence.screenshots.push(file);
    }
  }
  await expectState('unrecorded');await layout('unrecorded');
  await advance();
  await button().evaluate(el=>{el.click();el.click();}); // duplicate event, one deliberate selection
  await expectState('late');await layout('late');
  assert.ok((await button().textContent()).includes(String(latePoints)));
  assert.equal((await state()).rows.length,1);assert.equal((await state()).rows[0].completionState,'late');
  await advance();await button().click();await expectState('regular');await layout('regular');
  assert.ok((await button().textContent()).includes(String(fixture.definitions[0].value)));
  await advance();await button().click();await expectState('unrecorded');
  assert.equal((await state()).rows[0].checked,false);
  await advance();await equalButton().click();
  await page.waitForFunction(({ fixture })=>document.querySelector(`[data-student="${fixture.studentId}"][data-subitem="${fixture.definitions[1].id}"]`)?.classList.contains('n94-completion--late'),{fixture});
  assert.ok((await equalButton().textContent()).includes(String(fixture.definitions[1].value)));
  await advance();await equalButton().click();
  await page.waitForFunction(({ fixture })=>document.querySelector(`[data-student="${fixture.studentId}"][data-subitem="${fixture.definitions[1].id}"]`)?.classList.contains('n94-completion--regular'),{fixture});
  assert.ok((await equalButton().textContent()).includes(String(fixture.definitions[1].value)));
  await advance();await button().click();await expectState('late');
  // Reload and a later clock preserve the saved teacher-selected late label.
  await page.clock.setFixedTime(new Date('2026-10-20T06:00:00Z'));await page.reload();
  await page.locator(`[data-act="pick"][data-id="${fixture.itemId}"]`).click();await expectState('late');
  assert.equal((await state()).rows.length,1);
  evidence.checks.push('actual_gradebook_three_states_points_equal_points_reload_mobile_rtl_light_dark_contrast');
  // Unchanged N84 controls still appear only on participation-backed auto items.
  const automatic=await page.evaluate(async(fixture)=>{
    const store=await import('/src/store.js');return store.items(fixture.teachingId).filter(row=>row.auto).map(row=>({id:row.id,auto:row.auto}));
  },fixture);
  for(const item of automatic){await page.locator(`[data-act="pick"][data-id="${item.id}"]`).click();
    await page.waitForFunction(id=>document.querySelector(`[data-act="pick"][data-id="${id}"]`)?.getAttribute('aria-selected')==='true',item.id);
    assert.equal(await page.locator('[data-act="n84-log"]').count()>0,item.auto==='participation');}
  assert.deepEqual(errors,[]);
  evidence.checks.push('n84_controls_and_no_application_errors');
  console.log(JSON.stringify({checks:evidence.checks,screenshots:evidence.screenshots.length,sourceAssets:evidence.assets.length}));
} finally {
  await page?.screenshot({path:join(directory,'last-ui-state.png'),fullPage:true});
  await context?.close();await browser.close();
  await writeFile(join(directory,'product-ui-result.json'),JSON.stringify(evidence,null,2));
}
