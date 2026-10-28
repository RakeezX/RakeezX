import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Arabic full subject remains spoken and execution report table is keyboard scrollable',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.context().addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   return u.origin==='http://127.0.0.1:5194'&&['GET','HEAD'].includes(route.request().method())
     ?route.continue():route.abort('blockedbyclient');
 });
 await page.setViewportSize({width:320,height:844});
 await page.goto('/#/classes',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.store?.state?.ready===true && window.store?.teachings().length>0,null,{timeout:25000});
 const id=await page.evaluate(()=>window.store.teachings()[0].id);
 await page.goto('/#/teaching/'+id+'/attendance');
 const subj=page.locator('.attendance-01c__names p');
 await subj.waitFor();
 await expect(subj).not.toHaveAttribute('aria-label',/.+/);
 await expect(subj.locator('.sr-only')).toHaveText(/المهارات الرقمية/);
 const attendanceViolations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
 await page.goto('/#/reports/execution');
 const region=page.locator('.execution-report-page .print-tablewrap');
 await region.waitFor();
 await expect(region).toHaveAttribute('role','region');
 await expect(region).toHaveAttribute('aria-label',/قابل للتمرير أفقيًا/);
 await expect(region).toHaveAttribute('tabindex','0');
 await region.focus();
 const focus=await region.evaluate(el=>({isFocused:document.activeElement===el,outline:getComputedStyle(el).outlineStyle}));
 const reportViolations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
 console.log('TWO_FIXES='+JSON.stringify({focus,attendanceRules:attendanceViolations.map(v=>v.id),reportRules:reportViolations.map(v=>v.id),errors}));
 expect(focus.isFocused).toBe(true);
 expect(attendanceViolations).toHaveLength(0);
 expect(reportViolations).toHaveLength(0);
 expect(errors).toEqual([]);
});
