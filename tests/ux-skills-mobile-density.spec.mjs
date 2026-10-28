import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

const phase = process.env.UX_DENSITY_PHASE || 'before';
const base = 'test-results/ux-skills-compare/density-' + phase;

async function boot(page) {
  await page.route('**/*', route=>{
    const u = new URL(route.request().url());
    if (u.origin === 'http://127.0.0.1:5194' && ['GET','HEAD'].includes(route.request().method())) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto('/#/', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>window.store?.state?.ready===true, null, {timeout:25000});
  return page.evaluate(async()=>{
    const section=await window.store.createSection({grade:5,label:'1'});
    const teaching=await window.store.createTeaching({sectionId:section.id});
    const names=Array.from({length:24},(_,i)=>i===0
      ? 'عبدالرحمن بن محمد بن عبدالله بن عبدالعزيز بن محمد آل الشيخ'
      : 'طالب تجريبي رقم '+(i+1)+' بن محمد بن عبدالله');
    const r=await window.store.importStudents(section.id,names);
    return {teachingId:teaching.id,added:r.added};
  });
}

test('mobile action density, class tool grid, contrast and keyboard focus',async({page})=>{
  await mkdir(base,{recursive:true});
  const {teachingId,added}=await boot(page);
  expect(added).toBe(24);
  const measures=[];
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/teaching/'+teachingId+'/students');
    const actions=page.locator('.roster-populated-actions .btn');
    await expect(actions).toHaveCount(4);
    const roster=await page.evaluate(()=>{
      const a=document.querySelector('.roster-populated-actions');
      const btns=[...a.querySelectorAll('.btn')];
      const b=a.getBoundingClientRect();
      const first=document.querySelector('.roster-row')?.getBoundingClientRect();
      return {
        actionsHeight:Math.round(b.height),
        actionsTop:Math.round(b.top),
        firstRowTop:Math.round(first?.top||0),
        buttonRows:[...new Set(btns.map(n=>Math.round(n.getBoundingClientRect().top)))].length,
        buttonSizes:btns.map(n=>({width:Math.round(n.getBoundingClientRect().width),height:Math.round(n.getBoundingClientRect().height),text:n.innerText.trim()})),
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth
      };
    });
    await page.screenshot({path:base+'/roster-'+width+'.png',animations:'disabled'});
    await page.goto('/#/teaching/'+teachingId);
    await expect(page.locator('.class-tool-card')).toHaveCount(10);
    const hub=await page.evaluate(()=>{
      const grid=document.querySelector('.class-hub .quick-tools-grid');
      const cards=[...grid.querySelectorAll('.class-tool-card')];
      const cardBoxes=cards.map(n=>n.getBoundingClientRect());
      const visibleRows=[...new Set(cardBoxes.map(b=>Math.round(b.top)))].length;
      const clipped=cards.filter(n=>{
        const el=n.querySelector('.tile__title');
        return el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2;
      }).map(n=>n.innerText.trim().slice(0,50));
      return {columns:getComputedStyle(grid).gridTemplateColumns,rows:visibleRows,gridHeight:Math.round(grid.getBoundingClientRect().height),clipped,
        minCardHeight:Math.round(Math.min(...cardBoxes.map(b=>b.height))),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
    });
    await page.screenshot({path:base+'/hub-'+width+'.png',animations:'disabled'});
    measures.push({width,roster,hub});
    expect(roster.scrollWidth).toBeLessThanOrEqual(width);
    expect(hub.scrollWidth).toBeLessThanOrEqual(width);
  }
  await page.goto('/#/teaching/'+teachingId+'/students');
  const a11y=(await new AxeBuilder({page}).include('.students-roster-page').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  const edits=page.locator('.roster-row [data-act="edit"]').first();
  await edits.focus();
  const focus=await edits.evaluate(n=>({focused:document.activeElement===n,outlineStyle:getComputedStyle(n).outlineStyle,outlineWidth:getComputedStyle(n).outlineWidth}));
  console.log('UX_DENSITY='+JSON.stringify({phase,measures,axe:a11y.map(v=>v.id),focus,errors}));
  expect(a11y).toHaveLength(0);
  expect(focus.focused).toBe(true);
  expect(errors).toEqual([]);
  for (const {width,roster,hub} of measures) {
    expect(roster.buttonRows, `mobile ${width}px action rows`).toBe(2);
    expect(roster.actionsHeight, `mobile ${width}px actions height`).toBeLessThanOrEqual(120);
    expect(roster.buttonSizes.every(x => x.height >= 44 && x.width >= 44)).toBe(true);
    expect(hub.rows, `mobile ${width}px tool rows`).toBe(5);
    expect(hub.clipped).toEqual([]);
  }
  expect(measures[0].hub.gridHeight).toBeLessThanOrEqual(560);
});
