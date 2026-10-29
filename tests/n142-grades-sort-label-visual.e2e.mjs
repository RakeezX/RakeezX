// AI N142: one affected actual-app check, no live accounts or scoring changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test('N142 closed Arabic grades sort rendering', {timeout:120000}, async () => {
  const url='http://127.0.0.1:53142';
  const evidence=await mkdtemp(path.join(tmpdir(),'rakeez-n142-'));
  const server=await createServer({server:{host:'127.0.0.1',port:53142,strictPort:true,hmr:false}});
  try {
    await server.listen();
    await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n142-grades-filter-text-clip-20261029.json',
      runId:process.env.RAKEEZ_RUN_ID||'9c9d5589-6878-49d6-a562-448618b9b407',url,timeoutMs:110000},async({createContext})=>{
      const context=await createContext({viewport:{width:1280,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh',colorScheme:'light',deviceScaleFactor:2});
      await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      const page=await context.newPage();
      await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
      await openReadyServedDemo(page,url);
      const teachingId=await page.evaluate(async()=>{const s=await import('/src/store.js');return s.teachings()[0].id;});
      await page.goto(url+'/#/teaching/'+teachingId+'/grades');
      const select=page.getByRole('combobox',{name:'ترتيب الطلاب'});
      await expect(select).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      const results=[];
      for(const width of [320,390,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const [value,label] of [['default','أبجديًا'],['score_desc','الأعلى درجة'],['score_asc','الأقل درجة']]) {
          await select.selectOption(value);
          await expect(select).toHaveValue(value); // actual change handler rerenders selection
          const geometry=await select.evaluate(el=>{
            const s=getComputedStyle(el),r=el.getBoundingClientRect();
            const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
            ctx.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
            const ink=ctx.measureText(el.selectedOptions[0].textContent);
            return {label:el.selectedOptions[0].textContent,direction:s.direction,font:s.fontFamily,
              height:r.height,width:r.width,left:r.left,right:r.right,lineHeight:parseFloat(s.lineHeight),
              contentHeight:el.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom),
              contentWidth:el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),
              inkHeight:ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent,inkWidth:ink.width,
              arrow:s.backgroundImage,arrowPadding:parseFloat(s.paddingInlineEnd),
              overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
          });
          assert.equal(geometry.label,label);
          assert.equal(geometry.direction,'rtl');
          assert.ok(geometry.height>=44);
          assert.ok(geometry.contentHeight>=geometry.lineHeight);
          assert.ok(geometry.contentHeight>=geometry.inkHeight+2,'Arabic ink needs vertical clearance');
          assert.ok(geometry.contentWidth>=geometry.inkWidth+2,'Label must fit beside arrow padding');
          assert.ok(geometry.arrow.includes('linear-gradient')&&geometry.arrowPadding>=32);
          assert.ok(geometry.left>=0&&geometry.right<=width);
          assert.ok(geometry.overflow<=1,'No sideways page overflow');
          await select.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          await expect(select).toBeFocused();
          await page.locator('.grades-01c__toolbar').screenshot({path:path.join(evidence,`${width}-${value}.png`)});
          results.push({viewport:width,value,...geometry});
        }
      }
      console.log(JSON.stringify({evidence,results}));
    });
  } finally {await server.close();}
});
