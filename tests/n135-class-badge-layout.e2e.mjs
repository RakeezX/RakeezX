// Run with node: owns its loopback Vite server and disposable synthetic browser.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

const url='http://127.0.0.1:53135';
const server=await createServer({server:{host:'127.0.0.1',port:53135,strictPort:true,hmr:false}});
try {
  await server.listen();
  await withIsolatedLocalBrowser({
    taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n135-mobile-class-badge-20261029.json',
    runId:process.env.RAKEEZ_RUN_ID||'7f7edf7b-c27a-44d7-a77c-56ff340b7baf',
    url,timeoutMs:90000,
  },async({createContext})=>{
    const context=await createContext({viewport:{width:320,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
    await openReadyServedDemo(page,url);
    const fixtures=await page.evaluate(async()=>{
      const store=await import('/src/store.js');
      if(store.getActiveWorkspace()?.type!=='demo')throw Error('DEMO_ONLY');
      const results=[];
      for(const [index,label] of ['51','52','53'].entries()){
        const section=await store.createSection({grade:5,label});
        const teaching=await store.createTeaching({sectionId:section.id});
        await store.addStudent(section.id,'طالب تجريبي افتراضي');
        if(index<2){
          const session=await store.ensureSession(teaching.id,'2026-09-09',1);
          if(index===0)await store.setAttendance(session.id,store.students(teaching.id)[0].id,'present');
        }
        results.push({id:teaching.id,full:store.sectionLabel(section),badge:['رُصد','حصة اليوم',''][index]});
      }
      return results;
    });
    await page.goto(url+'/#/classes');
    const evidence=[];
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});
      for(const f of fixtures){
        const card=page.locator('a.class-card__main[href="#/teaching/'+f.id+'"]');
        await expect(card).toBeVisible();
        const title=card.locator('.class-card__title');
        await expect(title).toHaveAttribute('title',f.full);
        await expect(title).toHaveAttribute('aria-label',f.full);
        await expect(title.locator('.n133-short-name')).toBeVisible();
        await expect(title.locator('.n133-full-name')).toBeHidden();
        const item=await card.evaluate(el=>{
          const title=el.querySelector('.class-card__title');
          const name=title.querySelector('.n133-short-name');
          const badge=el.querySelector('.class-card__head > .badge');
          return {compact:name.textContent.trim(),badge:badge?.textContent.trim()||'',
            clipped:name.scrollWidth>name.clientWidth+1||title.scrollWidth>title.clientWidth+1,
            separate:!badge||badge.getBoundingClientRect().top>=name.getBoundingClientRect().bottom-1,
            direction:getComputedStyle(el).direction,documentWidth:document.documentElement.scrollWidth};
        });
        evidence.push({width,...item});
        console.log(JSON.stringify({width,...item}));
        assert.equal(item.badge,f.badge,'Actual marked/today/none semantics');
        assert.equal(item.clipped,false,'Compact class name must not clip');
        assert.equal(item.separate,true,'Status must have its own row');
        assert.equal(item.direction,'rtl');
        assert.ok(item.documentWidth<=width,'No document overflow');
      }
      // Actual class selection and unchanged N133 controls, without modifying data.
      await page.locator('a.class-card__main[href="#/teaching/'+fixtures[0].id+'"]').click();
      await expect(page).toHaveURL(url+'/#/teaching/'+fixtures[0].id);
      const hub=page.locator('.class-hub-header');
      await expect(hub.locator('.class-identity-short').first()).toBeVisible();
      await expect(hub.getByRole('button',{name:'إضافة مادة أخرى لهذا الفصل'})).toBeVisible();
      await expect(hub.getByRole('button',{name:'تعديل الفصل',exact:true})).toBeVisible();
      await hub.locator('.class-name-switcher-btn').click();
      await expect(page.locator('.class-switcher-option').first()).toBeVisible();
      await page.locator('#modal-root').getByRole('link',{name:'كل الفصول',exact:true}).click();
      await expect(page.locator('.class-switcher-list')).toBeHidden();
      await expect(page).toHaveURL(url+'/#/classes');
    }
    console.log('N135_PASS '+JSON.stringify({cards:evidence.length,widths:[320,390],selectionAndSwitcher:true}));
  });
} finally {
  await server.close();
}
