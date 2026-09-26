import { test, expect } from '@playwright/test';

// Real shared Product screens in isolated Demo storage; no account or cloud fixture.
async function enter(page, date = '2026-09-20') {
  const errors = [], cloud = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('https://*.supabase.co/**', r => { cloud.push(r.request().url()); return r.abort(); });
  await page.clock.setFixedTime(new Date(`${date}T09:00:00`));
  await page.goto('/');
  if (!await page.getByRole('button', { name:'جرّب ركيز', exact:true }).isVisible())
    await page.getByRole('button', { name:/مركز تحكم/ }).click();
  await page.getByRole('button', { name:'جرّب ركيز', exact:true }).click();
  await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
  return { errors, cloud };
}
async function integrity(page, evidence) {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(evidence.errors).toEqual([]);
  expect(evidence.cloud).toEqual([]);
}
async function seed(page, scene, date) {
  await page.evaluate(async ({scene,date}) => {
    const db = await import('/src/lib/db.js');
    const {createDemoDataset} = await import('/src/lib/demo-workspace.js');
    const data = createDemoDataset();
    data.students[0].name = 'عبدالرحمن عبدالعزيز عبدالله محمد إبراهيم عبداللطيف القحطاني';
    data.students[1].name = 'أحمد';
    data.logs = []; data.sessions = []; data.attendance = []; data.sessionRosterSnapshots = [];
    if (scene !== 'schedule' && scene !== 'quicklog') {
      data.slots = scene === 'no-schedule' ? [] : data.slots.map(s => ({...s, weekday:1}));
      data.calendarDays = scene === 'holiday' ? [{id:'demo:holiday:0327',calendarId:data.calendars[0].id,date,kind:'national',label:'اليوم الوطني',deleted:false}] : [];
    }
    await db.writeAll(data, 'replace');
  }, {scene,date});
  await page.reload();
  await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
}

