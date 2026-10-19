/** AI: focused pg SCRAM protocol regression, no sockets, hosted data or raw proof output. */
import {createRequire} from 'node:module';
import {randomBytes,pbkdf2Sync,createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {expectedKeys} from '../scripts/n44-activation-equality.mjs';
import {deriveScram} from '../scripts/n44-activation-custody.mjs';
const sasl=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg/lib/crypto/sasl.js');
const hash=b=>createHash('sha256').update(b).digest(),hmac=(k,s)=>createHmac('sha256',k).update(s).digest();
const password=randomBytes(32).toString('hex'),salt=randomBytes(16);
async function exchange(storedIterations,clientPassword){
 const session=sasl.startSession(['SCRAM-SHA-256']);
 const nonce=session.clientNonce+randomBytes(18).toString('base64');
 const first=`r=${nonce},s=${salt.toString('base64')},i=4096`;
 await sasl.continueSession(session,clientPassword,first);
 const finalWithoutProof=`c=biws,r=${nonce}`,auth=`n=*,r=${session.clientNonce},${first},${finalWithoutProof}`;
 const salted=pbkdf2Sync(password,salt,storedIterations,32,'sha256'),clientKey=hmac(salted,'Client Key'),storedKey=hash(clientKey),signature=hmac(storedKey,auth);
 const current=expectedKeys(password,{salt:salt.toString('base64'),iterations:String(storedIterations)});
 if(!timingSafeEqual(current.stored,storedKey)||!timingSafeEqual(current.server,hmac(salted,'Server Key')))throw Error('n44_current_equality_contract');
 current.stored.fill(0);current.server.fill(0);
 const proof=Buffer.from(session.response.split(',p=')[1],'base64'),recovered=Buffer.from(proof.map((b,i)=>b^signature[i]));
 try{return timingSafeEqual(hash(recovered),storedKey);}
 finally{for(const b of [salted,clientKey,storedKey,signature,proof,recovered])b.fill(0);}
}
const report={aiAuthored:true,runId:'3edbd211-f3f1-4698-b39c-eaf346722eb5',recordedAt:new Date().toISOString(),scope:'pg native SCRAM client plus server proof verification in memory only',hostedOperations:0,privateValuesReturned:false};
try{
 report.stored16384Announced4096Rejected=!(await exchange(16384,password));
 report.samePasswordSaltStored4096Announced4096Accepted=await exchange(4096,password);
 report.wrongPasswordRejected=!(await exchange(4096,'0'.repeat(64)===password?'1'.repeat(64):'0'.repeat(64)));
 report.futureProvisioningDefault4096=deriveScram(password,salt).startsWith('SCRAM-SHA-256$4096:');
 report.historical16384Explicit=deriveScram(password,salt,16384).startsWith('SCRAM-SHA-256$16384:');
 if(!report.stored16384Announced4096Rejected||!report.samePasswordSaltStored4096Announced4096Accepted||!report.wrongPasswordRejected||!report.futureProvisioningDefault4096||!report.historical16384Explicit)throw Error('n44_protocol_regression');
 report.status='PASS';
}catch{report.status='FAIL';report.failure='n44_protocol_regression_private_details_suppressed';process.exitCode=1;}
finally{salt.fill(0);report.sourceSha256=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');await writeFile('tests/n44-finish-iteration-protocol.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
