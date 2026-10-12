import {test,expect} from '@playwright/test';
import {createCloud,authenticated} from './helpers/remote-sync-browser.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('actual Product dialog consumes server scope and receipt before local deletion',async({page})=>{
  const transport=createCloud();await authenticated(page,transport);
  await page.route('https://*.supabase.co/auth/v1/user',r=>r.fulfill({json:{id:owner}}));
  await page.goto('/#/classes');await page.waitForFunction(()=>window.store?.state.ready);
  await page.evaluate(async()=>{
    await (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();await window.store.renewOfflineLease();
    const db=await import('/src/lib/db.js'),m=await import('/src/models.js');
    await db.put('sections',m.makeSection({id:'n77-ui-section',yearId:'remote-year',grade:4,label:'N77'}));
    for(const id of ['n77-ui-one','n77-ui-two'])await db.put('teachings',m.makeTeaching({id,sectionId:'n77-ui-section',subjectId:'remote-subject',termId:'remote-term-1'}));
    await window.store.init();
  });
  await page.goto('/#/classes');await page.waitForFunction(()=>window.store?.state.ready);
  await page.evaluate(async()=>{await (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation();await window.store.renewOfflineLease();});
  let commits=0;
  await page.route('https://*.supabase.co/rest/v1/rpc/n77_delete_teaching',async route=>{
    const p=route.request().postDataJSON();
    if(p.p_commit)commits++;
    await route.fulfill({json:{ownerId:owner,selectedTeachingId:p.p_teaching_id,sectionId:p.p_expected_section_id,
      scope:'teaching',fingerprint:'synthetic-fingerprint',teachingIds:[p.p_teaching_id],
      ...(p.p_commit?{outcome:'deleted',mutationId:p.p_mutation_id,cascadeTeachingIds:[p.p_teaching_id],orphanStudentIds:[]}: {})}});
  });
  await page.locator('[data-act="delete-class-flow"]').click();let dialog=page.getByRole('dialog');
  await dialog.locator('[data-teaching-id="n77-ui-one"]').click();await dialog.locator('#class-delete-next-btn').click();
  await expect(dialog.locator('.class-delete-confirm-box__consequence')).toContainText('هذه المادة');
  expect(await dialog.locator('#class-delete-confirm-btn').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(commits).toBe(0);expect(await page.evaluate(()=>!!window.store.getTeaching('n77-ui-one'))).toBe(true);
  await dialog.locator('#class-delete-confirm-btn').click();await expect(dialog).toHaveCount(0);
  expect(commits).toBe(1);expect(await page.evaluate(()=>window.store.getTeaching('n77-ui-one'))).toBe(null);
  expect(await page.evaluate(()=>!!window.store.getTeaching('n77-ui-two'))).toBe(true);
  expect(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).get('device','device')).n77DeleteReceipt.scope)).toBe('teaching');
});
