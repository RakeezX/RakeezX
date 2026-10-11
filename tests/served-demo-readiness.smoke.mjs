import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { openReadyServedDemo, makeIsolatedDemoContext } from './helpers/served-demo-readiness.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const ctx=await makeIsolatedDemoContext(browser);
 const page=await ctx.newPage();
 const result=await openReadyServedDemo(page,'https://rakeezx.com/');
 assert.equal(result.workspace,'demo');
 assert.equal(result.ready,true);
 assert.ok(result.teachings>0 && result.students>0);
 console.log('PASS served Chrome Demo readiness',JSON.stringify(result));
 await ctx.close();
}finally{await browser.close();}
