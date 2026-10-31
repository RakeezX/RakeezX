/** AI: combined inactive installer; reuses exact qualified predecessor declarations. Never executes SQL. */
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const dir=new URL('./',import.meta.url),read=async f=>(await readFile(new URL(f,dir),'utf8')).replaceAll('\r\n','\n'),sha=s=>createHash('sha256').update(s).digest('hex');
const parent=JSON.parse(await read('../v2-hosted-compat-1031/manifest.json')),base=await read('../v2-hosted-compat-1031/install.inactive.sql'),delta=await read('label-delta.sql');
const body=delta.split('AS $labels$')[1].split('$labels$;')[0];
const files={};for(const p of ['label-delta.sql','labels.mjs','../../publication-v2-canonical.inactive.mjs','../../publication-v2-service.inactive.mjs','../../web-protocol.mjs','../v2-runtime-writer-1031/host.mjs'])files[p]=sha(await read(p));
const bundleSha256=sha(JSON.stringify({parent:parent.bundleSha256,base:sha(base),files}));
const install=base.replaceAll('install-n88-hosted-compat-1031','install-n88-student-scope-1031').replaceAll(parent.bundleSha256,bundleSha256).replace(/COMMIT;\s*$/,()=>delta+'\nCOMMIT;\n');
await writeFile(new URL('install.inactive.sql',dir),install);
const revoke=`REVOKE EXECUTE ON FUNCTION n88_private.safe_student_scope_labels_1031(text) FROM n88_backend;\n`;
const disable=(await read('../v2-hosted-compat-1031/disable.inactive.sql')).replaceAll('disable-n88-hosted-compat-1031','disable-n88-student-scope-1031').replaceAll(parent.bundleSha256,bundleSha256).replace('COMMIT;',revoke+'COMMIT;');
await writeFile(new URL('disable.inactive.sql',dir),disable);
const readback=`select proname,encode(sha256(convert_to(prosrc,'UTF8')),'hex') as body_sha256,prosecdef,proconfig,pg_get_userbyid(proowner) as owner,has_function_privilege('n88_backend',oid,'EXECUTE') as runtime_execute,(has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE')) as public_execute from pg_proc where pronamespace='n88_private'::regnamespace and proname='safe_student_scope_labels_1031';\n`;
await writeFile(new URL('readback.sql',dir),readback+await read('../v2-hosted-compat-1031/readback.sql'));
await writeFile(new URL('manifest.json',dir),JSON.stringify({version:1,aiAuthored:true,enabled:false,hostedExecuted:false,taskId:'continuous-n88-student-scope-source-20261031',runId:'9f046986-1f78-4ad5-a247-397a19fc7e66',baseSha:'5b77024e36f254a6568a0224abb9ea25d78698af',parentBundleSha256:parent.bundleSha256,parentInstallerSha256:sha(base),bundleSha256,files,labelRead:{id:'student-scope-labels-1031',name:'safe_student_scope_labels_1031',bodySha256:sha(body),parameters:['owner:uuid','class:text200','verifiedNumericSession:uuid','currentDate:ISO'],maxRows:2000,maxBytes:2097152},storage14Unchanged:true,additionalPrivateReaders:1,newPublicFunctions:0,installerSha256:sha(install),disableSha256:sha(disable),readbackSha256:sha(readback+await read('../v2-hosted-compat-1031/readback.sql'))},null,2)+'\n');
