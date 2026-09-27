import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
test.use({serviceWorkers:'block'});
let server,host;const ROOT=process.cwd();
test.beforeAll(async()=>{
  host=process.env.RAKEEZX_BATCH0335_URL;if(host)return;
  const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
  server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://local');const file=path.resolve(ROOT,url.pathname==='/'?'index.html':url.pathname.slice(1));
    if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();
    try{if(!(await stat(file)).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));host=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server)await new Promise(r=>server.close(r));});
async function setup(page){
  const errors=[],cloud=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.context().route('https://xlrubcwjqktzzunrvuns.supabase.co/**',r=>{cloud.push(r.request().url());return r.abort();});
  // Bounded synthetic roster; retain real Demo startup, views and store operations.
  await page.context().route('**/src/lib/demo-workspace.js',async r=>{
    const response=await r.fetch();return r.fulfill({response,body:(await response.text()).replace(/const CLASS_PLAN = Object.freeze\(\[[\s\S]*?\]\);/,'const CLASS_PLAN = Object.freeze([{grade:4,label:1,students:1,slots:[[0,1]]}]);')});
  });
  await page.addInitScript(()=>{if(!sessionStorage.getItem('rakeezx-demo-session-v1'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
  await page.clock.setFixedTime(new Date('2026-09-09T09:15:00+03:00'));await page.goto(host+'/#/');await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
  const ids=await page.evaluate(async()=>{
    const s=await import('/src/store.js');const section=await s.createSection({grade:5,label:'فحص',name:'الخامس / فحص'});const subject=s.subjects()[0];
    const t=await s.createTeaching({sectionId:section.id,subjectId:subject.id});await s.addStudent(section.id,'طالب اصطناعي أول');await s.addStudent(section.id,'طالب اصطناعي ثان');await s.addSlot(t.id,0,8);const ids={teaching:t.id,subject:subject.name};
    for(const [kind,period,startTime,endTime] of [['completed',2,'06:00','06:45'],['pending',3,'07:00','07:45'],['current',4,'09:00','09:45'],['future',5,'10:00','10:45'],['untimed',6,'','']])ids[kind]=(await s.ensureSession(t.id,'2026-09-09',period,{startTime,endTime})).id;
    await s.fillAttendance(ids.completed,'present');ids.students=s.students(t.id).map(x=>x.id);return ids;
  });
  await page.goto(host+'/#/');return {ids,errors,cloud};
}
const route=(ids,kind)=>host+`/#/teaching/${ids.teaching}/attendance?session=${ids[kind]}`;
async function records(page,id){return page.evaluate(async id=>(await import('/src/lib/db.js')).getAll('attendance').then(rows=>rows.filter(r=>r.sessionId===id).sort((a,b)=>a.id.localeCompare(b.id))),id);}
async function safe(page,errors,cloud){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.locator('html')).toHaveAttribute('dir','rtl');expect(errors).toEqual([]);expect(cloud).toEqual([]);}

test('N04 individual marking, unchanged cancel, existing bulk operation and persisted marks in Demo',async({page},info)=>{
  const {ids,errors,cloud}=await setup(page);await page.goto(route(ids,'future'));
  await expect(page.locator('.attendance-prestart strong')).toHaveText('لم يبدأ وقت الحصة بعد');await expect(page.locator('.attendance-prestart p')).toHaveText('يمكنك رصد الحضور الآن إذا كنت تقصد ذلك.');
  await page.locator('[data-act=set][data-status=absent]').first().click();await expect.poll(async()=> (await records(page,ids.future)).length).toBe(1);await expect(page.locator('.sheet')).toHaveCount(0);
  const before=JSON.stringify(await records(page,ids.future));
  const snapshot=()=>page.evaluate(async id=>{const s=await import('/src/store.js'),db=await import('/src/lib/db.js');return JSON.stringify({session:s.getSession(id),snapshots:await db.getAll('sessionRosterSnapshots')});},ids.future);
  const snapshotBefore=await snapshot();
  await page.locator('[data-act=fill-present]').click();await expect(page.locator('.sheet')).toContainText('رصد الحضور قبل بدء الحصة؟');await expect(page.locator('.sheet')).toContainText('لم يبدأ وقت الحصة بعد. هل تريد تعليم الطلاب غير المرصودين حاضرين الآن؟');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});await safe(page,errors,cloud);await page.screenshot({path:info.outputPath(`confirmation-${width}.png`),fullPage:true});}
  await page.locator('.sheet [data-sheet-close]').first().click();expect(JSON.stringify(await records(page,ids.future))).toBe(before);expect(await snapshot()).toBe(snapshotBefore);
  await page.locator('[data-act=fill-present]').click();await page.getByRole('button',{name:'نعم، رصد الحضور',exact:true}).click();await expect(page.getByRole('status',{name:'حالة الرصد: مكتمل'})).toBeVisible();
  const after=await records(page,ids.future);expect(after.map(x=>x.status).sort()).toEqual(['absent','present']);expect(after.find(x=>x.status==='absent')).toEqual(JSON.parse(before)[0]);await page.reload();await expect(page.getByRole('status',{name:'حالة الرصد: مكتمل'})).toBeVisible();expect(await records(page,ids.future)).toEqual(after);await safe(page,errors,cloud);
});

