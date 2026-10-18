/** AI: task-owned loopback whole-app review. Actual shell/routes/store/guard/CSS;
 * only account boot and source readiness are synthetic, never a live account. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {startNativePg} from '../../tests/fixtures/n88-integrated-class/native-pg.mjs';
import {A,authUrl,providerFixture} from '../../tests/fixtures/n88-existing-host/provider.mjs';
import {createWebEntry} from './web-entry.mjs';
import {createCloudflareEntry} from './cloudflare-entry.mjs';
import {readCanonical} from './integrated-service.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function startIntegratedReview({ttl=14400}={}) {
  const pg=await startNativePg(root);let server,timer,closed=false,expire;
  const expired=new Promise(ok=>{expire=ok;});
  const close=async()=>{if(closed)return;closed=true;clearTimeout(timer);if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}await pg.close();};
  try {
    const origin='https://synthetic.invalid',provider=providerFixture(),ingressKey=randomBytes(32);
    const manifest=JSON.parse(await readFile(path.join(root,'drafts/n88-student-portal/deployment.inactive.json'),'utf8'));
    const edge=createWebEntry({...manifest,origin,authUrl,apiKey:'FABRICATED_API_KEY',secretKey:randomBytes(32),ingressKey,
      numericKey:randomBytes(32),reservationKey:randomBytes(32),acquire:()=>pg.acquire(),fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true});
    const gateway=createCloudflareEntry({fetch:(u,i)=>edge(new Request(u,i))});
    const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:ingressKey.toString('hex')};
    let localOrigin,loseAck=false,holdNext=false,release,held;
    const calls=[];
    server=createServer(async(req,res)=>{
      const send=(status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'content-type':type});res.end(body);};
      res.setHeader('cache-control','no-store, private');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-content-type-options','nosniff');
      try{
        const u=new URL(req.url,localOrigin);
        if(req.headers.host!==new URL(localOrigin).host||req.headers.origin&&req.headers.origin!==localOrigin||req.headers['sec-fetch-site']==='cross-site')return send(403,'Unavailable');
        if(u.pathname.startsWith('/api/n88/')) {
          if(u.search)return send(400,'Unavailable');
          let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>4096)return send(413,'Unavailable');chunks.push(b);}
          const body=Buffer.concat(chunks),headers=new Headers(req.headers);headers.set('origin',origin);headers.set('cf-connecting-ip','192.0.2.1');
          const request=new Request(origin+u.pathname,{method:req.method,headers,...(body.length?{body}:{})});Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
          const result=await gateway(request,env);calls.push({action:u.pathname.split('/').at(-1),status:result.status});
          if(holdNext){holdNext=false;held?.();await new Promise(ok=>{release=ok;});}
          if(loseAck&&u.pathname.endsWith('/issue-missing')){loseAck=false;return send(503,'Unavailable');}
          res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(Buffer.from(await result.arrayBuffer()));
        }
        if(req.method!=='GET')return send(405,'Unavailable');
        if(u.pathname==='/review/context') {
          const c=await pg.acquire();let canonical;
          try{await c.query('begin');canonical=await readCanonical({query:(...a)=>c.query(...a)},A);await c.query('rollback');}finally{c.release();}
          return send(200,JSON.stringify({ownerId:A,token:provider.token(),canonical}),'application/json');
        }
        let file,source;
        if(u.pathname==='/student')file='drafts/n88-student-portal/client/student.html';
        else if(u.pathname==='/'||u.pathname==='/teacher')file='index.html';
        else if(/^\/(?:src|assets|font)\/[A-Za-z0-9_./-]+$/.test(u.pathname)&&!u.pathname.includes('..'))file=u.pathname.slice(1);
        else if(u.pathname==='/drafts/n88-student-portal/client/student-entry.js')file=u.pathname.slice(1);
        else if(u.pathname==='/review/bootstrap.js')file='tests/fixtures/n88-integrated-class/bootstrap.js';
        else return send(404,'Unavailable');
        source=await readFile(path.join(root,file));
        if(file==='src/app.js') {
          source=source.toString().replaceAll('\r\n','\n');const a=source.indexOf('    // Restore the cached identity immediately'),b=source.indexOf("  } catch (err) {\n    console.error('[rakeezx] فشل",a);
          if(a<0||b<a)throw Error('Actual app bootstrap changed');
          source=source.slice(0,a)+"    const fixture=await import('/review/bootstrap.js');\n    workspaceRouting=await fixture.bootstrap();\n"+source.slice(b);
          // Synthetic review does not run Sync/session materialization or SW registration.
          source=source.replace(/const canMaterializeTodaySessions = .*?;/,'const canMaterializeTodaySessions = () => false;').replace('function registerServiceWorker() {','function registerServiceWorker() { return;');
        }
        if(file==='src/lib/student-portal-runtime.js')source=source.toString().replace('enabled: false, serviceRevision: null',"enabled: true, serviceRevision: 'n88-integrated-class-v1'");
        if(file.endsWith('/client/student-entry.js'))source=source.toString().replace('enabled:false','enabled:true');
        const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
        return send(200,source,types[ext]||'application/octet-stream');
      }catch{if(!res.headersSent)send(503,'Synthetic review unavailable');else res.end();}
    });
    server.requestTimeout=15000;server.headersTimeout=10000;
    await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});localOrigin='http://127.0.0.1:'+server.address().port;
    timer=setTimeout(expire,ttl*1000);
    return {url:localOrigin+'/#/teaching/teaching',studentUrl:localOrigin+'/student',phase:pg.phase,postgres:{...pg.identity,port:pg.port},expiresAt:new Date(Date.now()+ttl*1000).toISOString(),close,expired,
      testing:{calls,provider,query:pg.fixtureQuery,loseAck:()=>{loseAck=true;},hold:()=>{holdNext=true;return new Promise(ok=>{held=ok;});},release:()=>{release?.();release=null;}}};
  }catch(e){await close();throw e;}
}
