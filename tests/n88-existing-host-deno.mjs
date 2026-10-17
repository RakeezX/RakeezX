/** AI: actual Deno runtime/crypto/pg compatibility, synthetic loopback DB only. */
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import pg from 'pg';
import manifest from '../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
import {createWebEntry} from '../drafts/n88-student-portal/web-entry.mjs';
import {createCloudflareEntry} from '../drafts/n88-student-portal/cloudflare-entry.mjs';
import {createStudentPortalClient} from '../src/lib/student-portal-client.js';
const authUrl='https://auth.synthetic.invalid';
const config=JSON.parse(await Deno.readTextFile(Deno.args[0]));
assert.equal(config.host,'127.0.0.1');
const pool=new pg.Pool(config);pool.on('connect',c=>{void c.query('set role n88_backend');});
try {
  const origin='https://synthetic.invalid',key=Buffer.alloc(32,9);
  // Fixture signing uses standard WebCrypto, as the actual SDK verifier does.
  // Deno 2.2's Node KeyObject JWK export is incomplete (preserved initial failure).
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),alg:'ES256',kid:'deno-synthetic',use:'sig'};
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),sec=Math.floor(Date.now()/1000);
  const input=enc({alg:'ES256',kid:jwk.kid,typ:'JWT'})+'.'+enc({iss:authUrl+'/auth/v1',aud:'authenticated',role:'authenticated',
    sub:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session_id:'11111111-1111-4111-8111-111111111111',iat:sec-1,exp:sec+3600});
  const token=input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(input))).toString('base64url');
  const providerFetch=async(url,init)=>url.endsWith('/.well-known/jwks.json')?Response.json({keys:[jwk]}):
    new Headers(init.headers).get('authorization')==='Bearer '+token?Response.json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}):Response.json({error:'unavailable'},{status:401});
  const edge=createWebEntry({...manifest,origin,authUrl,apiKey:'FABRICATED_PUBLIC_KEY',secretKey:Buffer.alloc(32,8),ingressKey:key,
    acquire:()=>pool.connect(),fetch:providerFetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true});
  const gateway=createCloudflareEntry({fetch:(url,init)=>edge(new Request(url,init))});
  const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:key.toString('hex')};
  let cookie='';const transport=auth=>async(path,init)=>{
    const request=new Request(origin+path,{...init,headers:{...init.headers,origin,'cf-connecting-ip':'192.0.2.10',
      ...(auth?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{})}});
    Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
    const response=await gateway(request,env);const next=response.headers.get('set-cookie');if(next)cookie=next.split(';')[0];return response;
  };
  const teacher=createStudentPortalClient({fetch:transport(true)}),roster=await teacher.students();assert.equal(roster.students.length,1);
  const m=roster.students[0];await teacher.publish(m,{publicationId:m.publications[0].id,title:'DENO RUNTIME',published:true,status:'done'});
  const issued=await teacher.issue(m);assert.match(issued.code,/^[1-9][0-9]{3}$/);
  const student=createStudentPortalClient({fetch:transport(false),base:'/api/n88/s/'+issued.entrySecret});
  await student.claim(issued.code);assert.equal((await student.read()).tasks[0].title,'DENO RUNTIME');
  console.log('Deno 2.2.12 actual Web entry + AuthClient/ES256/WebCrypto + restricted pg/canonical RLS PASS');
}finally{await pool.end();}
