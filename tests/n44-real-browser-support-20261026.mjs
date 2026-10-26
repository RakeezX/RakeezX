import { chromium, firefox, webkit } from '@playwright/test';
import http from 'node:http';
const server = http.createServer((_req,res)=>{ res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><button id="btn">Test activation</button><script>window.n44Activation = null;document.querySelector("button").addEventListener("click",()=>{window.n44Activation={active:navigator.userActivation?.isActive??null,hasAPI:typeof navigator.userActivation!=="undefined",Notification:typeof Notification,PushManager:typeof PushManager,serviceWorker:!!navigator.serviceWorker};});</script></body></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
let failures=0;
try {
 for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
   let browser;
   try{
    browser=await engine.launch({headless:true,timeout:20000});
    const page=await browser.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('#btn').click();
    const result=await page.evaluate(()=>window.n44Activation);
    process.stdout.write(JSON.stringify({name,...result})+'\n');
    if(result.active!==true)failures++;
   }catch(error){process.stdout.write(JSON.stringify({name,error:error.message?.slice(0,350)})+'\n');failures++}
   finally{await browser?.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
process.exitCode=failures?1:0;
