import {test,expect} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test.use({viewport:{width:390,height:844},serviceWorkers:'block'});
test.beforeEach(async({context,baseURL})=>{
  await context.route('**/*',route=>
    new URL(route.request().url()).origin===new URL(baseURL).origin
      ? route.continue() : route.abort());
  await context.addInitScript(()=>{
    sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
  });
});
async function fixture(page,{long=false}={}){
  await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
  await openReadyServedDemo(page,process.env.RAKEEZX_E2E_BASE_URL);
  return page.evaluate(async long=>{
    const store=await import('/src/store.js');
    const {compactSectionLabel}=await import('/src/lib/class-order.js');
    const {compactSubjectLabel}=await import('/src/lib/subject-catalog.js');
    if(store.getActiveWorkspace()?.type!=='demo')throw Error('SYNTHETIC_DEMO_ONLY');
    const label=long?'شعبة تجريبية ذات اسم طويل للغاية للعرض':'19';
    const section=await store.createSection({grade:5,label});
    const subject=await store.resolveSubjectSelection({token:long?'builtin:life-family-skills':'builtin:digital-skills'});
    const teaching=await store.createTeaching({sectionId:section.id,subjectId:subject.id});
    await store.addStudent(section.id,'طالب تجريبي لا يمثل شخصًا حقيقيًا');
    return {
      teachingId:teaching.id,sectionId:section.id,subjectId:subject.id,
      fullSection:store.sectionLabel(section),fullSubject:subject.name,
      shortSection:compactSectionLabel(section),
      shortSubject:compactSubjectLabel(subject,store.subjects()),
      fullTeaching:store.teachingLabel(teaching)
    };
  },long);
}
const oneLine=async node=>node.evaluate(el=>{
  const computed=getComputedStyle(el);
  const lineHeight=parseFloat(computed.lineHeight);
  const height=el.getBoundingClientRect().height;
  return {height,lineHeight,whiteSpace:computed.whiteSpace,
    fits:computed.whiteSpace==='nowrap'&&(!Number.isFinite(lineHeight)||height<=lineHeight*1.65)};
});
async function compactPair(page,parent,label,full,short){
  const target=parent.locator(label);
  await expect(target).toHaveAttribute('title',full);
  await expect(target.locator('.n133-short-name')).toBeVisible();
  await expect(target.locator('.n133-full-name')).toBeHidden();
  await expect(target.locator('.n133-short-name')).toHaveText(short);
}
test('inside classroom the mobile name and + / settings stay on one row',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const f=await fixture(page);
  await page.goto('/#/teaching/'+f.teachingId);
  const hub=page.locator('.class-hub-header');
  await expect(hub).toBeVisible();
  const switcher=hub.locator('.class-name-switcher-btn');
  const material=hub.locator('.class-hub-header__sub');
  const icons=hub.locator('.class-hub-header__end');
  for(const width of [320,360,390,540,640]){
    await page.setViewportSize({width,height:844});
    await expect(switcher.locator('.class-identity-short')).toBeVisible();
    await expect(switcher.locator('.class-identity-short')).toHaveText(f.shortSection);
    await expect(material.locator('.class-identity-short')).toHaveText(f.shortSubject);
    await expect(material).toHaveAttribute('title',f.fullSubject);
    await expect(hub.getByRole('button',{name:'إضافة مادة أخرى لهذا الفصل'})).toBeVisible();
    await expect(hub.getByRole('button',{name:'تعديل الفصل'})).toBeVisible();
    const rects=await hub.evaluate(el=>{
      const identity=el.querySelector('.class-hub-header__identity-block').getBoundingClientRect();
      const rail=el.querySelector('.class-hub-header__end').getBoundingClientRect();
      return {identityY:identity.top,railY:rail.top,identityH:identity.height,railH:rail.height};
    });
    expect(Math.abs(rects.identityY-rects.railY)).toBeLessThan(24);
    expect(await oneLine(switcher.locator('.class-name-switcher-btn__title'))).toMatchObject({fits:true});
    expect(await oneLine(material)).toMatchObject({fits:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  }
  await page.setViewportSize({width:1280,height:900});
  await expect(switcher.locator('.class-identity-full')).toBeVisible();
  await expect(material.locator('.class-identity-full')).toBeVisible();
  expect(errors).toEqual([]);
});
test('classes directory cards use full names above phone width, compact on phones',async({page})=>{
  const f=await fixture(page,{long:true});
  await page.goto('/#/classes');
  const card=page.locator('a.class-card__main[href="#/teaching/'+f.teachingId+'"]');
  await expect(card).toBeVisible();
  for(const width of [320,390,640]){
    await page.setViewportSize({width,height:844});
    await compactPair(page,card,'.class-card__title',f.fullSection,f.shortSection);
    await compactPair(page,card,'.class-card__sub',f.fullSubject,f.shortSubject);
    expect((await oneLine(card.locator('.class-card__title'))).fits).toBe(true);
    expect((await oneLine(card.locator('.class-card__sub'))).fits).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  }
  await page.setViewportSize({width:1024,height:880});
  await expect(card.locator('.class-card__title .n133-full-name')).toBeVisible();
  await expect(card.locator('.class-card__sub .n133-full-name')).toBeVisible();

  // A section without a Teaching still has its own clickable roster card.
  const orphan=await page.evaluate(async()=>{
    const store=await import('/src/store.js');
    const section=await store.createSection({grade:4,label:'ن133-بلا-مادة'});
    return {id:section.id,name:store.sectionLabel(section)};
  });
  await page.goto('/#/classes');
  const subjectless=page.locator('details.class-card[data-section-roster="'+orphan.id+'"]');
  await expect(subjectless).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(subjectless.locator('.class-card__title .n133-short-name')).toHaveText('رابع/ن133-بلا-مادة');
  await expect(subjectless.locator('.class-card__title')).toHaveAttribute('title',orphan.name);
  expect((await oneLine(subjectless.locator('.class-card__title'))).fits).toBe(true);
});
test('attendance context and reports picker use short labels only as mobile display',async({page})=>{
  const f=await fixture(page);
  await page.goto('/#/teaching/'+f.teachingId+'/attendance');
  const identity=page.locator('.attendance-01c__identity');
  await expect(identity).toBeVisible();
  for(const width of [320,390,640]){
    await page.setViewportSize({width,height:844});
    await expect(identity.locator('h2 .n133-short-name')).toHaveText(f.shortSection);
    await expect(identity.locator('p .n133-short-name')).toHaveText(f.shortSubject);
    await expect(identity.locator('h2')).toHaveAttribute('title','حضور '+f.fullSection);
    await expect(identity.locator('p')).toHaveAttribute('title',f.fullSubject);
    expect((await oneLine(identity.locator('h2'))).fits).toBe(true);
  }
  await page.setViewportSize({width:1024,height:900});
  await expect(identity.locator('h2 .n133-full-name')).toBeVisible();
  await page.goto('/#/reports');
  const row=page.locator('a.report-class-row[href="#/teaching/'+f.teachingId+'/reports"]');
  // Report destinations live inside collapsed grade groups until the teacher opens one.
  await row.locator('xpath=ancestor::details').locator('summary').click();
  await expect(row).toBeVisible();
  const name=row.locator('.n133-report-class-name');
  await page.setViewportSize({width:390,height:844});
  await expect(name.locator('.n133-short-name')).toHaveText(f.shortSection+' · '+f.shortSubject);
  await expect(name).toHaveAttribute('title',f.fullSection+' · '+f.fullSubject);
  expect((await oneLine(name)).fits).toBe(true);
  await expect(row).toHaveAttribute('href','#/teaching/'+f.teachingId+'/reports');
  await page.setViewportSize({width:1280,height:900});
  await expect(name.locator('.n133-full-name')).toBeVisible();
  // Exercise the source CSS in print media even at a narrow viewport.
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({media:'print'});
  await expect(name.locator('.n133-full-name')).toHaveCSS('display','inline');
  await expect(name.locator('.n133-short-name')).toHaveCSS('display','none');
  await page.emulateMedia({media:'screen'});
  await row.click();
  await expect(page).toHaveURL(new RegExp('/#/teaching/'+f.teachingId+'/reports$'));
  const document=page.locator('.report-document');
  await expect(document).toContainText(f.fullSection);
  await expect(document).toContainText(f.fullSubject);
  const stored=await page.evaluate(({sectionId,subjectId,teachingId})=>{
    const s=window.store;return {
      section:s.getSection(sectionId)?.label,
      subject:s.getSubject(subjectId)?.name,
      teaching:s.getTeaching(teachingId)?.subjectId
    };
  },f);
  expect(stored).toEqual({section:'19',subject:f.fullSubject,teaching:f.subjectId});
});
