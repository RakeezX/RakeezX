import { test, expect } from '@playwright/test';
import { createCloud, authenticated } from './helpers/remote-sync-browser.mjs';

async function clients(browser) {
  const cloud=createCloud(), aContext=await browser.newContext(), bContext=await browser.newContext();
  const a=await aContext.newPage(),b=await bContext.newPage();
  await authenticated(a,cloud);await authenticated(b,cloud);
  await a.goto('/#/settings');await b.goto('/#/settings');
  for(const p of [a,b]) await p.waitForFunction(()=>window.__syncModule?.displayState().status==='synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending
    && window.__remoteSockets?.some(s=>!s.closed));
  for(const p of [a,b]) {
    await p.evaluate(async()=>{ await window.__syncModule.syncAll({full:true});
      window.__remoteProjectionEvents=[];window.__remoteSyncEvents=[];
      window.store.subscribe(()=>window.__remoteProjectionEvents.push({at:Date.now(),teacher:window.store.state.profile.teacherName}));
      window.__syncModule.subscribe(()=>window.__remoteSyncEvents.push({at:Date.now(),status:window.__syncModule.displayState().status})); });
    await p.waitForFunction(()=>window.__syncModule.displayState().status==='synced'
      && !window.__syncModule.getRemoteSyncDiagnostics().pending);
  }
  const errors=[];for(const p of [a,b]) {
    p.on('pageerror',e=>errors.push(e.message));
    p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  }
  return {a,b,cloud,errors,close:async()=>{await aContext.close();await bContext.close();}};
}

