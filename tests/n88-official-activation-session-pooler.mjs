/** AI-authored. Exact provider-observed session pooler; DNS/TLS only, no Auth. */
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import {readFile,writeFile} from 'node:fs/promises';
import {X509Certificate} from 'node:crypto';
const host='aws-0-ap-south-1.pooler.supabase.com',port=5432;
const receipt={taskId:'continuous-n88-official-student-portal-activation-20261018',runId:'1b9971f9-e3ae-4e07-9d05-52923064dd91',at:new Date().toISOString(),host,port,mode:'session',modeEvidence:'supabase-session-pooler-readonly.json; provider Connect UI, not inferred from region',authenticationAttempted:false,hostedWrites:0};
let socket,secure,timer;
try {
  const ca=await readFile('drafts/n88-student-portal/activation/ca/supabase-prod-ca-2021.crt','utf8');
  receipt.trustedCaFingerprint256=new X509Certificate(ca).fingerprint256;
  receipt.ipv4=await dns.resolve4(host);assert.ok(receipt.ipv4.length);
  const result=await new Promise(resolve=>{
    let finished=false;
    const done=value=>{if(finished)return;finished=true;resolve(value);};
    timer=setTimeout(()=>done({status:'FAIL',stage:'bounded-connection',code:'TIMEOUT'}),10000);
    socket=net.connect({host,port,family:4});
    socket.once('error',e=>done({status:'FAIL',stage:'tcp',code:e.code}));
    socket.once('connect',()=>{
      const request=Buffer.alloc(8);request.writeInt32BE(8);request.writeInt32BE(80877103,4);socket.write(request);
      socket.once('data',answer=>{
        if(answer.length!==1||answer[0]!==83)return done({status:'FAIL',stage:'postgres-ssl-request',code:'TLS_NOT_ACCEPTED'});
        secure=tls.connect({socket,servername:host,ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},()=>{
          const certificate=secure.getPeerCertificate();
          done({status:secure.authorized?'PASS':'FAIL',stage:'verified-tls-no-auth',authorized:secure.authorized,protocol:secure.getProtocol(),hostnameVerified:!tls.checkServerIdentity(host,certificate),peerFingerprint256:certificate.fingerprint256});
        });
        secure.once('error',e=>done({status:'FAIL',stage:'verified-tls-no-auth',code:e.code}));
      });
    });
  });
  receipt.result=result;
}catch(e){receipt.result={status:'FAIL',stage:'dns',code:e.code||'DNS_UNAVAILABLE'};}
finally {clearTimeout(timer);secure?.destroy();socket?.destroy();receipt.socketsClosed=true;}
await writeFile('tests/n88-official-activation-session-pooler.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
if(receipt.result.status!=='PASS')process.exitCode=1;
