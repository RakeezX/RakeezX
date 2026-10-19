/** AI: affected real request deadline only; no network, fixture or server. */
import '../drafts/n44-push/node-globals.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createWebEntry} from '../drafts/n44-push/web-entry.mjs';
import {FORWARDED,encodeBytes,sha,mac,signingText} from '../drafts/n44-push/web-protocol.mjs';
const stamp=Date.now(),origin='https://synthetic.invalid',authUrl='https://xlrubcwjqktzzunrvuns.supabase.co',source='236f68e0131ca4d2b27fc3014cb33421f90b40c1',key=new Uint8Array(32).fill(1);
const profile={v:2,approvalState:'active',approvalId:'a'.repeat(64),serviceRevision:'n44-browser-service-v2',serviceSourceSha:source,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:'b'.repeat(64),observedAt:stamp-1000,activatedAt:stamp-500};
const edge=createWebEntry({authUrl,origin,apiKey:'FABRICATED_PUBLIC',providerOrigins:[],crypto:{},rateKey:key,sessionPolicy:profile,serviceSourceSha:source,ingressKey:key,schedulerKey:key,acquire:async()=>new Promise(()=>{})});
const headers=new Headers({origin,authorization:'Bearer N44_FABRICATED_UNAUTHORIZED_20261019','content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin'}),bytes=new TextEncoder().encode(JSON.stringify({workspaceId:'synthetic',deviceId:'synthetic'})),path='/api/n44/context/read',time=String(Math.floor(stamp/1000)),nonce=crypto.randomUUID(),peer='a'.repeat(64);
const signature=await mac(key,signingText({origin,path,method:'POST',headers,bodyHash:await sha(bytes),time,nonce,source:peer}));
const request=new Request(authUrl+'/functions/v1/n44-notifications/dispatch',{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-source':peer,'x-n44-signature':signature},body:JSON.stringify({path,method:'POST',headers:FORWARDED.map(n=>headers.get(n)||''),body:encodeBytes(bytes)})});
const start=Date.now(),response=await edge(request),elapsedMs=Date.now()-start;
assert.deepEqual(await response.json(),{status:503,body:{error:'unavailable',phase:'deadline'}});assert.ok(elapsedMs>=14500&&elapsedMs<17000);assert.equal(response.headers.get('cache-control'),'no-store, private');
await writeFile('tests/n44-finish-runtime.deadline.json',JSON.stringify({runId:'b7a2a2e4-c4bc-4cce-ac9d-e02740bc494f',recordedAt:new Date().toISOString(),status:'PASS',elapsedMs,evidence:'Actual signed WebRequest hung acquisition is bounded by original15s deadline; sanitized503 wire status, private headers, no SQL/Auth/network.'},null,2)+'\n');console.log('N44 actual original15s request deadline PASS.');
