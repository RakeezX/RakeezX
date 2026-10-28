/** AI: opt-in loopback-only synthetic Preview host. Never mount in Product. */
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,renameSync,existsSync,unlinkSync,lstatSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createSyntheticPublisherHost} from './publisher-synthetic-host.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const assets=new Set([
  'drafts/n44-push/publisher-preview.html','drafts/n44-push/publisher-preview.mjs','drafts/n44-push/publisher-preview.css',
  'src/styles/app.css','src/styles/components.css','src/styles/rakeez-datetime.css',
  'src/lib/rakeez-datetime.js','src/lib/rakeez-datetime-values.js','src/lib/thmanyah-font.js','src/lib/thmanyah-payload.js',
  'src/vendor/flatpickr/flatpickr.min.js','src/vendor/flatpickr/ar.js','src/vendor/flatpickr/flatpickr.min.css',
]);
export function syntheticPublisherStorage(storagePath=null) {
  if(storagePath!==null) {
    storagePath=path.resolve(storagePath);
    if(path.basename(storagePath)!=='.n44-synthetic-publisher.json'||![path.join(root,'drafts/n44-push')+path.sep,path.join(root,'tests/n44-d107-continuation-20261028')+path.sep].some(p=>storagePath.startsWith(p))||
      existsSync(storagePath)&&lstatSync(storagePath).isSymbolicLink())throw Error('explicit_synthetic_storage_required');
  }
  let snapshot=null;
  if(storagePath&&existsSync(storagePath)) {
    if(lstatSync(storagePath).size>262144)throw Error('synthetic_storage_capacity');snapshot=JSON.parse(readFileSync(storagePath,'utf8'));
  }
  const persist=storagePath?(value,beforeCommit=()=>{})=>{
    const bytes=JSON.stringify(value);if(Buffer.byteLength(bytes)>262144)throw Error('synthetic_storage_capacity');
    const temp=storagePath+'.'+randomUUID()+'.tmp';
    try {writeFileSync(temp,bytes,{flag:'wx',encoding:'utf8'});beforeCommit();renameSync(temp,storagePath);}
    finally {if(existsSync(temp))unlinkSync(temp);}
  }:()=>{};
  return {snapshot,persist};
}
export function syntheticPublisherHttpHandler(host,origin) {
  const endpoint=new URL(origin);
  if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||!endpoint.port||endpoint.origin!==origin)throw Error('loopback_origin_required');
  const port=Number(endpoint.port);
  return async(req,res)=>{
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
      'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' blob:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const reply=(status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{...headers,'content-type':type});res.end(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));};
    try {
      if(req.headers.host!=='127.0.0.1:'+port)return reply(403,{status:'loopback_only'});
      const url=new URL(req.url,origin);
      if(url.origin!==origin||url.search)return reply(400,{status:'rejected'});
      if(url.pathname==='/__n44-publisher') {
        if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-n44-synthetic']!=='1'||req.headers['content-type']!=='application/json')return reply(403,{status:'synthetic_origin_required'});
        let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)return reply(413,{status:'too_large'});chunks.push(chunk);}
        return reply(200,await host.dispatch(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
      }
      if(req.method!=='GET')return reply(405,{status:'method_not_allowed'});
      const file=url.pathname==='/'?'drafts/n44-push/publisher-preview.html':url.pathname.slice(1);
      if(!assets.has(file))return reply(404,{status:'not_found'});
      const type=file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/javascript';
      reply(200,readFileSync(path.join(root,file)),type+'; charset=utf-8');
    }catch{reply(400,{status:'unavailable'});}
  };
}
export async function startSyntheticPublisherServer({port,storagePath=null,clock=Date.now}={}) {
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('explicit_owned_loopback_port_required');
  const {snapshot,persist}=syntheticPublisherStorage(storagePath);
  const host=createSyntheticPublisherHost({clock,snapshot,persist});
  const origin='http://127.0.0.1:'+port;
  const server=http.createServer(syntheticPublisherHttpHandler(host,origin));
  server.requestTimeout=5000;server.headersTimeout=5000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin,close:()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const owned=await startSyntheticPublisherServer({port:Number(process.argv[2]),storagePath:path.join(path.dirname(fileURLToPath(import.meta.url)),'.n44-synthetic-publisher.json')});
  console.log('LOCAL SYNTHETIC ONLY: '+owned.origin);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await owned.close();});
}
