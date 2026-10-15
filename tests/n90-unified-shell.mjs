import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n90-unified-import-service-and-release-20261015.json';
const token='ad0be3b3-c522-4fd7-8602-490ff96ae930',script='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File',script,'-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',token,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true});
const root=resolve('.'),output='test-results/n90-unified-shell',checks=[];let browser,ownedLease=false;
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname,file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));if(!file.startsWith(root+sep))throw Error('Outside root');res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
try {
 console.log(lease('acquire'));ownedLease=true;await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const require=createRequire('C:/Users/Abody/Projects/RakeezX/package.json');browser=await require('playwright').chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 await context.addInitScript(()=>{if(!sessionStorage.getItem('rakeezx-demo-session-v1'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
 const page=await context.newPage();await openReadyServedDemo(page,base);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 const version=(await readFile('sw.js','utf8')).match(/const VERSION = '(rakeezx-v\d+)'/)[1];
 await page.waitForFunction(async version=>{const c=await caches.open(version);return !!navigator.serviceWorker.controller&&(await Promise.all(['./src/views/students.js','./src/views/teaching-hub.js','./src/lib/student-import.js','./src/lib/grade-transfer.js','./src/lib/grade-transfer-export.js'].map(p=>c.match(new URL(p,location.origin).href)))).every(Boolean);},version);
 await context.setOffline(true);await page.reload();
 await page.evaluate(async()=>{window.n90ShellStore=await import('/src/store.js');});
 const checkpointHandle=await page.waitForFunction(()=>{const s=window.n90ShellStore,workspace=s.getActiveWorkspace(),teaching=s.teachings()[0];if(!s.state.ready||workspace?.databaseName!=='rakeezx-demo'||!teaching||!s.state.students.length||document.querySelector('.boot'))return false;return {ready:s.state.ready,workspace,teachingId:teaching.id,termId:s.activeTerm()?.id,roster:s.teachingContext(teaching.id).roster.map(r=>({id:r.id,name:r.name}))};});
 const checkpoint=await checkpointHandle.jsonValue();assert.equal(checkpoint.ready,true);assert.equal(checkpoint.workspace.databaseName,'rakeezx-demo');
 await page.goto(base+'/#/teaching/'+checkpoint.teachingId);await page.locator('.class-hub').waitFor();await page.goto(base+'/#/teaching/'+checkpoint.teachingId+'/grades?import=1');await page.locator('[data-grade-export-panel] > summary').click();const download=page.waitForEvent('download');await page.locator('[data-act="grade-template"]').click();assert.match((await download).suggestedFilename(),/درجات ركيز/);
 checks.push({name:'n90_offline_shell_binding',status:'PASS',evidence:`Actual ${version} caches all existing newly referenced modules. A fresh offline document boots approved synthetic Demo; the same document checkpoint binds database/readiness/teaching, renders current hub and shared grade workflow and downloads blank template.`});console.log('PASS n90_offline_shell_binding');await context.close();
}finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));if(ownedLease)console.log(lease('release'));await writeFile(output+'/result.json',JSON.stringify({checks,ownedBrowserClosed:true,ownedServerStopped:true},null,2));}
