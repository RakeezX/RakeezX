/** AI: reuse actual app shell and existing fabricated account bootstrap. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture,A} from './fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function start(){
 let f,canonical,delay=0;const calls=[];
 const reset=async(n=28,enabled=true)=>{
  f=fixture(n,{enabled});calls.length=0;delay=0;
  const row=o=>({ownerId:A,revision:1,deleted:false,...o});
  canonical={years:[row({id:'year',status:'active'})],terms:[row({id:'term',yearId:'year',status:'active',startDate:null,endDate:null})],sections:[row({id:'class',yearId:'year',status:'active',grade:4,label:'أ'})],teachings:[row({id:'teaching',sectionId:'class',termId:'term',subjectId:'subject'})],students:f.state.source.map(r=>row({id:r.student_id,name:r.label,status:'active'})),enrollments:f.state.source.map(r=>row({id:r.enrollment_id,studentId:r.student_id,sectionId:'class',startDate:null,endDate:null,status:'active'})),items:[],scores:[],scoreSubitems:[],scoreSubitemCompletions:[],sessions:[],attendance:[],logs:[]};
  return f.input();
 };
 await reset();
 const server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  const json=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method==='POST'&&u.pathname.startsWith('/api/n88/teacher/class/')){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)throw Error('bound');}
   const body=JSON.parse(raw),action=u.pathname.split('/').at(-1);calls.push({action,resolution:body.resolution});
   // Only the synthetic ingress origin is adapted; Auth bearer goes through the
   // actual SDK verifier. Browser always uses its real loopback same-origin URL.
   if(action==='guidance-list')return json(503,{error:'unavailable'}); // unrelated source family not modeled
   const result=await f.request(action,body,{headers:{...req.headers,origin:f.options.origin}});
   if(body.resolution&&delay)await new Promise(r=>setTimeout(r,delay));
   return json(result.status,result.body);
  }
  if(u.pathname==='/review/context')return json(200,{ownerId:A,token:f.provider.token(),canonical});
  if(u.pathname==='/review/input')return json(200,await f.input());
  let file=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(u.pathname==='/review/bootstrap.js')file='tests/fixtures/n88-integrated-class/bootstrap.js';
  if(req.method!=='GET'||u.pathname.includes('..')||! /^(index.html|sw.js|manifest.webmanifest|src\/|assets\/|font\/|tests\/n88-terminal-negative-20261028\/ports.js|tests\/fixtures\/n88-integrated-class\/)/.test(file)){res.writeHead(404);return res.end();}
  let source=await readFile(path.join(root,file));
  if(file==='src/app.js'){
   source=source.toString().replaceAll('\r\n','\n');
   const a=source.indexOf('    // Restore the cached identity immediately'),b=source.indexOf("  } catch (err) {\n    console.error('[rakeezx] فشل",a);
   if(a<0||b<a)throw Error('boot seam changed');
   source=source.slice(0,a)+"    const fixture=await import('/review/bootstrap.js');\n    workspaceRouting=await fixture.bootstrap();\n    (await import('/tests/n88-terminal-negative-20261028/ports.js')).install();\n"+source.slice(b);
   source=source.replace(/const canMaterializeTodaySessions = .*?;/,'const canMaterializeTodaySessions = () => false;').replace('function registerServiceWorker() {','function registerServiceWorker() { return;');
  }
  if(file==='src/views/student-portal-class.js')source=source.toString().replace('runtime.mountClassService(target,','window.negativeFixture.mount(target,');
  res.setHeader('cache-control','no-store');res.setHeader('content-type',({'.json':'application/json','.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(source);
 }catch{res.writeHead(500);res.end('Synthetic resource unavailable');}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 return {url:`http://127.0.0.1:${server.address().port}/#/teaching/teaching`,reset,calls,get fixture(){return f;},setDelay:ms=>{delay=ms;},async close(){server.closeAllConnections();await new Promise(ok=>server.close(ok));}};
}
