import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { makeIsolatedDemoContext, openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const require=createRequire(import.meta.url);
const base=process.env.N86_PREVIEW_URL || 'http://127.0.0.1:5187/';
let server, browser;
try {
 if (!process.env.N86_PREVIEW_URL) {
   const vite=join(dirname(require.resolve('vite/package.json')),'bin/vite.js');
   server=spawn(process.execPath,[vite,'--host','127.0.0.1','--port','5187','--strictPort'],{stdio:'pipe'});
   server.stderr.on('data',b=>process.stderr.write(b));
   let online=false;
   for(let i=0;i<100;i++){
     try{if((await fetch(base)).ok){online=true;break}}catch{}
     await new Promise(r=>setTimeout(r,100));
   }
   assert.equal(online,true,'owned Vite server ready');
 }
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await makeIsolatedDemoContext(browser,{width:390,height:850});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await openReadyServedDemo(page,base);
 await page.evaluate(async()=>{
   const store=await import('/src/store.js'),{repaint}=await import('/src/repaint.js'),{todayISO}=await import('/src/models.js');
   const date=new Date(todayISO()+'T12:00:00Z');
   const daysBefore=(count)=>{const d=new Date(date);d.setUTCDate(date.getUTCDate()-count);return d.toISOString().slice(0,10)};
   const makeLogs=(teachingId,studentId,values)=>values.map((delta,i)=>({
     id:teachingId+':'+i,teachingId,studentId,kind:'participation',delta,
     date:daysBefore(values.length-i-1),deleted:false
   }));
   Object.assign(store.state,{
     years:[{id:'n86:y',label:'1448-1449',status:'active'}],
     terms:[{id:'n86:tm',yearId:'n86:y',name:'الفصل الدراسي الأول',status:'active'}],
     subjects:[{id:'n86:ds',name:'المهارات الرقمية'}],
     sections:['a','b','c','d','e','f','g','h','i'].map((id,i)=>({id,grade:5,name:'خامس / '+(i+1),yearId:'n86:y',status:'active'})),
     teachings:['a','b','c','d','e','f','g','h','i'].map(id=>({id,sectionId:id,subjectId:'n86:ds',termId:'n86:tm'})),
     students:[
       {id:'a',name:'طالب تجريبي أول',status:'active'},
       {id:'b',name:'طالب تجريبي باسم أطول قليلًا للتحقق من ثبات البطاقات',status:'active'},
       {id:'c',name:'طالب تجريبي ثالث',status:'active'}
     ],
     enrollments:['a','b','c'].map(id=>({id,studentId:id,sectionId:id,status:'active',rollNo:1})),
     logs:[
       ...makeLogs('a','a',[1,1,1,8]),
       ...makeLogs('b','b',[7]),
       ...makeLogs('c','c',[1,1,1,3]),
     ],
   });
   store.state.device.activeYearId='n86:y';
   store.state.device.activeTermId='n86:tm';
   location.hash='#/teaching/a/board';
   repaint();
 });
 await page.locator('.board__podium-card').first().waitFor({timeout:15000});
 await page.locator('[data-audience="grade"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.board__podium-card').length===3);
 const expected=['المركز الأول','المركز الثاني','المركز الثالث'];
 for(const viewport of [320,390,768,1280]){
   await page.setViewportSize({width:viewport,height:900});
   const title=await page.evaluate(()=>{
     const line=document.querySelector('.board-context--grade');
     const note=document.querySelector('.board-context-note');
     const rect=line.getBoundingClientRect(), sub=note.getBoundingClientRect();
     return {text:line.textContent.trim(),space:getComputedStyle(line).whiteSpace,
       scroll:line.scrollWidth,client:line.clientWidth,
       noteBelow:sub.top>=rect.bottom-1, noteText:note.textContent.trim()};
   });
   assert.equal(title.text,'الخامس الابتدائي · المهارات الرقمية · 9 فصول');
   assert.equal(title.space,'nowrap','summary must remain a single line');
   assert.ok(title.scroll<=title.client+1,'summary must fit '+viewport+'px: '+JSON.stringify(title));
   assert.equal(title.noteBelow,true,'note should be directly below summary');
   assert.equal(title.noteText,'من الرصد السريع · تختلف فرص المشاركة بين الفصول');
   const details=await page.locator('.board__podium-card').evaluateAll(cards=>cards.map(card=>{
     const rect=card.getBoundingClientRect();
     const place=card.querySelector('.board__podium-place');
     const badges=card.querySelector('.board__badges');
     return {label:place?.textContent.trim(),height:rect.height,width:rect.width,left:rect.left,right:rect.right,
       badgeText:badges?.textContent.trim(),badgeHeight:badges?.getBoundingClientRect().height||0,
       placeOverflow:place?place.scrollWidth>place.clientWidth+1:false,
       cardOverflow:card.scrollWidth>card.clientWidth+1};
   }));
   assert.deepEqual(details.map(x=>x.label),expected);
   assert.ok(details[0].badgeText && !details[1].badgeText && details[2].badgeText,
     'first and third are badged, the second unbadged');
   assert.ok(Math.max(...details.map(x=>x.height))-Math.min(...details.map(x=>x.height))<=1.1,
     'unequal card heights '+viewport+': '+JSON.stringify(details));
   assert.ok(details.every(x=>x.badgeHeight>=26),'badge slot must be preserved');
   assert.ok(details.every(x=>!x.placeOverflow&&!x.cardOverflow),'card content must fit '+viewport);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
     'whole-page horizontal overflow '+viewport);
   console.log(JSON.stringify({viewport,heights:details.map(x=>Math.round(x.height)),labels:details.map(x=>x.label),badgeSlots:details.map(x=>Math.round(x.badgeHeight)),result:'PASS'}));
 }
 assert.deepEqual(errors,[],'page JS errors');
 await context.close();
}finally{
 await browser?.close();
 if(server && server.exitCode===null){
   server.kill();
   await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,4500).unref()});
 }
}
