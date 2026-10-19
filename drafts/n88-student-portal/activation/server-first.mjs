/** AI: public SCRAM server-first only. No password or client-final API is used. */
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const Connection=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg/lib/connection.js');
export async function serverFirst({ca,salt,iterations}){
 const host='aws-0-ap-south-1.pooler.supabase.com';
 const connection=new Connection({ssl:{ca,rejectUnauthorized:true,servername:host,minVersion:'TLSv1.2'}});
 return await new Promise(resolve=>{
  let finished=false;const nonce=randomBytes(24).toString('base64');
  const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);connection.stream.destroy();resolve({...result,proofSent:false,passwordSent:false,privateQueryExecuted:false});};
  const timer=setTimeout(()=>finish({status:'UNAVAILABLE',code:'timeout'}),8000);
  connection.on('connect',()=>connection.requestSsl());
  connection.on('sslconnect',()=>connection.startup({user:'n88_backend.xlrubcwjqktzzunrvuns',database:'postgres',application_name:'n88-public-challenge'}));
  connection.on('authenticationSASL',m=>{
   if(!m.mechanisms.includes('SCRAM-SHA-256'))return finish({status:'UNAVAILABLE',code:'unexpected_mechanism'});
   connection.sendSASLInitialResponseMessage('SCRAM-SHA-256','n,,n=*,r='+nonce);
  });
  connection.on('authenticationSASLContinue',m=>{
   const fields=m.data.split(',');if(fields.length!==3)return finish({status:'UNAVAILABLE',code:'unexpected_challenge'});
   const parts=Object.fromEntries(fields.map(v=>[v.slice(0,1),v.slice(2)]));
   if(!parts.r?.startsWith(nonce)||!/^\d+$/.test(parts.i??''))return finish({status:'UNAVAILABLE',code:'unexpected_challenge'});
   finish({status:'PASS',announcedIterations:Number(parts.i),expectedStoredIterations:Number(iterations),saltMatchesOwnStoredPublicChallenge:parts.s===salt,strictTls:connection.stream.authorized===true,hostnameVerified:connection.stream.authorized===true});
  });
  for(const event of ['authenticationCleartextPassword','authenticationMD5Password','authenticationOk','authenticationSASLFinal'])connection.on(event,()=>finish({status:'UNAVAILABLE',code:'unexpected_auth_response'}));
  for(const event of ['error','errorMessage'])connection.on(event,e=>finish({status:'UNAVAILABLE',code:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:'transport_error'}));
  connection.on('end',()=>finish({status:'UNAVAILABLE',code:'closed_before_challenge'}));
  connection.connect(5432,host);
 });
}
