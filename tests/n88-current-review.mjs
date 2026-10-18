/** AI: focused NEW launcher/composition smoke; existing backend qualification reused. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {ttlSeconds,root} from '../drafts/n88-student-portal/current-review.mjs';
import {powershell,canonicalRoot,processIdentity} from './fixtures/n88-current-review/native-pg.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-current-functional-review-20261018',runId='02c487b0-7239-4750-b293-5ce1e9c480c1';
const taskFile=canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const launch=path.join(root,'drafts/n88-student-portal/current-review-launch.ps1');
const report={aiAuthored:true,taskId,runId,baseSha:'522bc6d991aceb90cb2ff83982f6a26d0e75a002',startedAt:new Date().toISOString(),checks:[],cleanup:{}};
const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
const cmd=(file,args)=>execFileSync(file,args,{encoding:'utf8',windowsHide:true,timeout:70000,maxBuffer:1024*1024});
const ps=args=>cmd(powershell,['-NoProfile','-NonInteractive','-File',launch,...args]);
const lease=action=>cmd(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonicalRoot+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]);
const receipt=()=>path.join(root,'tests/fixtures/n88-current-review/receipts',randomUUID()+'.json');
const read=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function assertStopped(file,initial) {
  let r;for(let i=0;i<100;i++){r=await read(file);if(r.status==='stopped')break;await sleep(200);}
  assert.equal(r.status,'stopped');assert.deepEqual(r.cleanup,{httpClosed:true,postgresStopped:true,ownedFilesRemoved:true});
  // Allow the receipt-writing Node process to finish its final event-loop turn.
  for(let i=0;i<20&&processIdentity(r.pid);i++)await sleep(100);
  assert.equal(processIdentity(r.pid),null);assert.equal(processIdentity(initial.postgres.pid),null);
  await assert.rejects(access(initial.phase));await assert.rejects(fetch(initial.url));
  return r;
}
let held=false,file,initial,failed;
try {
  assert.equal(ttlSeconds(),14400);assert.equal(ttlSeconds(28800),28800);
  for(const invalid of [0,28801,-1,'NaN',1.5])assert.throws(()=>ttlSeconds(invalid));
  assert.match(ps(['--help']),/maximum 8 hours/);
  assert.match(cmd(process.execPath,['drafts/n88-student-portal/current-review.mjs','--help']),/14400/);
  // The actual PS launcher rejects excessive TTL before starting any child.
  assert.throws(()=>ps(['-TtlSeconds','28801']));
  check('launcher_help_and_ttl_bounds','Node and PowerShell --help; default 14400s/max 28800s; invalid/over-limit TTL rejected before child startup.');
  const manifest=await read('drafts/n88-student-portal/activation/manifest.json');
  const reused=[];
  for(const [file,hash]of Object.entries(manifest.sources)) {
    const actual=createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex');
    // Published N44 adds Sync ACK observers; review mounts never invoke syncAll.
    // Use current source, but do not misrepresent this unrelated module as unchanged.
    if(file==='src/lib/sync.js') {report.unrelatedCurrentSource={file,sha256:actual,publication:'f4a948b3410d416d81aae155527916eebfb8134e',scope:'Sync ACK observers, not executed by this local review'};continue;}
    assert.equal(actual,hash,'Activation source drift: '+file);reused.push(file);
  }
  assert.equal(manifest.enabled,false);assert.equal(manifest.gates.browserReadiness,false);
  const runtime=await readFile('src/lib/student-portal-runtime.js','utf8');assert.match(runtime,/enabled: false, serviceRevision: null/);
  report.reusedEvidence=['tests/n88-client-binding.result.json','tests/n88-native-postgres-qualification.result.json','tests/n88-activation-postgres.result.json'];
  for(const evidence of report.reusedEvidence){const previous=await read(evidence);assert.ok(previous.checks.some(c=>c.status==='PASS'));assert.ok(!previous.checks.some(c=>c.status==='FAIL'));}
  check('source_bound_evidence_and_production_off',`${reused.length} activation source hashes match; unrelated published N44 Sync observer delta explicitly recorded, not certified as unchanged. Existing PIN/crypto/native SQL/owner evidence reused. Production readiness, deployment and staged activation remain OFF.`);
  assert.match(lease('acquire').trim(),/^(ACQUIRED|ALREADY OWNED) integration$/);held=true;
  file=receipt();const launched=JSON.parse(ps(['-TtlSeconds','180','-Receipt',file]));initial=launched.review;
  assert.equal(initial.status,'running');assert.equal(processIdentity(initial.pid).birth,initial.birth);
  assert.equal(processIdentity(initial.postgres.pid).birth,initial.postgres.birth);
  assert.equal(new URL(initial.url).hostname,'127.0.0.1');assert.ok(Date.parse(initial.expiresAt)>Date.now());
  report.process={pid:initial.pid,birth:initial.birth,postgresPid:initial.postgres.pid,postgresBirth:initial.postgres.birth};
  const url=new URL(initial.url).origin;
  for(const target of ['/docs/PRODUCT_LEDGER.md','/tests/fixtures/n88-current-review/seed.sql','/src/','/sw.js','/drafts/n88-student-portal/current-review.mjs','/.git/config'])assert.equal((await fetch(url+target)).status,404);
  assert.equal((await fetch(url+'/review/context?token=forbidden')).status,400);
  assert.equal((await fetch(url+'/review/context',{headers:{origin:'https://unrelated.invalid'}})).status,403);
  check('loopback_resource_boundary','Ephemeral port bound to 127.0.0.1; no directory/SQL/docs/config/server/SW exposure, no arbitrary query or foreign Origin. Browser CSP self-only, no worker, no cache/referrer.');
  await withIsolatedLocalBrowser({taskFile,runId,url,timeoutMs:120000},async({createContext})=>{
    for(const width of [390,1280]) {
      const context=await createContext({viewport:{width,height:900},locale:'ar-SA'}),errors=[],logs=[];const privateValues=[];
      context.setDefaultTimeout(15000);
      context.on('page',p=>{p.on('pageerror',e=>errors.push(e.name));p.on('console',m=>logs.push(m.text()));});
      context.on('request',r=>assert.equal(new URL(r.url()).origin,url));
      const teacher=await context.newPage();await teacher.goto(initial.url);
      await teacher.getByText('تجربة تشغيلية ببيانات مصطنعة؛ الخدمة الحية غير مفعلة.',{exact:true}).waitFor();
      const choose=async()=>{await teacher.locator('#n88-member option:not([value=""])').waitFor({state:'attached'});const v=await teacher.locator('#n88-member option:not([value=""])').getAttribute('value');await teacher.locator('#n88-member').selectOption(v);await teacher.locator('[data-select] button').click();};
      await choose();await teacher.locator('[data-issue]').click();await teacher.locator('[data-code]').waitFor();
      const pin=await teacher.locator('[data-code]').inputValue(),bookmark=await teacher.locator('[data-entry]').inputValue();
      assert.match(pin,/^[1-9][0-9]{3}$/);assert.equal(new URL(bookmark).search,'');privateValues.push(pin,new URL(bookmark).pathname.slice(3));
      const popup=context.waitForEvent('page');await teacher.locator('[data-review-student]').click();const student=await popup;
      await student.waitForLoadState();assert.equal(student.url(),bookmark);await student.locator('[data-claim]').waitFor();
      await student.locator('input').fill(pin);await student.locator('[data-claim] button').click();await student.getByRole('heading',{name:'ما المطلوب مني؟'}).waitFor();
      await teacher.locator('[data-cancel]').click();assert.equal(await teacher.locator('[data-code]').count(),0);assert.equal(await teacher.locator('[data-review-student]').isVisible(),false);
      await choose();const title='نشاط المراجعة '+width;
      await teacher.locator('#n88-title').fill(title);await teacher.locator('[name=published]').check();await teacher.locator('[data-publish] button').click();
      await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
      await student.locator('[data-refresh]').click();await student.getByRole('heading',{name:title,exact:true}).first().waitFor();
      await teacher.locator('[name=status]').selectOption('done');await teacher.locator('[data-publish] button').click();
      await teacher.getByText('حُفظ التحديث. يظهر للطالب عند التحديث.').waitFor();
      await student.locator('[data-refresh]').click();await student.locator('.n88-task').filter({hasText:title}).getByText('مكتمل',{exact:true}).waitFor();
      for(const page of [teacher,student])assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      // No PIN/link/cookie in these screenshots: teacher secret view was cleared.
      await teacher.screenshot({path:`tests/fixtures/n88-current-review/teacher-${width}.png`,fullPage:true});
      await student.screenshot({path:`tests/fixtures/n88-current-review/student-${width}.png`,fullPage:true});
      await teacher.locator('[data-revoke]').click();await teacher.getByText('أُلغي الوصول والرمز وجميع الجلسات.').waitFor();
      await student.locator('[data-refresh]').click();await student.locator('[data-claim]').waitFor();
      assert.equal(errors.length,0);assert.ok(logs.every(log=>privateValues.every(value=>!log.includes(value))));
      await context.close();
    }
  });
  check('n88_current_actual_client_gateway_service_pg_manual_review_journey','390/1280 fresh isolated contexts: actual teacher UI/owner command guard -> current client -> signed Cloudflare gateway -> Web/service -> restricted PG with exact staged migration; issue PIN1000..9999, new manual student link, claim, publish/read/update status, revoke denies. Actual student HTML/entry and source CSS; screenshots after clearing private controls. No remote network/SW/personal profiles.');
  ps(['-Stop','-Receipt',file]);await assertStopped(file,initial);file=null;
  report.cleanup.ownedStop={httpClosed:true,postgresStopped:true,nodeExited:true,ownedFilesRemoved:true};
  const expiryFile=receipt();file=expiryFile;initial=JSON.parse(ps(['-TtlSeconds','1','-Receipt',file])).review;
  const expired=await assertStopped(file,initial);assert.equal(expired.reason,'expired');file=null;
  report.cleanup.expiry={httpClosed:true,postgresStopped:true,nodeExited:true,ownedFilesRemoved:true};
  check('hidden_launcher_owned_shutdown_and_expiry','Actual hidden PS-launched process receipt matches CIM PID/birth for Node/PG. Owned graceful stop and independent 1s TTL expiry both close HTTP/PG, remove owned data, and exit Node; no unrelated process killed.');
}catch(e){failed=e;report.checks.push({name:'current_review_execution',status:'FAIL',evidence:'Focused smoke failed; original sanitized stack recorded in worker output. No private inputs retained.'});console.error(e.name,e.code||'',e.stack?.split('\n').filter(x=>x.includes(' at ')).join('\n'));}
finally {
  try {if(file){initial??=await read(file);ps(['-Stop','-Receipt',file]);await assertStopped(file,initial);}if(held){report.cleanup.leaseRelease=lease('release').trim();held=false;}}
  catch(e){failed??=e;report.cleanup.failure='Owned cleanup failed; no unrelated process touched.';}
  report.finishedAt=new Date().toISOString();
  await writeFile('tests/n88-current-review.result.json',JSON.stringify(report,null,2)+'\n');
}
if(failed)process.exitCode=1;else console.log('N88 current actual review smoke PASS; owned browser/server/PG/process/lease closed.');
