import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ownerCheckpoint} from './n71-live/runner.mjs';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../src/lib/cloud.js';
import {createCloud} from './helpers/remote-sync-browser.mjs';
import {SYNC_V2_SCHEMAS} from '../src/lib/sync-v2.js';
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',STUDENT='n71:document:student';
const session={access_token:'initial-restore-access',refresh_token:'initial-restore-refresh',expires_at:4102444800,user:{id:OWNER,email:'restore@example.test'}};
// Reuse the existing Initial Restore synthetic transport helpers verbatim.
const existing=await fs.readFile(new URL('./initial-restore.e2e.mjs',import.meta.url),'utf8');
const helpers=existing.slice(existing.indexOf('async function installAuth('),existing.indexOf("test('fresh CORE_V2"))
 .replace('`${SUPABASE_URL}/rest/v1/**`','`${SUPABASE_URL}/rest/v1/rpc/*restore_manifest*`');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const {installAuth,installRestoreCloud}=await new AsyncFunction('AUTH_STORAGE_KEY','SUPABASE_URL','session','OWNER',helpers+'\nreturn {installAuth,installRestoreCloud};')(AUTH_STORAGE_KEY,SUPABASE_URL,session,OWNER);

test('actual app delayed/replaced document exercises exact ownerCheckpoint and rejects owner/receipt/outbox negatives',async({page})=>{
 test.setTimeout(90000);
 await page.routeWebSocket('wss://*.supabase.co/**',socket=>socket.close());
 await page.route('https://**',route=>route.abort());
 const cloud=createCloud();
 cloud.seed('students',{id:STUDENT,revision:1,field_revisions:{},deleted_at:null,name:'N71 document student',status:'active',note:'canonical document'});
 await cloud.route(page);
 await installAuth(page);
 const canonical=Object.fromEntries(Object.values(SYNC_V2_SCHEMAS).filter(schema=>schema.entity!=='profile').map(schema=>[schema.entity,cloud.table(schema.entity)]));
 const manifest=[{entity:'profile',id:'profile',revision:cloud.profile().revision,deleted:false},...Object.entries(canonical).flatMap(([entity,rows])=>rows.map(row=>({entity,id:row.id,revision:row.revision,deleted:false})))];
 const releaseManifest=await installRestoreCloud(page,{manifest,canonical,protocol:'CORE_V2',delayManifest:true});
 await page.route('**/rpc/score_foundation_capability',route=>route.fulfill({json:{scoreDomainVersion:1,restoreProtocol:'CORE_V2'}}));
 await page.route('**/rpc/n71_restore_capability',route=>route.fulfill({status:204}));
 await page.goto('/#/');
 await expect(page.locator('[data-initial-restore-state]')).toBeVisible();
 let premature=false;
 const pending=ownerCheckpoint(page,OWNER,{studentId:STUDENT}).then(value=>{premature=true;return value;});
 await new Promise(resolve=>setTimeout(resolve,150));assert.equal(premature,false,'Delayed actual Initial Restore must not yield a checkpoint');
 releaseManifest();
 const initial=await pending;
 assert.equal(initial.receipt.ownerId,OWNER);assert.equal(initial.targetStudent.id,STUDENT);
 await expect(page.locator('.topbar__title')).toBeVisible();

 // Reproduce the old separated-read failure in a genuinely replaced document:
 // delay the real application entry, without replacing its DOM or source.
 const earlier=await page.evaluate(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId;});
 assert.equal(earlier,OWNER);
 let releaseApp;let appGate=new Promise(resolve=>{releaseApp=resolve;});
 const holdApp=async route=>{await appGate;await route.fallback();};
 await page.route('**/src/app.js',holdApp);
 await page.reload({waitUntil:'commit'});
 const separated=await page.evaluate(async()=>{const db=await import('/src/lib/db.js');const store=await import('/src/store.js');return {databaseName:db.getActiveDatabaseName(),workspace:store.getActiveWorkspace(),receipt:await db.readInitialRestoreReceipt(),students:(await db.getAll('students')).length};});
 assert.deepEqual(separated,{databaseName:'rakeezx',workspace:null,receipt:null,students:0});
 releaseApp();await page.unroute('**/src/app.js',holdApp);

 // A second replacement clears the legacy connection opened by that bad read.
 appGate=new Promise(resolve=>{releaseApp=resolve;});await page.route('**/src/app.js',holdApp);
 await page.reload({waitUntil:'commit'});
 let finished=false;const stablePromise=ownerCheckpoint(page,OWNER,{studentId:STUDENT}).then(value=>{finished=true;return value;});
 await new Promise(resolve=>setTimeout(resolve,150));assert.equal(finished,false);
 releaseApp();await page.unroute('**/src/app.js',holdApp);
 const stable=await stablePromise;
 assert.equal(stable.workspace.authUserId,OWNER);assert.equal(stable.databaseName,stable.workspace.databaseName);
 assert.match(stable.databaseName,/^rakeezx-user-/);assert.equal(stable.receipt.ownerId,OWNER);
 assert.equal(stable.targetStudent.id,STUDENT);assert.equal(stable.targetStudent.note,'canonical document');
 await expect(page.locator('.topbar__title')).toBeVisible();
 await assert.rejects(ownerCheckpoint(page,'99999999-9999-4999-8999-999999999999',{studentId:STUDENT,timeout:300}),/Timeout/);
 const device=await page.evaluate(async()=>await(await import('/src/lib/db.js')).get('device','device'));
 await page.evaluate(async device=>{delete device.initialRestoreReceipt;await(await import('/src/lib/db.js')).put('device',device);},structuredClone(device));
 await assert.rejects(ownerCheckpoint(page,OWNER,{studentId:STUDENT,timeout:300}),/Timeout/);
 await page.evaluate(async device=>await(await import('/src/lib/db.js')).put('device',device),device);
 await page.evaluate(async()=>await(await import('/src/lib/db.js')).put('outbox',{id:'n71:checkpoint:rejected',protocol:'v2',store:'students',state:'rejected',sequence:1}));
 await assert.rejects(ownerCheckpoint(page,OWNER,{studentId:STUDENT,timeout:300}),/Timeout/);
 await page.evaluate(async()=>await(await import('/src/lib/db.js')).remove('outbox','n71:checkpoint:rejected'));
 await fs.mkdir('coverage/n71-live/'+process.env.N71_RUN_ID,{recursive:true});
 await fs.writeFile('coverage/n71-live/'+process.env.N71_RUN_ID+'/actual-app-checkpoint.json',JSON.stringify({runId:process.env.N71_RUN_ID,separated,stable,negatives:['wrong owner','missing receipt','rejected outbox'],actualApp:true,actualCheckpoint:true,observedAt:new Date().toISOString()},null,2));
});
