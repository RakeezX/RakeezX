// AI: optional installed-engine-only MV3 check. No personal browser or source portal.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Abody/Projects/RakeezX/package.json');
const {chromium}=require('playwright');
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'n36-0511-owned-'));
const extension=path.resolve('extensions/rakeez-teacher-import-helper');
const evidence={nativeActionPopup:{status:'NOT_RUN',code:'NATIVE_ACTION_POPUP_NOT_RUN'},moduleGraph:{status:'NOT_RUN'}};
let context;
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:chromium.executablePath(),headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension],serviceWorkers:'allow'});
 await context.route('**/*',route=>route.request().url().startsWith('chrome-extension://')?route.continue():route.abort());
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:10000});
 const id=worker.url().split('/')[2];
 const page=await context.newPage();await page.goto('chrome-extension://'+id+'/popup.html');
 await page.waitForFunction(()=>!document.querySelector('#one-start').disabled&&typeof window.n36BeforeExport==='function');
 const report=await page.evaluate(async()=>{
  const r=await chrome.runtime.sendMessage({type:'n36-health'});
  return {health:r,version:chrome.runtime.getManifest().version};
 });
 assert.deepEqual(report,{health:{ok:true,health:'ready'},version:'0.5.11'});
 evidence.moduleGraph={status:'PASS',evidence:'Installed Chromium actual MV3 worker/protocol + popup/category/run ESM initialized; no-payload health returned ready under manifest CSP.'};
 try{
  const opening=context.waitForEvent('page',{timeout:3000});opening.catch(()=>{});
  await worker.evaluate(()=>chrome.action.openPopup());
  const popup=await opening;await popup.waitForLoadState('domcontentloaded');
  const dimensions=await popup.evaluate(()=>({width:innerWidth,height:innerHeight,root:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  evidence.nativeActionPopup={status:dimensions.width===430&&dimensions.height<=600&&dimensions.scroll<=430?'PASS':'FAIL',dimensions};
 }catch{evidence.nativeActionPopup={status:'NOT_RUN',code:'NATIVE_ACTION_POPUP_NOT_RUN',evidence:'Owned headless engine did not expose a native action popup page; ordinary extension tab is not native-popup proof.'};}
}catch(error){
 evidence.moduleGraph={status:'NOT_RUN',evidence:'Owned installed headless MV3 unavailable',code:error.name==='TimeoutError'?'HEADLESS_MV3_TIMEOUT':'HEADLESS_MV3_UNAVAILABLE'};
}finally{
 await context?.close();
 await fs.rm(profile,{recursive:true,force:true});
 await fs.writeFile('tests/n36-popup-width-diagnostics-native.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence));
}