test('N04 no-time and before/exact/after start preserve ordinary bulk availability',async({page})=>{
  const {ids,errors,cloud}=await setup(page);await page.goto(route(ids,'untimed'));await expect(page.locator('.attendance-prestart')).toHaveCount(0);await page.locator('[data-act=fill-present]').click();await expect(page.locator('.sheet')).toHaveCount(0);await expect(page.getByRole('status',{name:'حالة الرصد: مكتمل'})).toBeVisible();
  for(const [time,warn] of [['09:59:59',true],['10:00:00',false],['10:00:01',false]]){await page.clock.setFixedTime(new Date('2026-09-09T'+time+'+03:00'));await page.goto(route(ids,'future'));await page.reload();await expect(page.locator('.attendance-prestart')).toHaveCount(warn?1:0);}
  await page.locator('[data-act=fill-present]').click();await expect(page.locator('.sheet')).toHaveCount(0);await expect(page.getByRole('status',{name:'حالة الرصد: مكتمل'})).toBeVisible();await safe(page,errors,cloud);
});

test('N10 N11 responsive hierarchy, current review, same-day persistence and historical day change',async({page},info)=>{
  const {ids,errors,cloud}=await setup(page);const focus=page.locator('.today-focus');
  await expect(focus).toHaveAttribute('data-session-id',ids.current);await expect(focus).toContainText('الحصة 4');await expect(focus.locator('.today-focus__class')).toContainText(ids.subject);await expect(focus.locator('[data-time-token=start]')).toHaveText('09:00');await expect(focus.locator('[data-time-token=end]')).toHaveText('09:45');
  const row=kind=>page.locator(`.home-session-row[data-session-id="${ids[kind]}"]`);
  await expect(row('completed')).toHaveClass(/is-session-completed/);await expect(row('completed')).toContainText('تم رصد الحضور');await expect(row('pending')).toHaveClass(/is-session-pending/);await expect(row('future')).toHaveClass(/is-session-upcoming/);
  const periods=await page.locator('.home-session-row .period').allTextContents();expect(periods.map(Number)).toEqual([...periods.map(Number)].sort((a,b)=>a-b));
  for(const theme of ['light','dark'])for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await safe(page,errors,cloud);await page.screenshot({path:info.outputPath(`home-${width}-${theme}.png`),fullPage:true});}
  await row('completed').click();await expect(page.getByRole('status',{name:'حالة الرصد: مكتمل'})).toBeVisible();await page.goto(host+'/#/');await expect(row('completed')).toBeVisible();await page.reload();await expect(row('completed')).toBeVisible();
  await page.goto(route(ids,'current'));await page.locator('[data-act=fill-present]').click();await page.goto(host+'/#/');await expect(focus).toHaveAttribute('data-session-id',ids.current);await expect(focus.getByRole('link',{name:'مراجعة الحضور'})).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-09-09T09:46:00+03:00'));await page.reload();await expect(focus).toHaveAttribute('data-session-id',ids.pending);await expect(row('current')).toHaveClass(/is-session-completed/);
  const historical=await records(page,ids.completed);await page.clock.setFixedTime(new Date('2026-09-10T09:15:00+03:00'));await page.reload();await expect(page.locator(`[data-session-id="${ids.completed}"]`)).toHaveCount(0);expect(await records(page,ids.completed)).toEqual(historical);await safe(page,errors,cloud);
});
