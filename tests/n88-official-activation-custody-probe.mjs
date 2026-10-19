/** AI: noninteractive throwaway handoff probe. Only DPAPI-encrypted recipient persists. */
import {generateKeyPairSync,privateDecrypt,constants,createPrivateKey} from 'node:crypto';
import {readFile,writeFile,mkdir,unlink,rmdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const runId='8698a850-ff9c-488d-8516-328eed2c356d';
const phase=path.resolve('tests/fixtures/n88-official-activation/owned-'+runId+'.tmp');
const marker={runId,purpose:'throwaway-rsa-recipient-only',phase};
function dpapi(bytes,protect){
 // Sensitive bytes traverse anonymous child-process pipes only, never argv/output to tools.
 const script=`Add-Type -AssemblyName System.Security; $m=New-Object System.IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($m); $b=$m.ToArray(); $r=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Array]::Clear($b,0,$b.Length); [Console]::Write([Convert]::ToBase64String($r)); [Array]::Clear($r,0,$r.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:65536});
 if(r.status!==0)throw Error('Current-user DPAPI operation failed; private diagnostics suppressed');
 const result=Buffer.from(r.stdout.toString('utf8').trim(),'base64');r.stdout.fill(0);return result;
}
if(process.argv[2]==='--prepare'){
 await mkdir(phase,{recursive:false});await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
 try{
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537});
  const encoded=privateKey.export({format:'der',type:'pkcs8'});let protectedBytes;
  try{protectedBytes=dpapi(encoded,true);}finally{encoded.fill(0);}
  await writeFile(path.join(phase,'recipient.dpapi'),protectedBytes,{flag:'wx'});protectedBytes.fill(0);
  console.log(JSON.stringify({publicJwk:publicKey.export({format:'jwk'}),phase,protection:'DPAPI CurrentUser; ignored owned directory; no plaintext file'}));
 }catch(e){await unlink(path.join(phase,'owner.json'));await rmdir(phase);throw e;}
}else if(process.argv[2]==='--finish'){
 const report={aiAuthored:true,taskId:'continuous-n88-official-student-portal-activation-20261018',runId,at:new Date().toISOString(),algorithm:'RSA-OAEP',hash:'SHA-256',modulusBits:3072,providerWrites:0,actualServiceSecretsProvisioned:0,plaintextOrPrivateKeyPersisted:false,checks:[],cleanup:{}};
 let owned=false,privateBytes,plaintext;
 try{
  assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);owned=true;
  privateBytes=dpapi(await readFile(path.join(phase,'recipient.dpapi')),false);
  const privateKey=createPrivateKey({key:privateBytes,format:'der',type:'pkcs8'});privateBytes.fill(0);
  assert.match(process.argv[3],/^[A-Za-z0-9+/]+={0,2}$/);const encrypted=Buffer.from(process.argv[3],'base64');assert.equal(encrypted.length,384);
  plaintext=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},encrypted);
  const p=JSON.parse(plaintext.toString('utf8'));assert.equal(p.version,1);assert.equal(p.purpose,'n88-throwaway-custody-probe');
  assert.ok(Array.isArray(p.ephemeral)&&p.ephemeral.length===32&&p.ephemeral.every(x=>Number.isInteger(x)&&x>=0&&x<=255)&&new Set(p.ephemeral).size>1);
  encrypted[0]^=1;assert.throws(()=>privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},encrypted));p.ephemeral.fill(0);
  report.checks.push({name:'actual_provider_webcrypto_to_local_dpapi_recipient',status:'PASS',evidence:'Actual native Cloudflare sandbox CSPRNG32-byte throwaway encrypted to3072-bit RSA-OAEP/SHA-256 recipient. Only public JWK and ciphertext crossed tool boundary. CurrentUser DPAPI protected private recipient; local decrypt validated envelope and rejected tampering. No provider writes or actual service secret provisioning.'});
 }catch{report.failure='Encrypted handoff validation failed; private values suppressed';process.exitCode=1;}
 finally{
  privateBytes?.fill(0);plaintext?.fill(0);
  if(owned){await unlink(path.join(phase,'recipient.dpapi'));await unlink(path.join(phase,'owner.json'));await rmdir(phase);report.cleanup={ownedEncryptedRecipientRemoved:true,ownedDirectoryRemoved:true,privateMaterialLifetime:'local process memory plus temporary DPAPI ciphertext only'};}
  await writeFile('tests/n88-official-activation-custody-probe.json',JSON.stringify(report,null,2)+'\n');
 }
 console.log(report.failure?'N88 throwaway custody FAIL; sanitized report':'N88 throwaway custody PASS; owned encrypted recipient cleaned');
}else throw Error('Use --prepare or --finish <public ciphertext>');
