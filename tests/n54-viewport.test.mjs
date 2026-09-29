import {test} from 'node:test';
import assert from 'node:assert/strict';

let sequence=0;
async function environment({scale=1,height=430,top=80,sheet=true,fieldTop=650,fieldHeight=50,viewport=true}={}) {
  const previous=Object.fromEntries(['window','document','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const listeners={},frames=new Map(),css={},attributes=new Set();let id=0,resizeCallback,observed;
  const owner={scrollTop:0,scrollHeight:1600,clientHeight:350,parentElement:null,bottom:430,getBoundingClientRect:()=>({top:80,bottom:owner.bottom})};
  const field={parentElement:owner,matches:()=>true,closest:selector=>selector==='.main'?null:selector==='.sheet__body'?(sheet?owner:null):sheet?owner:null,getBoundingClientRect:()=>({top:fieldTop-owner.scrollTop,bottom:fieldTop+fieldHeight-owner.scrollTop,height:fieldHeight})};
  const vv={scale,height,offsetTop:top,addEventListener:(name,fn)=>listeners['vv:'+name]=fn};
  globalThis.window={innerHeight:844,innerWidth:390,visualViewport:viewport?vv:null,ResizeObserver:class {constructor(fn){resizeCallback=fn;}observe(node){observed=node;}disconnect(){observed=null;}},addEventListener:(name,fn)=>listeners['window:'+name]=fn};
  globalThis.document={activeElement:field,scrollingElement:{scrollTop:0},documentElement:{style:{setProperty:(key,value)=>css[key]=value},toggleAttribute:(key,on)=>on?attributes.add(key):attributes.delete(key)},addEventListener:(name,fn)=>listeners[name]=fn};
  globalThis.getComputedStyle=()=>({overflowY:'auto'});
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const {installVisibleViewport}=await import(`../src/lib/visible-viewport.js?test=${++sequence}`);installVisibleViewport();
  const flush=()=>{for(let i=0;frames.size&&i<5;i++){const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());}assert.equal(frames.size,0,'bounded frames, no reveal loop');};
  const step=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());};
  const close=()=>Object.entries(previous).forEach(([key,desc])=>desc?Object.defineProperty(globalThis,key,desc):delete globalThis[key]);
  return {vv,owner,field,css,attributes,listeners,flush,step,close,resize:()=>resizeCallback(),observed:()=>observed};
}
for(const scale of [1,1.10,1.25])test(`N54 visible CSS geometry and focus at scale ${scale}`,async()=>{
  const e=await environment({scale});try{e.listeners.focusin();e.flush();assert.equal(e.css['--visible-viewport-height'],'430px');assert.equal(e.css['--visible-viewport-top'],'80px');assert(e.owner.scrollTop>0);assert(e.field.getBoundingClientRect().bottom<=418);}finally{e.close();}
});
test('N54 scroll/pan changes geometry without fighting user scroll',async()=>{
  const e=await environment({scale:1.25});try{e.flush();e.owner.scrollTop=25;e.vv.offsetTop=100;e.listeners['vv:scroll']();e.flush();assert.equal(e.css['--visible-viewport-top'],'100px');assert.equal(e.owner.scrollTop,25);}finally{e.close();}
});
test('N54 resize-induced scroll between layout and reveal cannot lose correction',async()=>{
  const e=await environment({scale:1.25});try{e.listeners.focusin();e.step();e.listeners['vv:scroll']();e.flush();assert(e.owner.scrollTop>0);assert(e.field.getBoundingClientRect().bottom<=418);}finally{e.close();}
});
test('N54 focused body settling after a viewport frame remains exposed without a loop',async()=>{
  const e=await environment({fieldTop:300});try{e.listeners.focusin();e.flush();assert.equal(e.observed(),e.owner);assert.equal(e.owner.scrollTop,0);e.owner.bottom=300;e.resize();e.flush();assert(e.field.getBoundingClientRect().bottom<=288);const scroll=e.owner.scrollTop;e.resize();e.flush();assert.equal(e.owner.scrollTop,scroll);document.activeElement=null;e.listeners.focusin();e.flush();assert.equal(e.observed(),null);}finally{e.close();}
});
test('N54 ordinary nearest scroll owner, no move when already visible',async()=>{
  const e=await environment({sheet:false});try{e.listeners.focusin();e.flush();const scroll=e.owner.scrollTop;assert(scroll>0);e.listeners.focusin();e.flush();assert.equal(e.owner.scrollTop,scroll);}finally{e.close();}
});
test('N54 tall textarea reveal does not oscillate',async()=>{
  const e=await environment({fieldHeight:500});try{e.listeners.focusin();e.flush();const scroll=e.owner.scrollTop;assert.equal(e.field.getBoundingClientRect().top,92);e.listeners.focusin();e.flush();assert.equal(e.owner.scrollTop,scroll);}finally{e.close();}
});
test('N54 restoration and coalesced events use latest geometry',async()=>{
  const e=await environment();try{e.listeners.focusin();e.vv.height=844;e.vv.offsetTop=0;e.listeners['vv:resize']();e.flush();assert.equal(e.css['--visible-viewport-height'],'844px');assert.equal(e.css['--visible-viewport-top'],'0px');assert(!e.attributes.has('data-viewport-compressed'));}finally{e.close();}
});
test('N54 absence of VisualViewport keeps layout fallback',async()=>{
  const e=await environment({viewport:false});try{e.flush();assert.equal(e.css['--visible-viewport-height'],'844px');assert.equal(e.css['--visible-viewport-top'],'0px');}finally{e.close();}
});
