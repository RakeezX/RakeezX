/** AI: task-owned loopback adapter, reuses existing synthetic app bootstrap read-only. */
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {providerFixture,A} from '../fixtures/n88-existing-host/provider.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function start() {
 let release=94;
 const previous = new Map();
 const row=o=>({ownerId:A,revision:1,deleted:false,...o});
 const canonical={years:[row({id:'year',status:'active'})],terms:[row({id:'term',yearId:'year',status:'active',startDate:'2026-08-01',endDate:'2027-01-01'})],sections:[row({id:'class',yearId:'year',status:'active',grade:4,label:'أ'})],teachings:[row({id:'teaching',sectionId:'class',termId:'term',subjectId:'subject'})],students:['one','two','old'].map((id,i)=>row({id,name:`طالب مصطنع ${i+1}`,status:'active'})),enrollments:['one','two','old'].map(id=>row({id:'e-'+id,studentId:id,sectionId:'class',startDate:'2026-08-01',endDate:null,status:'active'})),items:[],scores:[],scoreSubitems:[],scoreSubitemCompletions:[],sessions:[],attendance:[],logs:[]};
 const provider=providerFixture();
 const server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');let file=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(req.method!=='GET'||u.pathname.includes('..')){res.writeHead(404);return res.end();}
  if(u.pathname==='/api/n88/synthetic-context'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({ownerId:A,token:provider.token(),canonical}));}
  if(u.pathname==='/api/n88/synthetic-private'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({token:'SYNTHETIC_PRIVATE_SENTINEL'}));}
  if(u.pathname==='/review/bootstrap.js')file='tests/fixtures/n88-integrated-class/bootstrap.js';
  if(!/^(index.html|sw.js|manifest.webmanifest|src\/|assets\/|font\/|tests\/n88-field-defaults-20261028\/|tests\/fixtures\/n88-(teacher-presentation|integrated-class)\/)/.test(file)){res.writeHead(404);return res.end();}
  let source=await readFile(path.join(root,file));
  if(file==='sw.js'&&release===94)source=Buffer.from(source.toString().replace("rakeezx-v95","rakeezx-v94"));
  if(release===94&&['src/views/student-portal-class.js','src/styles/student-portal-class.css','src/lib/student-portal-class-client.js','src/lib/student-portal-runtime.js','src/lib/student-portal-task-guidance-client.js'].includes(file)){if(!previous.has(file))previous.set(file,execFileSync('git',['show','0a7c492875cb606e9928886a17189a3339fdfb6b:'+file],{cwd:root}));source=previous.get(file);}
  if(file==='tests/fixtures/n88-integrated-class/bootstrap.js')source=Buffer.from(source.toString().replace('/review/context','/api/n88/synthetic-context'));
  if(file==='tests/n88-field-defaults-20261028/ports.js'){
   source=source.toString().replace("if(action==='list'){","if(action==='list'){if(f.holdList)await new Promise(r=>f.releaseList=r);");
   source=source.replace("if(action==='guidance-list')return f.failGuidance?response(null,503):response({tasks:structuredClone(f.tasks)});",`if(action==='guidance-list'){
    if(f.guidanceStatus)return response(null,f.guidanceStatus);
    if(f.badGuidanceJSON)return {ok:true,status:200,headers:new Headers(),json:async()=>{throw new SyntaxError('SYNTHETIC_BODY');}};
    if(f.badGuidanceACK)return response(f.badGuidanceACK==='null'?null:{tasks:[null]});
    return f.failGuidance?response(null,503):response({tasks:structuredClone(f.tasks)});
   }`);
  }
  if(file==='src/app.js'){

   source=source.toString().replaceAll('\r\n','\n');const a=source.indexOf('    // Restore the cached identity immediately'),b=source.indexOf("  } catch (err) {\n    console.error('[rakeezx] فشل",a);
   if(a<0||b<a)throw Error('boot seam changed');
   source=source.slice(0,a)+"    const fixture=await import('/review/bootstrap.js');\n    workspaceRouting=await fixture.bootstrap();\n    (await import('/tests/n88-field-defaults-20261028/ports.js')).install();\n"+source.slice(b);
   source=source.replace(/const canMaterializeTodaySessions = .*?;/,'const canMaterializeTodaySessions = () => false;').replace('function registerServiceWorker() {','function registerServiceWorker() { return;');
  }
  if(file==='src/views/student-portal-class.js')source=source.toString().replace('runtime.mountClassService(target,','window.compactFixture.mount(target,');
  res.setHeader('cache-control','no-store');res.setHeader('content-type',({'.json':'application/json','.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(source);
 }catch{res.writeHead(404);res.end('Synthetic resource unavailable');}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 return {url:'http://127.0.0.1:'+server.address().port+'/#/teaching/teaching',old(){release=94;},deploy(){release=95;},async close(){server.closeAllConnections();await new Promise(ok=>server.close(ok));}};
}