for (const [scene,date,title,text,action] of [
  ['no-schedule','2026-09-20','لم تُضف حصصك الأسبوعية بعد','بعد إعداد الجدول، ستظهر هنا حصص يومك.','إعداد الجدول'],
  ['normal','2026-09-20','لا توجد لديك حصص اليوم','يمكنك مراجعة جدول الأسبوع أو متابعة أعمال فصولك.','عرض الجدول'],
  ['friday','2026-09-25','لا توجد لديك حصص اليوم','نتمنى لك يومًا هادئًا. يمكنك مراجعة جدول الأسبوع.','عرض الجدول'],
  ['saturday','2026-09-26','لا توجد لديك حصص اليوم','نتمنى لك يومًا هادئًا. يمكنك مراجعة جدول الأسبوع.','عرض الجدول'],
  ['holiday','2026-09-23','اليوم الوطني','لا توجد لديك حصص مجدولة اليوم. يمكنك مراجعة جدول الأسبوع.','عرض الجدول'],
]) test(`N06 ${scene}: existing schedule/calendar context and real action`, async ({page}, info) => {
  const evidence = await enter(page,date);
  await seed(page,scene,date);
  for (const width of [1440,820,390]) {
    await page.setViewportSize({width,height:900});
    const empty = page.locator('.today-empty-card');
    await expect(empty.locator('h2')).toHaveText(title);
    await expect(empty.locator('p')).toHaveText(text);
    await expect(empty.getByRole('link',{name:action,exact:true})).toHaveAttribute('href','#/schedule');
    if (scene !== 'no-schedule') await expect(page.locator('.home-onboarding')).toHaveCount(0);
    await integrity(page,evidence);
  }
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.screenshot({path:info.outputPath(`${scene}.png`),fullPage:true});
  await page.locator('.today-empty-card').getByRole('link',{name:action,exact:true}).click();
  await expect(page).toHaveURL(/#\/schedule$/);
  await expect(page.locator('.week')).toBeVisible();
  await integrity(page,evidence);
});

test('N05 names, calm minus, responsive geometry and score persistence', async ({page},info) => {
  const evidence = await enter(page);
  await seed(page,'quicklog','2026-09-20');
  await page.goto('/#/teaching/demo:teaching:1/quicklog');
  const card = page.locator('[id="ql-demo:student:1"]');
  for (const theme of ['light','dark']) for (const width of [1440,820,390,320]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(theme => document.documentElement.dataset.theme = theme,theme);
    await expect(card).toBeVisible();
    const value = await card.evaluate(n => {
      const name=n.querySelector('.qlcard__name'),minus=n.querySelector('.qlcard__minus');
      const s=getComputedStyle(name),p=getComputedStyle(minus,'::before'),r=minus.getBoundingClientRect();
      return {clamp:s.webkitLineClamp,overflow:s.overflow,white:s.whiteSpace,height:name.getBoundingClientRect().height,line:parseFloat(s.lineHeight),backing:p.width,color:p.backgroundColor,target:[r.width,r.height]};
    });
    expect(value.clamp).toBe('2'); expect(value.overflow).toBe('hidden'); expect(value.white).toBe('normal');
    expect(value.height).toBeLessThanOrEqual(value.line*2+1); expect(value.height).toBeGreaterThan(value.line);
    expect(value.backing).toBe('22px'); expect(value.color).not.toBe('rgba(0, 0, 0, 0)');
    expect(value.target[0]).toBeGreaterThanOrEqual(44); expect(value.target[1]).toBeGreaterThanOrEqual(44);
    const short = page.locator('[id="ql-demo:student:2"] .qlcard__name');
    expect(await short.evaluate(n=>n.getBoundingClientRect().height)).toBeLessThanOrEqual(value.line+1);
    await integrity(page,evidence);
    await page.screenshot({path:info.outputPath(`quicklog-${width}-${theme}.png`),fullPage:true});
  }
  const geometry = await card.evaluate(n => {
    const name=n.querySelector('.qlcard__name'), before=n.getBoundingClientRect();
    name.style.display='block'; name.style.whiteSpace='nowrap'; name.style.lineHeight='normal';
    const baseline=n.getBoundingClientRect(); name.removeAttribute('style');
    return {current:[before.width,before.height],baseline:[baseline.width,baseline.height]};
  });
  expect(geometry.current).toEqual(geometry.baseline);
  const score = card.locator('.qlcard__score');
  const original = Number(await score.textContent());
  const label = n => n>0 ? `+${n}` : String(n);
  await card.locator('[data-act="plus"]').click();
  await expect(score).toHaveText(label(original+1));
  await page.reload(); await expect(score).toHaveText(label(original+1));
  await card.locator('[data-act="minus"]').click();
  await expect(score).toHaveText(label(original));
  await page.reload(); await expect(score).toHaveText(label(original));
  expect(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);
  await integrity(page,evidence);
});

test('N07 responsive period typography preserves hierarchy, geometry and day control', async ({page},info) => {
  const evidence = await enter(page);
  await seed(page,'schedule','2026-09-20');
  await page.goto('/#/schedule');
  for (const theme of ['light','dark']) for (const [width,size] of [[1440,'18px'],[820,'15.5px'],[390,'16px'],[320,'16px']]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const slot=page.locator('.slot:visible').first();
    await expect(slot).toBeVisible();
    await expect(slot.locator('.slot__period-num')).toHaveCSS('font-size',size);
    await expect(slot.locator('.slot__period-num')).toHaveCSS('font-weight','850');
    const geometry=await slot.evaluate((n,width)=>{
      const p=n.querySelector('.slot__period-num'),current=n.getBoundingClientRect();
      p.style.fontSize=width<=768?'14px':width<=1100?'13.5px':'16px'; p.style.fontWeight='800';
      const baseline=n.getBoundingClientRect(); p.removeAttribute('style');
      return {current:[current.width,current.height],baseline:[baseline.width,baseline.height]};
    },width);
    expect(geometry.current).toEqual(geometry.baseline);
    await expect(slot.locator('.slot__subject')).not.toBeEmpty();
    await expect(slot.locator('.slot__grade-sec')).not.toBeEmpty();
    await integrity(page,evidence);
    await page.screenshot({path:info.outputPath(`schedule-${width}-${theme}.png`),fullPage:true});
  }
  await page.locator('.schedule-day-tab[data-day="0"]').click();
  await expect(page.locator('.schedule-day-tab[data-day="0"]')).toHaveClass(/is-active/);
  await integrity(page,evidence);
});