test('shared browser workspace keeps local BroadcastChannel fast and one remote receiver',async({browser},info)=>{
  const f=await clients(browser);
  try {
    const tab=await f.a.context().newPage();await f.cloud.route(tab);await tab.goto('/#/settings');
    await tab.waitForFunction(()=>window.__syncModule?.displayState().status==='synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending);
    expect(await tab.evaluate(()=>window.__remoteSockets.filter(s=>!s.closed).length)).toBe(0);
    const start=Date.now();await f.a.evaluate(()=>window.store.patchProfile({teacherName:'Same browser tab'}));
    await expect(tab.locator('input[name="teacherName"]')).toHaveValue('Same browser tab');
    const localMs=Date.now()-start;
    expect(f.cloud.profile().teacher_name).not.toBe('Same browser tab');
    await info.attach('same-browser-propagation',{body:JSON.stringify({localMs,receivers:1}),contentType:'application/json'});
    await f.a.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tab.waitForFunction(()=>window.__remoteSockets.some(s=>!s.closed));
    expect(await f.a.evaluate(()=>window.__remoteSockets.filter(s=>!s.closed).length)).toBe(0);
    await tab.close();expect(f.errors).toEqual([]);
  }finally{await f.close();}
});
for(const scenario of ['profile','burst','different-fields','later-write','active','reconnect','missed-event','foreground']) {
  test(`private invalidation: isolated clients ${scenario}`,async({browser},info)=>{
    const f=await clients(browser);
    try {
      const before=f.cloud.requests().length,signalBefore=f.cloud.signals().length;
      let gate;
      if(scenario==='active') {
        gate=f.cloud.holdNextTableRead('years');
        await f.b.evaluate(()=>{void window.__syncModule.syncAll({full:true});});
        await gate.started;
      }
      if(scenario==='reconnect') await f.b.context().setOffline(true);
      if(scenario==='missed-event') await f.b.evaluate(()=>{
        // Simulate a disconnected wire without delivering its close callback yet.
        for(const s of window.__remoteSockets)s.closed=true;
      });
      if(scenario==='foreground') await f.b.evaluate(()=>{
        Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const durableStart=Date.now();
      if(scenario==='profile') {
        await f.a.locator('input[name="teacherName"]').fill('Remote profile');
        await f.a.locator('input[name="teacherName"]').press('Tab');
        await f.a.waitForFunction(()=>window.store.state.profile.teacherName==='Remote profile');
      } else await f.a.evaluate(async({scenario})=>{
        if(scenario==='burst') {
          for(let i=0;i<8;i++)await window.store.patchProfile({teacherName:`Burst ${i}`});
        } else await window.store.patchProfile({teacherName:`Remote ${scenario}`});
      },{scenario});
      const durableEnd=Date.now();
      await expect.poll(()=>f.cloud.profile().teacher_name).toBe(scenario==='burst'?'Burst 7':`Remote ${scenario}`);
      gate?.release();
      if(scenario==='reconnect') await f.b.context().setOffline(false);
      if(scenario==='foreground') await f.b.evaluate(()=>{
        Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      if(scenario==='missed-event') await f.b.evaluate(()=>{
        for(const s of window.__remoteSockets)s.onclose?.();
      });
      await f.b.waitForFunction(expected=>window.store.state.profile.teacherName===expected
        && window.__syncModule.displayState().status==='synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending,scenario==='burst'?'Burst 7':`Remote ${scenario}`);
      if(scenario==='different-fields') {
        await f.b.evaluate(()=>window.store.patchProfile({schoolName:'Independent school'}));
        await f.a.waitForFunction(()=>window.store.state.profile.schoolName==='Independent school');
        expect(await f.a.evaluate(()=>window.store.state.profile.teacherName)).toBe('Remote different-fields');
      }
      if(scenario==='later-write') {
        await f.b.evaluate(()=>window.store.patchProfile({teacherName:'Later B'}));
        await f.a.waitForFunction(()=>window.store.state.profile.teacherName==='Later B');
      }
      await expect(f.b.locator('input[name="teacherName"]')).toHaveValue(scenario==='later-write'?'Later B':scenario==='burst'?'Burst 7':`Remote ${scenario}`);
      const calls=f.cloud.requests().slice(before),signals=f.cloud.signals().slice(signalBefore);
      if(scenario==='profile'||scenario==='burst') {
        expect(calls.filter(c=>c.client===1&&c.method==='GET')).toHaveLength(48);
      }
      await info.attach('synthetic-timing-and-load',{body:JSON.stringify({scenario,durableStart,durableEnd,
        observedAt:Date.now(),calls,signals,bSignals:await f.b.evaluate(()=>window.__remoteSignalTimes),
        aSync:await f.a.evaluate(()=>window.__remoteSyncEvents),
        bProjection:await f.b.evaluate(()=>window.__remoteProjectionEvents),
        bSync:await f.b.evaluate(()=>window.__remoteSyncEvents)}),contentType:'application/json'});
      expect(f.cloud.maxWritesPerClient()).toBe(1);expect(f.errors).toEqual([]);
    }finally{await f.close();}
  });
}

test('one burst wakes two isolated receiving devices without one full pass per mutation',async({browser},info)=>{
  const f=await clients(browser),context=await browser.newContext(),c=await context.newPage();
  try {
    await authenticated(c,f.cloud);await c.goto('/#/settings');
    await c.waitForFunction(()=>window.__syncModule?.displayState().status==='synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending&&window.__remoteSockets.some(s=>!s.closed));
    await c.evaluate(()=>window.__syncModule.syncAll({full:true}));
    await c.waitForFunction(()=>window.__syncModule.displayState().status==='synced'
      && !window.__syncModule.getRemoteSyncDiagnostics().pending);
    const before=f.cloud.requests().length,signalBefore=f.cloud.signals().length;
    await f.a.evaluate(async()=>{for(let i=0;i<8;i++)await window.store.patchProfile({teacherName:`Two receivers ${i}`});});
    for(const page of [f.b,c])await page.waitForFunction(()=>window.store.state.profile.teacherName==='Two receivers 7'
      &&window.__syncModule.displayState().status==='synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending);
    const calls=f.cloud.requests().slice(before),signals=f.cloud.signals().slice(signalBefore);
    for(const client of [1,2])expect(calls.filter(r=>r.client===client&&r.method==='GET')).toHaveLength(48);
    expect(signals).toHaveLength(8);expect(f.cloud.maxWritesPerClient()).toBe(1);
    await info.attach('two-receiver-load',{body:JSON.stringify({calls,signals}),contentType:'application/json'});
  }finally{await context.close();await f.close();}
});

for(const entity of ['students','scores','attendance','tombstone']) {
  test(`private invalidation: isolated clients ${entity}`,async({browser},info)=>{
    const f=await clients(browser);
    try {
      const stamp=Date.now()-10000;
      const fixture={students:[{id:'remote-student',name:'Synthetic',status:'active',note:'',serverRevision:1,updatedAt:stamp}],
        items:[{id:'remote-item',name:'Synthetic',max:10,scoreMode:'direct',serverRevision:1,updatedAt:stamp}],
        sessions:[{id:'remote-session',date:'2026-09-26',period:1,status:'held',serverRevision:1,updatedAt:stamp}]};
      for(const [store,rows] of Object.entries(fixture))for(const row of rows)f.cloud.seed(store,{
        id:row.id,name:row.name,status:row.status,max:row.max,date:row.date,period:row.period,
        score_mode:row.scoreMode,revision:1,client_updated_at:stamp,deleted_at:null,field_revisions:{}});
      for(const p of [f.a,f.b])await p.evaluate(data=>window.store.save(data,{queue:false,notify:false}),fixture);
      const before=f.cloud.requests().length,signalBefore=f.cloud.signals().length;
      const durableStart=Date.now();
      await f.a.evaluate(async entity=>{
        if(entity==='students')await window.store.patch('students','remote-student',{name:'Remote synthetic'});
        if(entity==='tombstone')await window.store.patch('students','remote-student',{deleted:true});
        if(entity==='scores')await window.store.save({scores:[{id:'remote-score',studentId:'remote-student',itemId:'remote-item',value:8,updatedAt:Date.now()}]});
        if(entity==='attendance')await window.store.save({attendance:[{id:'remote-att',studentId:'remote-student',sessionId:'remote-session',date:'2026-09-26',status:'present',updatedAt:Date.now()}]});
      },entity);
      const durableEnd=Date.now();
      await f.b.waitForFunction(entity=>{
        const s=window.store.state;
        return entity==='students'?s.students.some(r=>r.name==='Remote synthetic'):
          entity==='tombstone'?s.students.some(r=>r.id==='remote-student'&&r.deleted):
          entity==='scores'?s.scores.some(r=>r.id==='remote-score'&&r.value===8):s.attendance.some(r=>r.id==='remote-att'&&r.status==='present');
      },entity);
      await f.b.waitForFunction(()=>window.__syncModule.displayState().status==='synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending);
      const deliveryObservedAt=Date.now(), deliveryCalls=f.cloud.requests().slice(before);
      const deliveryEvents={bSignals:await f.b.evaluate(()=>window.__remoteSignalTimes),
        aSync:await f.a.evaluate(()=>window.__remoteSyncEvents),
        bProjection:await f.b.evaluate(()=>window.__remoteProjectionEvents),
        bSync:await f.b.evaluate(()=>window.__remoteSyncEvents)};
      if(entity==='tombstone') {
        await f.b.reload();await f.b.waitForFunction(()=>window.store?.state.students.some(r=>r.id==='remote-student'&&r.deleted));
      }
      await info.attach('synthetic-timing-and-load',{body:JSON.stringify({scenario:entity,durableStart,durableEnd,observedAt:Date.now(),
        deliveryObservedAt,calls:deliveryCalls,signals:f.cloud.signals().slice(signalBefore),...deliveryEvents}),contentType:'application/json'});
      expect(f.cloud.maxWritesPerClient()).toBe(1);expect(f.errors).toEqual([]);
    }finally{await f.close();}
  });
}
