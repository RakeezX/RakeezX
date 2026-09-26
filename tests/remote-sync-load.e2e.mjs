import { test, expect } from '@playwright/test';
import { createCloud, authenticated } from './helpers/remote-sync-browser.mjs';

test('manual full pass consumes a cancelled scheduled full request; next local edit remains targeted',async({browser})=>{
  const cloud=createCloud(),context=await browser.newContext();
  try {
    const page=await context.newPage();await authenticated(page,cloud);await page.goto('/#/settings');
    const settle=()=>page.waitForFunction(()=>window.__syncModule?.displayState().status==='synced'
      &&!window.__syncModule.getRemoteSyncDiagnostics().pending);
    await settle();
    const gate=cloud.holdNextTableRead('years');
    const first=page.evaluate(()=>window.__syncModule.syncAll({full:true}));await gate.started;
    expect(await page.evaluate(()=>window.__syncModule.syncAll({full:true}))).toBe(false);
    gate.release();await first;
    expect(await page.evaluate(()=>window.__syncModule.syncAll({full:true}))).toBe(true);
    await settle();const before=cloud.requests().length;
    await page.evaluate(()=>window.store.patchProfile({teacherName:'Targeted after manual'}));
    await expect.poll(()=>cloud.profile().teacher_name).toBe('Targeted after manual');
    const requests=cloud.requests().slice(before);
    const push=requests.findIndex(r=>r.table==='apply_sync_v2_mutation');
    expect(push).toBeGreaterThan(0);
    expect(requests.slice(0,push).filter(r=>r.method==='GET').map(r=>r.table)).toEqual(['profile']);
    await settle();
  }finally{await context.close();}
});

test('three separated eight-edit bursts each require only one receiver full pass',async({browser},info)=>{
  const cloud=createCloud(),aContext=await browser.newContext(),bContext=await browser.newContext();
  try {
    const a=await aContext.newPage(),b=await bContext.newPage();
    await authenticated(a,cloud);await authenticated(b,cloud);
    await a.goto('/#/settings');await b.goto('/#/settings');
    const settle=page=>page.waitForFunction(()=>window.__syncModule?.displayState().status==='synced'
      &&!window.__syncModule.getRemoteSyncDiagnostics().pending&&window.__remoteSockets.some(s=>!s.closed));
    await settle(a);await settle(b);
    const samples=[];
    for(let burst=0;burst<3;burst++) {
      const before=cloud.requests().length,signalBefore=cloud.signals().length;
      await a.evaluate(async burst=>{for(let i=0;i<8;i++)await window.store.patchProfile({teacherName:`Repeated ${burst}:${i}`});},burst);
      await b.waitForFunction(expected=>window.store.state.profile.teacherName===expected,`Repeated ${burst}:7`);
      await settle(a);await settle(b);
      const requests=cloud.requests().slice(before),signals=cloud.signals().slice(signalBefore);
      expect(requests.filter(r=>r.client===1&&r.method==='GET')).toHaveLength(24);
      expect(requests.filter(r=>r.client===0&&r.method==='GET')).toHaveLength(25);
      expect(requests.filter(r=>r.client===0&&r.table==='profile'&&r.method==='GET')).toHaveLength(2);
      expect(signals).toHaveLength(8);
      samples.push({burst,requests,signals});
    }
    await info.attach('repeated-bursts',{body:JSON.stringify(samples),contentType:'application/json'});
    expect(cloud.maxWritesPerClient()).toBe(1);
  }finally{await aContext.close();await bContext.close();}
});
