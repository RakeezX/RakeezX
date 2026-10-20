import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';import {randomBytes} from 'node:crypto';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
import {createCloudflareEntry} from '../../drafts/n88-student-portal/cloudflare-entry.mjs';
import {providerFixture,A,SESSION,authUrl} from '../fixtures/n88-existing-host/provider.mjs';
const require=createRequire(import.meta.url),esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const sdk=createRequire('C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018/drafts/n88-student-portal/package.json').resolve('@supabase/auth-js');
const built=await esbuild.build({entryPoints:['drafts/n88-student-portal/web-entry.mjs'],bundle:true,platform:'node',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[{name:'existing-pinned-sdk',setup(b){b.onResolve({filter:/^@supabase\/auth-js$/},()=>({path:sdk}));}}]});
const {createWebEntry}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const manifest=JSON.parse(await fs.readFile('drafts/n88-student-portal/deployment.inactive.json','utf8')),identities=JSON.parse(await fs.readFile('drafts/n88-student-portal/activation/error-boundary-identities.json','utf8')),contract=JSON.parse(await fs.readFile('drafts/n88-student-portal/activation/error-boundary-contract.json','utf8'));
const operations=new Map(contract.operations.map(o=>[o.name,o])),sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const commonProvider=providerFixture();
export function composition({classId,teachingId,failStage=false,firstDelay=550,nextDelay=200}){
 let acquisitions=0,commits=0;const phases=[],origin='https://synthetic.invalid',provider=commonProvider;
 const common={owner_id:A,revision:'1',deleted_at:null};
 const canonical={years:[{...common,id:'year',status:'active'}],terms:[{...common,id:'term',year_id:'year',status:'active',start_date:null,end_date:null}],sections:[{...common,id:classId,year_id:'year',status:'active',archived_at:null,grade:1,label:'أ',name:''}],teachings:[{...common,id:teachingId,section_id:classId,term_id:'term',subject_id:'subject'}],students:[{...common,id:'synthetic-student',status:'active',name:'طالب مصطنع'}],enrollments:[{...common,id:'synthetic-enrollment',student_id:'synthetic-student',section_id:classId,status:'active',start_date:null,end_date:null}]};
 const acquire=async()=>{
  const n=++acquisitions;phases.push('acquire');await sleep(n===1?firstDelay:nextDelay);
  if(failStage)throw Error('synthetic_acquire_failure');
  return {release(){},async query(text,values=[]){
   if(text.includes('pg_get_functiondef'))return {rows:identities};
   const name=/select \* from n88_private\.(boundary_\w+)\(/.exec(text)?.[1],op=name&&operations.get(name),sql=op?.sql||text;
   let rows=[];
   if(sql.startsWith('commit')){commits++;return {rows:[],command:'COMMIT'};}
   if(op?.effect)return {rows:[{affected:'1'}]};
   if(sql.includes('consume_ingress'))rows=[{accepted:true}];
   else if(sql.includes('lock_current_session'))rows=[{user_id:A,session_id:SESSION}];
   else if(sql.startsWith('select t.id,t.section_id'))rows=[{id:teachingId,section_id:classId,teaching_revision:'1',term_revision:'1'}];
   else if(sql.includes('as enrollment_id'))rows=[{payload:JSON.stringify({owner_id:A,enrollment_id:'synthetic-enrollment',section_id:classId,student_id:'synthetic-student',revision:'1',status:'active',end_date:null,enrollment_present:true,student_active:true,label:'طالب مصطنع',class_active:true,student_revision:'1',section_revision:'1',year_revision:'1'})}];
   else if(sql.includes('row_to_json(x)')){
    const table=/from rakeezx\.(\w+) where owner_id/.exec(sql)?.[1];
    rows=(canonical[table]||[]).map(r=>({payload:JSON.stringify(r)}));
   }
   if(op?.voidResult)rows=[{}];
   return {rows,command:'SELECT',rowCount:rows.length};
  }};
 };
 const recovery=randomBytes(32),options={...manifest,origin,authUrl,apiKey:'SYNTHETIC_PUBLIC',secretKey:randomBytes(32),ingressKey:randomBytes(32),numericKey:randomBytes(32),reservationKey:randomBytes(32),recoveryKeys:new Map([['v1',recovery]]),recoveryActiveKeyVersion:'v1',acquire,fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true};
 const rollout=createRolloutGuard(n=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[n]);
 options.rollout=rollout;options.canonicalBounds={...options.canonicalBounds,rollout};
 const edge=createWebEntry(options),gateway=createCloudflareEntry({fetch:async(url,init)=>edge(new Request(url,init))}),env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:options.ingressKey.toString('hex')};
 return {provider,phases,get counts(){return {acquisitions,commits};},async send(path,init){
 const h=new Headers(init.headers);h.set('origin',origin);h.set('cf-connecting-ip','192.0.2.1');
 const request=new Request(origin+path,{...init,headers:h});Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
 return gateway(request,env);
 }};
}