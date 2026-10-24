/** AI: fabricated driver only. Zero SQL, sockets, provider/browser/account operations. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {original,dir} from '../../drafts/n88-student-portal/activation/denied-read-20261023/postdelivery-20261024/prepare.mjs';
import {mac,sha,signingText,FORWARDED} from '../../drafts/n88-student-portal/web-protocol.mjs';
import {reconciliationSuccessor as successor} from '../../drafts/n88-student-portal/activation/denied-read-20261023/postdelivery-20261024/prepare-reconciliation.mjs';
const report={aiAuthored:true,status:'FAIL',providerOperations:0,sqlOperations:0,browserOperations:0,realAccountReads:0,checks:[],resourcesCreated:0};
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
async function compile(native){
 const extra=native===successor?',n88ReadFailureTags,n88ReadCategory':'';
 const b=await esbuild.build({stdin:{contents:native.slice(0,native.indexOf('// supabase/functions/n88-student-portal/index.ts'))+'\nexport {createWebEntry,createStudentReadBoundary'+extra+'};',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent',plugins:[{name:'no-provider',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export class AuthClient{constructor(){throw Error("forbidden provider");}}',loader:'js'}));}}]});
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));
}
const pinned=p=>execFileSync('git',['cat-file','blob','cbdfb4d8cd91f6e7588e0512b64f692935d2462d:'+p],{encoding:'utf8',maxBuffer:2e6});
const ids=JSON.parse(pinned('drafts/n88-student-portal/activation/read-service-20261023/typed-identities.json'));
const contract=JSON.parse(pinned('drafts/n88-student-portal/activation/error-boundary-contract.json'));
const operations=new Map(contract.operations.map(o=>[o.name,o]));
const deployment=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
const key=randomBytes(32),ingress=randomBytes(32),origin='https://synthetic.invalid',auth='https://auth.synthetic.invalid';
let fault='acquire',releases=[],commands=[];
const options={...deployment,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true,origin,authUrl:auth,apiKey:'fabricated',secretKey:key,ingressKey:ingress,numericKey:randomBytes(32),reservationKey:randomBytes(32),recoveryKeys:new Map([['r1',randomBytes(32)]]),recoveryActiveKeyVersion:'r1',acquire:async()=>{
 if(fault==='acquire')throw Object.assign(Error('PRIVATE MESSAGE token SQL url record'),{safeStage:'projection-commit',code:'PRIVATE'});
 return {query:async(sql,args)=>{
  commands.push(sql);
  if(sql.includes('from pg_proc')){if(fault==='guard')throw Error('PRIVATE catalog');return {rows:ids};}
  if(sql==='commit'){if(fault==='commit')throw Error('PRIVATE COMMIT');return {command:'COMMIT',rows:[]};}
  if(sql==='rollback')return {command:'ROLLBACK',rows:[]};
  const op=operations.get(/n88_private\.(boundary_[a-f0-9]+)/.exec(sql)?.[1]);
  if(op?.sql.includes('consume_ingress')){if(fault==='projection')throw Error('PRIVATE operation');return {rows:[{accepted:fault!=='admission-false'}]};}
  if(op&&fault==='transaction')throw Error('PRIVATE snapshot');
  return {rows:[],command:'SELECT'};
 },release:e=>releases.push(!!e)};
}};
const proofText=(time,nonce,source,signature)=>JSON.stringify(['n88-operator-read-failure-v1',time,nonce,source,signature]);
async function request(entry,{proof='operator',stale=false,path='/api/n88/student/read',method='GET',tamper=false}={}){
 const time=String(Math.floor(Date.now()/1000)-(stale?60:0)),nonce=randomUUID(),source='a'.repeat(64);
 const headers=new Headers({'sec-fetch-site':'same-origin'}),bytes=new Uint8Array();
 const signature=await mac(ingress,signingText({origin,path,method,headers,bodyHash:await sha(bytes),time,nonce,source}));
 const wire=new Headers({'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-source':source,'x-n88-signature':tamper?'0'.repeat(64):signature});
 if(proof!=='none')wire.set('x-n88-operator-read-failure',proof==='malformed'?'raw message':await mac(proof==='ingress'?ingress:proof==='foreign'?randomBytes(32):key,proofText(time,proof==='wrong-nonce'?randomUUID():nonce,source,signature)));
 const r=await entry(new Request(auth+'/functions/v1/n88-student-portal/dispatch',{method:'POST',headers:wire,body:JSON.stringify({path,method,headers:FORWARDED.map(n=>headers.get(n)||''),body:''})}));
 return {http:r.status,body:await r.json()};
}

const base=await compile(original),next=await compile(successor),after=next.createWebEntry(options);
fault='admission-false';const old=await request(base.createWebEntry(options));assert.equal(old.body.status,401);assert.equal(old.body.readFailureStage,undefined);
const admittedFalse=await request(after);assert.equal(admittedFalse.body.status,401);assert.equal(admittedFalse.body.readFailureStage,'admission_denied');
for(const proof of ['none','ingress','foreign','wrong-nonce','malformed']){const r=await request(after,{proof});assert.equal(r.body.readFailureStage,undefined);}
for(const opts of [{stale:true},{tamper:true}]){const r=await request(after,opts);assert.equal(r.http,401);assert.equal(r.body.readFailureStage,undefined);}
fault=null;const noSession=await request(after);assert.equal(noSession.body.status,401);assert.equal(noSession.body.readFailureStage,'session_required');
fault='projection';const thrown=await request(after);assert.equal(thrown.body.status,503);assert.equal(thrown.body.readFailureStage,'projection');
for(const faultName of ['acquire','guard','transaction','commit']){fault=faultName;const r=await request(after);assert.equal(r.body.status,503);assert.equal(r.body.readFailureStage,faultName);}
report.status='PASS';report.checks=['actual signed native composition distinguishes finite admission denial from no-cookie session rejection','operator-only fixed categories for thrown acquire/guard/transaction/projection/COMMIT; no public expansion','missing, ingress-only, foreign, nonce-mismatched, malformed or expired operator proof cannot export a category'];report.validSessionProjection='NOT_RUN; no-cookie request cannot certify grades';await writeFile('tests/n88-actual-current-cause-20261020/reconciliation-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log('PASS: corrected finite admission and operator proof boundaries');
