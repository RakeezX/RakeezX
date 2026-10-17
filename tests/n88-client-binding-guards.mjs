/** AI: targeted actual Service Worker execution, no live/offline certification. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,access} from 'node:fs/promises';
export async function offlineChecks(report) {
  const source=await readFile('sw.js','utf8'),handlers={};
  const shell=vm.runInNewContext(source+';SHELL',{self:{addEventListener:(name,fn)=>{handlers[name]=fn;},location:{origin:'https://synthetic.invalid'}},console,URL,Request,Response,Set,Promise});
  for(const file of ['src/lib/student-portal-runtime.js','src/lib/student-portal-client.js','src/views/student-portal.js','src/views/student-portal-teacher.js','src/styles/student-portal.css'])assert.ok(shell.includes('./'+file));
  for(const file of shell) if(file!=='./')await access(file.split('?')[0]);
  for(const pathname of ['/api/n88/teacher/students','/api/n88/s/'+'a'.repeat(43)+'/read','/s/'+'a'.repeat(43)]) {
    let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://synthetic.invalid'+pathname,mode:'navigate'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
  }
  // Execute the real offline asset path: a failed fetch returns its shell cache.
  let pending;const cached=new Response('synthetic cached runtime',{headers:{'content-type':'text/javascript'}});
  const sandbox={self:{addEventListener:(n,fn)=>{handlers[n]=fn;},location:{origin:'https://synthetic.invalid'}},console,URL,Request,Response,Set,Promise,
    caches:{keys:async()=>[],open:async()=>({match:async()=>cached})},fetch:async()=>{throw Error('synthetic offline');}};
  vm.runInNewContext(source,sandbox);
  handlers.fetch({request:new Request('https://synthetic.invalid/src/lib/student-portal-runtime.js'),respondWith:p=>{pending=p;}});
  assert.equal(await (await pending).text(),'synthetic cached runtime');
  report.checks.push({name:'n88_offline_shell_dependencies_and_private_cache_exclusion',status:'PASS',evidence:'Executed actual sw.js fetch handler: /api/n88 and /s bypass cache entirely; offline runtime JS uses cached shell response; all shell files exist and new runtime/view/style dependencies are listed. Synthetic VM only, not live SW certification.'});
}
