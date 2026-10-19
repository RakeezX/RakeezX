// AI-authored N120: actual application frame geometry, synthetic fixture only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const root = new URL('../', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const base = 'http://127.0.0.1:5127';
const output = new URL('./fixtures/n120-1019/', import.meta.url);
const evidence = [];
const baseline = process.argv.includes('--baseline');
const baseSha = 'df8e49362e79b488bcf56fbdca5c94e361bead7a';
const original = new Map(baseline ? ['src/views/grades.js','src/views/reports.js','src/views/cross-class-reports.js','src/styles/filters.css','src/styles/grades.css'].map(p=>['/'+p,execFileSync('git',['show',baseSha+':'+p])]) : []);
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5127, strictPort: true } });
try {
  await server.listen();
  await mkdir(output, { recursive: true });
  await withIsolatedLocalBrowser({
    taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n120-stable-filter-geometry-20261019.json',
    runId: '26d59d19-139f-4f90-864f-0d3ed85407fc', url: base, timeoutMs: 120000,
  }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
    const page = await context.newPage();
    // Replay the actual immutable application sources for diagnostic mode only.
    if (baseline) await page.route('**/*', route => {
      const pathname = new URL(route.request().url()).pathname;
      return original.has(pathname) ? route.fulfill({status:200,contentType:pathname.endsWith('.css')?'text/css':'text/javascript',body:original.get(pathname)}) : route.fallback();
    });
    page.setDefaultTimeout(12000);
    await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    await openReadyServedDemo(page, base);
    await page.evaluate(async () => {
      const s = await import('/src/store.js');
      const termId = s.activeTerm().id, yearId = s.activeYear().id;
      await s.save({
        sections: ['a', 'b'].map((id, i) => ({ id: `n120-${id}`, yearId, grade: 9, section: String(i + 1) })),
        subjects: [{ id: 'n120-subject', name: 'مادة الاختبار' }],
        teachings: ['a', 'b'].map(id => ({ id: `n120-t-${id}`, sectionId: `n120-${id}`, subjectId: 'n120-subject', termId })),
        students: [{ id: 'n120-s1', name: 'أحمد اختبار', rollNo: 1 }, { id: 'n120-s2', name: 'بدر اختبار', rollNo: 2 }, { id: 'n120-s3', name: 'جابر اختبار', rollNo: 3 }],
        enrollments: [1, 2, 3].map(i => ({ id: `n120-e${i}`, studentId: `n120-s${i}`, sectionId: i === 3 ? 'n120-b' : 'n120-a', status: 'active' })),
        items: [{ id: 'n120-auto', teachingId: 'n120-t-a', name: 'مشاركة', auto: 'participation', max: 10, perPoint: 1, order: 2 }, ...['a', 'b'].map(id => ({ id: `n120-i-${id}`, teachingId: `n120-t-${id}`, name: 'اختبار', max: 10 }))],
        scores: [{ id: 'n120-score1', studentId: 'n120-s1', itemId: 'n120-i-a', value: 8 }, { id: 'n120-score3', studentId: 'n120-s3', itemId: 'n120-i-b', value: 2 }],
      });
    });
    // A long synthetic class exercises repainting while scrolled into the roster.
    await page.evaluate(async () => {
      const s = await import('/src/store.js');
      const yearId = s.activeYear().id, termId = s.activeTerm().id;
      await s.save({
        sections: [{id:'n120-deep-section', yearId, grade:9, section:'3'}],
        teachings: [{id:'n120-deep',sectionId:'n120-deep-section',subjectId:'n120-subject',termId}],
        items: [{id:'n120-deep-auto',teachingId:'n120-deep',name:'مشاركة',auto:'participation',max:10,perPoint:1}],
        students: Array.from({length:24},(_,i)=>({id:'n120-deep-s'+i,name:'طالب اختبار '+String(i).padStart(2,'0'),rollNo:i+1})),
        enrollments: Array.from({length:24},(_,i)=>({id:'n120-deep-e'+i,studentId:'n120-deep-s'+i,sectionId:'n120-deep-section',status:'active'})),
      });
      await s.addLog({teachingId:'n120-t-a',studentId:'n120-s1',kind:'participation',delta:9,tag:''});
    });
    const scoresBefore = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state.scores));
    async function settle() { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); }
    async function sample() {
      return page.evaluate(() => {
        const bar = document.querySelector('.report-filter-bar');
        const rect = el => { const r = el.getBoundingClientRect(); return [r.x, r.y + scrollY, r.width, r.height]; };
        return { quick: [...document.querySelectorAll('.n84-step')].map(rect), bar: rect(bar), controls: [...bar.querySelectorAll('select,input:not([type=checkbox]),button,.grades-01c__missing-filter')].map(rect), overflow: document.documentElement.scrollWidth > innerWidth, scrollY,
          css: [...document.styleSheets].some(s => s.href?.includes('/styles/filters.css')) };
      });
    }
    async function stable(name, action, { scroll = false } = {}) {
      await settle();
      const before = await sample();
      await page.evaluate(() => {
        window.n120Frames = []; window.n120Sampling = true;
        const frame = () => {
          const bar = document.querySelector('.report-filter-bar');
          if (bar) { const r=bar.getBoundingClientRect(); window.n120Frames.push({bar:[r.x,r.y+scrollY,r.width,r.height],scrollY,css:[...document.styleSheets].some(s=>s.href?.includes('/styles/filters.css'))}); }
          if (window.n120Sampling) requestAnimationFrame(frame);
        }; requestAnimationFrame(frame);
      });
      await action(); await settle();
      const frames=await page.evaluate(()=>{ window.n120Sampling=false;return window.n120Frames; });
      const after=await sample();
      const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
      const maxFrameDelta=Math.max(0,...frames.map(f=>delta(f.bar,before.bar)));
      const controlDelta=Math.max(0,...after.controls.map((r,i)=>delta(r,before.controls[i])),...after.quick.map((r,i)=>delta(r,before.quick[i])));
      const info={name,width:page.viewportSize().width,before,after,frames:frames.length,maxFrameDelta,controlDelta,missingCSSFrames:frames.filter(f=>!f.css).length,maxScrollDelta:Math.max(0,...frames.map(f=>Math.abs(f.scrollY-before.scrollY)))};
      evidence.push(info);
      if (!baseline) {
        assert.ok(maxFrameDelta<=1,`${name}: frame geometry ${JSON.stringify(info)}`);
        assert.ok(controlDelta<=1,`${name}: control geometry ${JSON.stringify(info)}`);
        assert.equal(info.missingCSSFrames,0,`${name}: stylesheet present in every frame`);
        assert.ok(after.controls.every(r=>r[0]>=0&&r[0]+r[2]<=page.viewportSize().width&&r[3]>=44),name+': visible 44px controls');
        if(page.viewportSize().width===1440)assert.ok(Math.max(...after.controls.map(r=>r[1]))<Math.min(...after.controls.map(r=>r[1]+r[3])),name+': one compact wide row');
        assert.equal(after.overflow,false,`${name}: no page horizontal overflow`);
        if(scroll)assert.ok(info.maxScrollDelta<=1,`${name}: scroll stable ${JSON.stringify(info)}`);
      }
    }
    async function go(path) { await page.goto(`${base}/#/${path}`); await page.locator('.report-filter-bar').waitFor(); await settle(); await page.evaluate(()=>scrollTo(0,0)); }
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await go('teaching/n120-t-a/grades');
      await stable('grade-search-focus',()=>page.locator('[data-input="search"]').focus());
      await stable('grade-sort',()=>page.locator('[data-change="sort"]').selectOption('score_asc'));
      await stable('grade-missing',()=>page.locator('[data-change="toggle-missing"]').check());
      await expect(page.locator('.grades-01c__direct-row')).toHaveCount(1);
      await stable('grade-unfilter',()=>page.locator('[data-change="toggle-missing"]').uncheck());
      await stable('grade-no-results',()=>page.locator('[data-input="search"]').fill('لا يطابق'));
      await page.getByText('لا يوجد طلاب مطابقين للتصفية',{exact:true}).waitFor();
      await stable('grade-reset-search',()=>page.locator('[data-input="search"]').fill(''));
      await page.locator('[data-act="pick"][data-id="n120-auto"]').click(); await settle();
      const plus=page.locator('[data-act="n84-log"][data-student="n120-s1"][data-delta="1"]');
      const minus=page.locator('[data-act="n84-log"][data-student="n120-s1"][data-delta="-1"]');
      await plus.scrollIntoViewIfNeeded(); await settle();
      const logsBefore=await page.evaluate(async()=>(await import('/src/store.js')).state.logs.length);
      await stable('quick-plus',async()=>{await plus.click();await expect(plus).toBeEnabled();},{scroll:true});
      await stable('quick-minus',async()=>{await minus.click();await expect(minus).toBeEnabled();},{scroll:true});
      assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).state.logs.length),logsBefore+2);
      await page.screenshot({path:new URL(`stable-grade-${width}.png`,output).pathname.replace(/^\/(\w:)/,'$1')});
      await go('teaching/n120-deep/grades');
      const deepPlus=page.locator('[data-act="n84-log"][data-student="n120-deep-s15"][data-delta="1"]');
      const deepMinus=page.locator('[data-act="n84-log"][data-student="n120-deep-s15"][data-delta="-1"]');
      await deepPlus.scrollIntoViewIfNeeded();await settle();
      assert.ok((await sample()).scrollY>300,'deep roster genuinely scrolled');
      await stable('scrolled-quick-plus',async()=>{await deepPlus.click();await expect(deepPlus).toBeEnabled();},{scroll:true});
      await stable('scrolled-quick-minus',async()=>{await deepMinus.click();await expect(deepMinus).toBeEnabled();},{scroll:true});
      await go('reports/grades');
      await stable('aggregate-grade',()=>page.locator('[data-change="n70-grade"]').selectOption('9'));
      await stable('aggregate-class',()=>page.locator('[data-change="n70-teaching"]').selectOption('n120-t-a'));
      await expect(page.locator('.n70-record')).toHaveCount(2);
      await stable('aggregate-missing',()=>page.locator('[data-change="n70-filter"]').selectOption('missing'));
      await expect(page.locator('.n70-record')).toHaveCount(1);
      await stable('aggregate-no-results',()=>page.locator('[data-input="n70-search"]').fill('لا يطابق'));
      await page.getByText('لا نتائج مطابقة',{exact:true}).waitFor();
      await stable('aggregate-reset',()=>page.locator('[data-act="n70-reset"]').click());
      await expect(page.locator('[data-change="n70-grade"]')).toHaveValue('all');
      await expect(page.locator('[data-change="n70-teaching"]')).toHaveValue('all');
      assert.equal(await page.locator('[data-n70-count]').innerText(),`${await page.locator('.n70-record').count()} نتيجة`);
      await page.screenshot({path:new URL(`stable-aggregate-${width}.png`,output).pathname.replace(/^\/(\w:)/,'$1')});
      await go('teaching/n120-t-a/reports');
      await page.locator('[data-act="tab"][data-tab="attendance"]').click();await settle();
      await stable('report-sort',()=>page.locator('[data-change="sort"]').selectOption('name'));
      await stable('report-detail',()=>page.locator('[data-act="att-mode"][data-mode="detailed"]').click());
      await stable('report-preview',()=>page.locator('[data-act="toggle-a4"]').click());
      await stable('report-close-preview',()=>page.locator('[data-act="toggle-a4"]').click());
      await stable('report-refresh',()=>page.evaluate(async()=>(await import('/src/repaint.js')).repaint()));
      await page.screenshot({path:new URL(`stable-attendance-${width}.png`,output).pathname.replace(/^\/(\w:)/,'$1')});
    }
    assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state.scores)),scoresBefore);
    await writeFile(new URL(`./n120-1019-stability${baseline?'-baseline':''}.json`,import.meta.url),JSON.stringify({baseSha,fixture:'synthetic Demo plus two short classes and one 24-student class',resources:'Canonical isolated local browser contexts/browser and owned Vite server closed in finally; loopback-only; Service Workers/external requests blocked',check:'n120_filter_geometry_stable_narrow_wide_semantics_preserved',status:baseline?'DIAGNOSTIC':'PASS',evidence},null,2)+'\n');
    console.log(JSON.stringify({mode:baseline?'baseline':'candidate',cases:evidence.length,maxFrameDelta:Math.max(...evidence.map(e=>e.maxFrameDelta)),maxControlDelta:Math.max(...evidence.map(e=>e.controlDelta)),missingCSSFrames:evidence.reduce((n,e)=>n+e.missingCSSFrames,0)}));
  });
} finally { await server.close(); }
