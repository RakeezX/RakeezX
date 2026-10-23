/** AI: actual native/source -> signed carrier -> actual client. Fabricated only. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createUnifiedStudentPortalClient} from '../../src/lib/student-portal-unified-client.js';
const dir='tests/n88-denied-read-20261023/';
const staged=process.argv.includes('--staged');
const file=staged?'drafts/n88-student-portal/activation/denied-read-20261023/native66-successor.inactive.mjs':'drafts/n88-student-portal/activation/bundle/edge/index.mjs';
const native=(await readFile(file,'utf8')).replaceAll('\r\n','\n'),marker='// supabase/functions/n88-student-portal/index.ts';
assert.equal(native.split(marker).length,2);
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const build=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf(marker))+'\nexport {createWebEntry,createIntegratedService};',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'no-provider',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},a=>({contents:a.path==='pg'?'export default {Pool:class {constructor(){throw Error("provider forbidden");}}};':'export class AuthClient {constructor(){throw Error("provider forbidden");}}',loader:'js'}));}}]});
const compiled=await import('data:text/javascript;base64,'+Buffer.from(build.outputFiles[0].contents).toString('base64'));
const carrierSource=(await readFile('drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','utf8')).replaceAll('\r\n','\n');
assert.equal(createHash('sha256').update(carrierSource).digest('hex'),'a2d840e6b4b35f1be968f332773a78640a45b4529a54d3ae98c92fba3f47da50');
const carrierModule=await import('data:text/javascript;base64,'+Buffer.from(carrierSource).toString('base64'));
const report={aiAuthored:true,status:'FAIL',providerOperations:0,realAccountReads:0,sourceSha256:createHash('sha256').update(native).digest('hex'),cases:[]};
const deployment=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
try {
 for(const [name,entry] of [['native',compiled.createWebEntry]]) {
  const options={sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin:'https://synthetic.invalid',authUrl:'https://auth.synthetic.invalid',apiKey:'fabricated',secretKey:randomBytes(32),ingressKey:randomBytes(32),numericKey:randomBytes(32),reservationKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',acquire:async()=>{throw Error('private synthetic database error');}};
  const service=entry({...deployment,...options}),env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:options.origin,N88_EDGE_URL:options.authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:options.ingressKey.toString('hex')};
  let outgoing,upstream,received;
  const carrier=carrierModule.createCloudflareEntry({fetch:async(url,init)=>{upstream={url,init};return service(new Request(url,init));}});
  const client=createUnifiedStudentPortalClient({fetch:async(path,init)=>{
   outgoing={path,init};
   const request=new Request(options.origin+path,{...init,headers:{...init.headers,'cf-connecting-ip':'192.0.2.1','sec-fetch-site':'same-origin',cookie:'__Secure-n88-student='+'X'.repeat(43)}});
   Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
   received=await carrier(request,env);return received;
  }});
  let caught;try{await client.read();}catch(e){caught=e;}
  report.observed={status:received.status,cookieRetired:received.headers.get('set-cookie')?.includes('Max-Age=0')??false,clientKind:caught?.kind,diagnostic:client.getDiagnostic()};
  assert.equal(caught?.kind,'unavailable');
  assert.equal(received.status,503);assert.equal(received.headers.get('set-cookie'),null);
  assert.equal(client.getDiagnostic().outcome,'unavailable');assert.equal(client.getDiagnostic().httpStatusClass,'5xx');
  assert.equal(outgoing.path,'/api/n88/student/read');assert.equal(outgoing.init.credentials,'same-origin');assert.equal(outgoing.init.redirect,'error');
  assert.equal(upstream.url,options.authUrl+'/functions/v1/n88-student-portal/dispatch');
  assert.equal(upstream.init.headers.has('cookie'),false);assert.equal(upstream.init.headers.has('authorization'),false);
  assert.deepEqual(await received.clone().json(),{error:'unavailable'});
  client.dispose();report.cases.push(name+': acquisition failure is503, no cookie retirement, no private errors');
 }
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:e.message};process.exitCode=1;console.error(e.name+': '+e.message);}
finally{await mkdir(dir,{recursive:true});await writeFile(dir+(staged?'green.json':'red.json'),JSON.stringify(report,null,2)+'\n');}
