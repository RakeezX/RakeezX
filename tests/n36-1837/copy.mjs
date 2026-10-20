// AI: copy-only inspection of actual extension HTML/CSS over owned loopback HTTP.
import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const root=process.cwd(),taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-one-start-complete-madrasati-20261019.json';
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1'),p=path.resolve(root,'.'+u.pathname);assert.ok(p.startsWith(root+path.sep));res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript'})[path.extname(p)]||'application/octet-stream');res.end(await fs.readFile(p));}catch{res.writeHead(404);res.end();}});
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/extensions/rakeez-teacher-import-helper/popup.html';
 await withIsolatedLocalBrowser({taskFile,runId:'60011041-25fb-4273-b30b-1405ce0b324e',url},async({createContext})=>{
  const c=await createContext({viewport:{width:500,height:850}}),p=await c.newPage();await p.goto(url);await p.locator('h1').waitFor();
  assert.equal(await p.locator('h1').innerText(),'استيراد بيانات المعلم والفصول');
  assert.match(await p.locator('.notice').innerText(),/اسم المعلم والمدير والمدرسة والجدول/);
  assert.doesNotMatch(await p.locator('#legacy-tools').innerText(),/لا يستورد بيانات المعلم/);
  assert.equal(await p.locator('a[href="https://rakeezx.com/"]').getAttribute('rel'),'noopener noreferrer');
  await p.screenshot({path:'tests/n36-1837/available-fields-copy.png',fullPage:true});
 });console.log('PASS actual HTTP popup copy/CSS; isolated owned browser/server cleanup');
}finally{await new Promise(r=>server.close(r));}
