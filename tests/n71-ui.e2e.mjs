import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { bootSettings } from './helpers/settings-0397.mjs';
test('N71 actual application presents one backup and one restore, validates files, fails closed offline, and uses canonical finalize',async({page})=>{
  test.setTimeout(90000);
  const { errors }=await bootSettings(page);
  await page.route('**/rpc/n71_restore_capability',route=>route.fulfill({json:{protocol:'N71_V1'}}));
  await page.route('**/rpc/score_foundation_capability',route=>route.fulfill({json:null}));
  await page.evaluate(async()=>{
    const db=await import('/src/lib/db.js');const profile=await db.get('profile','profile');
    await db.put('profile',{...profile,serverCanonical:{...profile},fieldRevisions:{}});
  });
  await page.goto('/#/settings/backup');
  // Exact-count responses are required by the existing complete-read helper.
  await page.route('**/rest/v1/**',route=>route.request().method()==='GET'
    ? route.fulfill({json:[],headers:{'Content-Range':'*/0','Access-Control-Expose-Headers':'Content-Range'}}) : route.fallback());
  await expect(page.locator('[data-act="export"]')).toHaveText('إنشاء نسخة احتياطية');
  await expect(page.locator('[data-act="pick-cloud-file"]')).toHaveText('استعادة نسخة احتياطية');
  await expect(page.locator('[data-act="pick-file"],[data-act="bootstrap-curriculum"],[data-act="claim-legacy-workspace"],[data-pick]')).toHaveCount(0);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-act="export"]').click()]);
  const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
  const backup=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const integrity=await page.evaluate(async backup=>(await import('/src/lib/export.js')).validateBackupIntegrity(backup),backup);
  expect(integrity.ok,JSON.stringify(integrity)).toBe(true);
  expect(backup.data.units).toEqual([]);expect(backup.data.assignments).toEqual([]);expect(backup.data.submissions).toEqual([]);
  expect(backup.data.device).toBeUndefined();expect(backup.data.outbox).toBeUndefined();
  await page.locator('#cloud-restore-file').setInputFiles({name:'corrupt.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(page.locator('.cloud-recovery-message.is-error')).toBeVisible();
  await page.locator('[data-act="reset-cloud"]').click();
  const file=await page.evaluate(async()=>{
    const cloud=await import('/src/lib/cloud.js'); const e=await import('/src/lib/export.js');
    const payload={app:'rakeezx',version:5,backupId:'n71-ui',sourceOwnerId:cloud.user.id,exportedAt:new Date().toISOString(),
      data:{students:[{id:'n71-ui-student',name:'طالب النسخة',status:'active',updatedAt:1,deleted:false}],items:[],scores:[],scoreSubitems:[],scoreSubitemCompletions:[]},baselines:{}};
    payload.backupHash=await e.sha256Hex(e.backupHashInput(payload));return payload;
  });
  await page.locator('#cloud-restore-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
  await expect(page.locator('[data-act="preview-cloud"]')).toBeVisible();
  const priorSync=await page.evaluate(async()=>(await import('/src/lib/sync.js')).state.lastSyncedAt??0);
  await page.context().setOffline(true);
  await page.locator('[data-act="preview-cloud"]').click();
  await expect(page.locator('.cloud-recovery-message.is-error')).toBeVisible();
  await expect(page.locator('[data-act="confirm-cloud"]')).toHaveCount(0);
  await page.context().setOffline(false);
  await page.waitForFunction(async prior=>{const sync=await import('/src/lib/sync.js');return sync.displayState().detailStatus==='synced'&&sync.state.lastSyncedAt>prior;},priorSync);
  await page.locator('[data-act="preview-cloud"]').click();
  await expect(page.locator('[data-act="confirm-cloud"]')).toBeEnabled();
  let stages=0,finalizes=0;let stageEnvelope;
  const canonical=await page.evaluate(async()=>{const {SYNC_V2_SCHEMAS}=await import('/src/lib/sync-v2.js');return Object.fromEntries(Object.values(SYNC_V2_SCHEMAS).map(schema=>[schema.entity,[]]));});
  canonical.students=[{id:'n71-ui-student',name:'طالب النسخة',status:'active',revision:1,deleted_at:null}];
  await page.route('**/rpc/stage_n71_restore',route=>{stages++;stageEnvelope=route.request().postDataJSON();return route.fulfill({json:{backupHash:stageEnvelope.p_backup_hash,stageHash:'n71-ui-stage'}});});
  await page.route('**/rpc/finalize_n71_restore',route=>{finalizes++;return route.fulfill({json:{protocol:'N71_V1',receipt:{status:'finalized'},canonical}});});
  await page.locator('[data-act="confirm-cloud"]').click();
  await expect(page.locator('[data-cloud-confirm]')).toBeVisible();
  await page.locator('[data-cloud-confirm]').click();
  await expect(page.getByText('تمت استعادة بياناتك بنجاح',{exact:true})).toBeVisible();
  expect(stages).toBe(1);expect(finalizes).toBe(1);expect(stageEnvelope.p_source_owner_id).toBe(file.sourceOwnerId);
  expect(await page.evaluate(async()=>{const db=await import('/src/lib/db.js');return (await db.get('students','n71-ui-student')).name;})).toBe('طالب النسخة');
  await page.locator('[data-act="reset-cloud"]').click();
  await mkdir('coverage/n71-current',{recursive:true});
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`coverage/n71-current/ui-${width}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);
});
