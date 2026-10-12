import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { openReadyServedDemo, makeIsolatedDemoContext } from './helpers/served-demo-readiness.mjs';
const base=process.argv[2];
assert.ok(/^https:\/\/[0-9a-f]{8}\.rakeezx\.pages\.dev\/?$/.test(base),'Exact immutable HTTPS application Preview required');
const artifact='test-results/n73-browser';await mkdir(artifact,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try {
  for(const width of [390,1280]) {
    const context=await makeIsolatedDemoContext(browser,{width,height:844});
    try {
      const page=await context.newPage();await openReadyServedDemo(page,base);
      const ids=await page.evaluate(async()=>{
        const s=await import('/src/store.js'),db=await import('/src/lib/db.js'),m=await import('/src/models.js');
        const term=s.activeTerm(),subject=s.state.subjects.find(r=>!r.deleted);const stamp=Date.now();
        const sections=[1,2,10,11].map(n=>m.makeSection({id:'demo:n73:s'+n,yearId:term.yearId,grade:4,label:String(n),name:'N73 '+n}));
        const teachings=sections.map((sec,index)=>m.makeTeaching({id:'demo:n73:t'+[1,2,10,11][index],sectionId:sec.id,termId:term.id,subjectId:subject.id}));
        const students=[1,2].map(n=>m.makeStudent({id:'demo:n73:student'+n,name:'N73 synthetic '+n}));
        const items=[m.makeItem({id:'demo:n73:source',teachingId:teachings[0].id,name:'Exam',max:20,order:0}),
          m.makeItem({id:'demo:n73:target',teachingId:teachings[1].id,name:'Exam',max:25,order:0}),
          m.makeItem({id:'demo:n73:extra',teachingId:teachings[1].id,name:'Extra',max:5,order:2}),
          m.makeItem({id:'demo:n73:sourceSub',teachingId:teachings[0].id,name:'Parts',max:10,order:1,scoreMode:'subitems',distributionMode:'manual'}),
          m.makeItem({id:'demo:n73:targetSub',teachingId:teachings[1].id,name:'Parts',max:10,order:1,scoreMode:'subitems',distributionMode:'manual'})];
        const subs=[m.makeScoreSubitem({id:'demo:n73:sd',itemId:'demo:n73:sourceSub',name:'Part',value:5,order:0}),
          m.makeScoreSubitem({id:'demo:n73:td',itemId:'demo:n73:targetSub',name:'Part',value:5,order:0})];
        const scores=[{id:'demo:n73:sourceScore',studentId:students[0].id,itemId:items[0].id,value:19,updatedAt:stamp},
          {id:'demo:n73:capScore',studentId:students[0].id,itemId:items[1].id,value:23,updatedAt:stamp},
          {id:'demo:n73:validScore',studentId:students[1].id,itemId:items[1].id,value:18,updatedAt:stamp},
          {id:'demo:n73:extraScore',studentId:students[0].id,itemId:items[2].id,value:4,updatedAt:stamp},
          {id:'demo:n73:subScore',studentId:students[0].id,itemId:items[4].id,value:7,manualValue:2,derivedValue:5,updatedAt:stamp}];
        const completions=[{id:'demo:n73:completion',studentId:students[0].id,subitemId:subs[1].id,checked:true,updatedAt:stamp}];
        for(const [name,rows] of Object.entries({sections,teachings,students,items,scoreSubitems:subs,scores,scoreSubitemCompletions:completions})) await db.putMany(name,rows);
        await s.refreshSyncedState();return {source:teachings[0].id,target:teachings[1].id};
      });
      await page.goto(base+'/#/teaching/'+ids.source+'/items');await page.locator('[data-act="copy"]').click();
      assert.equal(await page.locator('[data-copy-target]:checked').count(),0);
      assert.equal(await page.locator('[data-copy-apply]').isDisabled(),true);
      const targetOrder=await page.locator('[data-copy-target]').evaluateAll(rows=>rows.filter(r=>r.value.startsWith('demo:n73:')).map(r=>r.value));
      assert.deepEqual(targetOrder,['demo:n73:t2','demo:n73:t10','demo:n73:t11']);
      await page.locator('[data-copy-target][value="demo:n73:t2"]').check();
      await page.locator('[data-copy-target][value="demo:n73:t10"]').check();
      await page.locator('[data-copy-apply]').waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.querySelector('[data-copy-apply]').disabled);
      assert.equal(await page.locator('[data-copy-review] details').getAttribute('open'),null);
      await page.locator('[data-copy-review] summary').click();
      assert.equal(await page.locator('[data-copy-remove]:checked').count(),0);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false);
      await page.screenshot({path:artifact+'/'+width+'-review.png',fullPage:true});
      await page.locator('[data-copy-apply]').click();
      await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).click();
      await page.waitForFunction(async()=> (await (await import('/src/lib/db.js')).get('scores','demo:n73:capScore'))?.value===20);
      const outcome=await page.evaluate(async()=>{
        const db=await import('/src/lib/db.js');return {cap:(await db.get('scores','demo:n73:capScore')).value,
          valid:(await db.get('scores','demo:n73:validScore')).value,extra:(await db.get('scores','demo:n73:extraScore')).value,
          source:(await db.get('scores','demo:n73:sourceScore')).value,items:(await db.getAll('items')).filter(r=>r.teachingId==='demo:n73:t10')};
      });
      assert.equal(outcome.cap,20);assert.equal(outcome.valid,18);assert.equal(outcome.extra,4);assert.equal(outcome.source,19);assert.equal(outcome.items.length,2);
      await page.goto(base+'/#/teaching/'+ids.target+'/items');
      const parent=page.locator('[data-act="edit"][data-id="demo:n73:targetSub"]');assert.equal(await parent.count(),1);
      assert.equal(await page.locator('[data-act="configure"][data-id="demo:n73:targetSub"]').count(),1);
      const before=await page.evaluate(async()=>{
        const db=await import('/src/lib/db.js');return {subs:await db.getAll('scoreSubitems'),scores:await db.getAll('scores'),completions:await db.getAll('scoreSubitemCompletions')};
      });
      await parent.click();assert.equal(await page.locator('#edit-item [name="max"]').getAttribute('readonly'),'');
      await page.locator('#edit-item [name="name"]').fill('Renamed Parts');
      await page.getByRole('button',{name:'حفظ',exact:true}).click();
      await page.waitForFunction(async()=> (await (await import('/src/lib/db.js')).get('items','demo:n73:targetSub'))?.name==='Renamed Parts');
      const after=await page.evaluate(async()=>{const db=await import('/src/lib/db.js');return {subs:await db.getAll('scoreSubitems'),scores:await db.getAll('scores'),completions:await db.getAll('scoreSubitemCompletions')};});
      assert.deepEqual(after,before);
      await page.goto(base+'/#/teaching/'+ids.source+'/items');await page.locator('[data-act="copy"]').click();
      assert.equal(await page.locator('[data-copy-target]:checked').count(),0);
      await page.locator('[data-copy-target][value="demo:n73:t2"]').check();
      await page.waitForFunction(()=>!document.querySelector('[data-copy-apply]').disabled);
      await page.locator('[data-copy-review] summary').click();
      assert.equal(await page.locator('[data-copy-remove]:checked').count(),0);
      await page.locator('[data-copy-remove][value="demo:n73:extra"]').check();
      await page.locator('[data-copy-apply]').click();
      assert.equal(await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).count(),1);
      await page.getByRole('button',{name:'تأكيد التطبيق',exact:true}).click();
      await page.waitForFunction(async()=> (await (await import('/src/lib/db.js')).get('items','demo:n73:extra'))?.deleted===true);
      assert.equal(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).get('scores','demo:n73:extraScore')).deleted),true);
      checks.push({name:'rendered_'+width,status:'PASS',evidence:'Fresh Demo actual HTTPS DOM/handlers/source CSS: natural order; no default targets/removals; collapsed review; persisted 23→20, valid18/extra4/source19; missing parents; separate metadata-only subitem-parent rename.'});
    } finally {await context.close();}
  }
} finally {await browser.close();await writeFile(artifact+'/result.json',JSON.stringify({base,candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),harnessHash:createHash('sha256').update(await (await import('node:fs/promises')).readFile(new URL(import.meta.url))).digest('hex'),checks},null,2));}
