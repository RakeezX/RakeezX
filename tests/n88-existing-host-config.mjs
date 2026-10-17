/** AI: focused inert/host configuration assertions; no DNS, network or real config. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createExistingHost} from '../drafts/n88-student-portal/existing-host.mjs';
const root='drafts/n88-student-portal/',fn='supabase/functions/n88-student-portal/';
const config={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:'https://synthetic.invalid',N88_AUTH_URL:'https://auth.synthetic.invalid',
  N88_DATABASE_URL:'postgresql://n88_backend:FABRICATED_PASSWORD@db.synthetic.invalid:5432/postgres',
  N88_SERVICE_REVISION:'n88-existing-host-v1',N88_AUTH_API_KEY:'FABRICATED_PUBLIC_KEY',N88_HMAC_KEY:'1'.repeat(64),N88_INGRESS_KEY:'2'.repeat(64)};
let reads=[];const disabled=createExistingHost(name=>{reads.push(name);return undefined;});
assert.equal((await disabled.handle(new Request('https://synthetic.invalid/api/n88/teacher/students'))).status,503);
assert.deepEqual(reads,['N88_ENABLED']);await disabled.close();
for(const patch of [
  {N88_DATABASE_URL:'postgresql://postgres:x@db.synthetic.invalid/postgres'},
  {N88_DATABASE_URL:config.N88_DATABASE_URL+'?sslmode=disable'},
  {N88_SERVICE_REVISION:'wrong'}, {N88_HMAC_KEY:'short'}, {N88_INGRESS_KEY:config.N88_HMAC_KEY},
  {N88_PUBLIC_ORIGIN:'http://synthetic.invalid'}
])assert.throws(()=>createExistingHost(name=>({...config,...patch})[name]));
for(const username of ['n88_backend','n88_backend.abcdefghijklmnopqrst']) {
  const host=createExistingHost(name=>({...config,N88_DATABASE_URL:config.N88_DATABASE_URL.replace('n88_backend:',username+':')})[name]);
  assert.equal(typeof host.handle,'function');await host.close(); // pool is lazy: no DNS/network
}
const pkg=JSON.parse(await readFile(root+'package.json','utf8')),npm=JSON.parse(await readFile(root+'package-lock.json','utf8')),
  deno=JSON.parse(await readFile(fn+'deno.lock','utf8'));
assert.equal(deno.version,'4');
for(const [name,version] of Object.entries(pkg.dependencies)) {
  assert.match(version,/^\d+\.\d+\.\d+$/);
  assert.equal(npm.packages['node_modules/'+name].version,version);
  assert.equal(deno.npm[name+'@'+version].integrity,npm.packages['node_modules/'+name].integrity);
}
const changed=execFileSync('git',['diff','--name-only','faa3cd5c32895148d5220ec9b34dd3f07a82cb5e','--','src/main.js','src/router.js','public/sw.js','package.json','package-lock.json'],{encoding:'utf8'}).trim();
assert.equal(changed,'');
const syntax=[...['runtime','auth-verifier','canonical-adapter','cloudflare-entry','web-entry','web-protocol','existing-host','postgres-repository','service','http-adapter'].map(n=>root+n+'.mjs'),
  'tests/n88-runtime-binding.mjs','tests/n88-existing-host.mjs','tests/n88-existing-host-deno.mjs','tests/n88-existing-host-config.mjs'];
for(const file of syntax)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
await writeFile('tests/n88-existing-host.source-checks.json',JSON.stringify({taskId:'continuous-n88-existing-host-auth-and-current-state-20261018',runId:'5c01ec9b-e0cc-478e-8033-515690fc31f0',
  checkedAt:new Date().toISOString(),checks:[{name:'inactive_existing_host_config_pinned_packages_and_syntax',status:'PASS',evidence:'Disabled entry reads only N88_ENABLED; malformed/admin/SSL-override/same-key configs rejected; lazy direct/Supavisor compositions close without network. Exact npm/Deno package versions and integrity match; v4 lock; affected 14 module syntax checks; no app/startup/SW/root package change.'}]},null,2)+'\n');
console.log('N88 inert config, dependency pins and affected syntax PASS');
