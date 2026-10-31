/** AI: owned loopback HTTP. Actual app/router/store/guards, actual service; no account credentials. */
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {fixture} from './service-fixture.mjs';
import {bundleStudent} from './bundle-student.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function start({bundled=false}={}){
 const f=await fixture();f.hostErrors=[];
 const bundle=bundled?await bundleStudent():null;
 const server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');let file=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(u.pathname.startsWith('/api/n88/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();
    const response=await f.request(u.pathname,{method:req.method,headers:req.headers,...(raw?{body:raw}:{})});
    res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());
  }
  if(req.method!=='GET'||u.pathname.includes('..'))throw Error();
  if(bundle&&u.pathname==='/fixture/bundled-student'){
    const html=(await readFile(path.join(root,'drafts/n88-student-portal/client/student.html'),'utf8')).replace('/src/styles/app.css','/n88-private/styles/app.css').replace('/src/styles/student-portal-login.css','/n88-private/styles/student-portal-login.css').replace('/drafts/n88-student-portal/client/student-entry.js','/n88-private/assets/student.mjs');
    res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);
  }
  if(bundle&&u.pathname==='/n88-private/assets/student.mjs'){res.setHeader('content-type','text/javascript');return res.end(bundle.text);}
  if(bundle&&u.pathname.startsWith('/n88-private/styles/'))file='src/styles/'+path.basename(u.pathname);
  if(bundle&&u.pathname.startsWith('/n88-private/assets/brand/'))file='assets/'+path.basename(u.pathname);
  if(u.pathname==='/review/context'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({ownerId:f.scope.ownerId,token:f.token,canonical:f.state.canonical}));}
  if(u.pathname==='/review/bootstrap.js')file='tests/fixtures/n88-integrated-class/bootstrap.js';
  if(u.pathname==='/fixture/student'){
    res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/app.css"><main id="student"></main><script type="module" src="/tests/n88-publication-ui-1031/student.mjs"></script></html>');
  }
  if(!/^(index.html|manifest.webmanifest|sw.js|src\/|assets\/|font\/|tests\/n88-publication-ui-1031\/(ports|student)\.mjs|tests\/fixtures\/n88-integrated-class\/bootstrap.js)/.test(file))throw Error();
  const wanted=path.resolve(root,file);if(!wanted.startsWith(path.resolve(root)+path.sep))throw Error();
  let source=await readFile(wanted);
  if(file==='src/app.js'){
    source=source.toString().replaceAll('\r\n','\n');const a=source.indexOf('    // Restore the cached identity immediately'),b=source.indexOf("  } catch (err) {\n    console.error('[rakeezx] فشل",a);
    if(a<0||b<a)throw Error('boot seam changed');
    source=source.slice(0,a)+"    const fixture=await import('/review/bootstrap.js');\n    workspaceRouting=await fixture.bootstrap();\n    (await import('/tests/n88-publication-ui-1031/ports.mjs')).install();\n"+source.slice(b);
    source=source.replace(/const canMaterializeTodaySessions = .*?;/,'const canMaterializeTodaySessions = () => false;').replace('function registerServiceWorker() {','function registerServiceWorker() { return;');
  }
  if(file==='src/views/student-portal-class.js')source=source.toString().replace('runtime.mountClassService(target,','window.uiFixture.mount(target,');
  res.setHeader('cache-control','no-store');res.setHeader('content-type',({'.json':'application/json','.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]??'application/octet-stream');res.end(source);
 }catch(error){f.hostErrors.push({path:new URL(req.url,'http://127.0.0.1').pathname,error:error.message.slice(0,160)});res.writeHead(503,{'content-type':'application/json'});res.end('{"state":"unknown","retry":false}');}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 return {f,bundle,url:`http://127.0.0.1:${server.address().port}/`,async close(){server.closeAllConnections();await new Promise(ok=>server.close(ok));}};
}
