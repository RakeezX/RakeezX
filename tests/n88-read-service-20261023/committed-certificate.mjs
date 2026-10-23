/** AI: owned disposable Git fixture; no provider, browser, credentials or global config. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {committedCertificateBytes,certificatePath} from '../../drafts/n88-student-portal/activation/read-service-20261023/committed-certificate.mjs';
const parent=fileURLToPath(new URL('.',import.meta.url)),owned=path.join(parent,'owned-certificate-git-'+randomUUID()+'.tmp');
const git=args=>execFileSync('git',args,{cwd:owned,stdio:['ignore','pipe','pipe']}).toString().trim();
try{
 await mkdir(path.join(owned,path.dirname(certificatePath)),{recursive:true});git(['init']);
 const commit=()=>git(['-c','user.name=AI synthetic fixture','-c','user.email=ai-fixture@localhost','commit','--allow-empty','-m','AI synthetic certificate fixture']);
 commit();const initial=git(['rev-parse','HEAD']);
 assert.throws(()=>committedCertificateBytes(owned,initial),/missing/);
 const bytes=Buffer.from('{"synthetic":true}\n');await writeFile(path.join(owned,certificatePath),bytes);
 assert.throws(()=>committedCertificateBytes(owned,initial),/uncommitted/);
 git(['add','--',certificatePath]);commit();const committed=git(['rev-parse','HEAD']);
 assert.equal(git(['show',committed+':'+certificatePath,'--']),bytes.toString().trim());
 assert.deepEqual(committedCertificateBytes(owned,committed),bytes);
 assert.throws(()=>committedCertificateBytes(owned,initial),/head/);
 await writeFile(path.join(owned,certificatePath),'{"tampered":true}\n');
 assert.throws(()=>committedCertificateBytes(owned,committed),/uncommitted/);
}finally{
 if(path.dirname(owned)!==path.resolve(parent)||!path.basename(owned).startsWith('owned-certificate-git-'))throw Error('cleanup ownership');
 await rm(owned,{recursive:true});
}
await writeFile(new URL('./committed-certificate-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',checks:['missing denied','untracked denied','exact committed blob accepted','stale revision denied','modified certificate denied'],ownedGitFixtureRemoved:true,providerOperations:0},null,2)+'\n');
console.log('PASS: actual Git committed-certificate boundaries and owned cleanup.');
