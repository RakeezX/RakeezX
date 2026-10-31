/** AI: local source packaging/binding only. No driver, network or SQL executor. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const sha=s=>createHash('sha256').update(s).digest('hex');
const read=async p=>(await readFile(path.join(root,p),'utf8')).replaceAll('\r\n','\n');
const prefix='drafts/n88-student-portal/';
const files=[...['existing-host.mjs','web-entry.mjs','runtime.mjs','cloudflare-entry.mjs','web-protocol.mjs','integrated-service.mjs','auth-verifier.mjs','numeric-credentials.mjs','canonical-adapter.mjs','student-projection.mjs',
 'publication-v2-finite-bridge.inactive.mjs','publication-v2-finite-catalog.inactive.mjs','publication-v2-canonical.inactive.mjs','publication-v2-postgres.inactive.mjs','publication-v2-service.inactive.mjs',
 'activation/private-error-boundary.mjs','activation/database-transport.mjs','activation/v2-package-1028/manifest.json','activation/v2-package-1028/boundary-operations.json',
 'activation/v2-owner-admin-install-20261031/manifest.json'].map(f=>prefix+f),
 ...['capability.mjs','host.mjs','gateway.inactive.mjs','expected-identities.json','runtime-role.sql','writer-helpers.sql','writer-replacement.sql','writer-baseline.json','observed-writer.json','disable.sql','private-log-profile.inactive.sql','package.mjs','gate.sql','post.sql','readback.sql','current-writers.json','additional-participants.json','build-attachment.mjs','gate.template.sql'].map(f=>prefix+'activation/v2-runtime-writer-1031/'+f)];
export async function refreshPackage(){
 const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await read(p))])));
 const bundleSha256=sha(JSON.stringify(hashes));
 const body=(await Promise.all(['runtime-role.sql','writer-helpers.sql','writer-replacement.sql'].map(f=>readFile(path.join(dir,f),'utf8')))).map(s=>s.replaceAll('\r\n','\n')).join('\n');
 const sql=(await readFile(path.join(dir,'gate.sql'),'utf8')).replaceAll('\r\n','\n').replaceAll('_N88_BUNDLE_SHA256_',bundleSha256)+'-- BEGIN EXACT QUALIFIED DELTA\n'+body+'-- END EXACT QUALIFIED DELTA\n'+(await readFile(path.join(dir,'post.sql'),'utf8')).replaceAll('\r\n','\n');
 await writeFile(path.join(dir,'install.inactive.sql'),sql);
 const result={version:1,aiAuthored:true,taskId:'continuous-n88-writer-compatibility-20261031',runId:'13eebd91-b5c1-4135-bafd-d732ce30867f',productId:'N88',baseSha:'55470b978b93efc09602140245b97ea014e6eaf5',
  projectRef:'xlrubcwjqktzzunrvuns',expectedSystemIdentifier:'7678071634733212629',serviceEnabled:false,hostedExecuted:false,storageReinstall:false,
  bundleSha256,installerSha256:sha(sql),files:hashes,
  delta:{existingLogin:'n88_backend',newCredentials:0,newPermanentMemberships:0,newTables:0,newRuntimeFixedExecute:14,newMetadataFunctions:1,newWriterHelpers:3,earlyEntries:30,statementHooks:16,retirementHooks:7,canonicalWritesByN88:0,
   originalBodiesPreserved:'30 current entries: identical original bodies nested in early-lock outer blocks; original invoker/definer/defaults/config/ACL/OIDs preserved; 16 backing chains unchanged; no new backing access',
   temporaryOwnerAdminEdge:'postgres -> n88_v2_guard, own grantor SET-only edge; removed in same transaction; mandatory creator edge retained',rawTableGrants:0,privateRoleProfile:'terse/no parameters/no statement-duration-sampling/audit/explain logging required on actual restricted LOGIN'},
  activation:{serverFlag:'N88_PUBLICATION_V2_ENABLED',default:false,teachingSelection:'N88_PUBLICATION_V2_TEACHING_ID',publicGateway:'gateway.inactive.mjs composes original legacy gateway with exactly two server-gated signed routes; deployment not performed'},
  gates:{installationAuthority:null,actualRestrictedHostedLogin:'NOT_RUN',actualHostedWriterReadback:'NOT_RUN',actualHostedTeacherStudentJourney:'NOT_RUN'}};
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify(result,null,2)+'\n');return result;
}
export async function verifyPackage(){
 const m=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
 for(const [p,h]of Object.entries(m.files))if(sha(await read(p))!==h)throw Error('n88_runtime_writer_source_changed');
 const sql=(await readFile(path.join(dir,'install.inactive.sql'),'utf8')).replaceAll('\r\n','\n');
 if(sha(sql)!==m.installerSha256||sha(JSON.stringify(m.files))!==m.bundleSha256)throw Error('n88_runtime_writer_packet_changed');return {manifest:m,sql};
}
export async function bindPackage({authorityPath,authoritySha256,operation='install'}={}){
 if(!['install','disable','privacy'].includes(operation))throw Error('n88_exact_package_operation_required');
 const verified=await verifyPackage(),m=verified.manifest;
 const sql=operation==='install'?verified.sql:(await readFile(path.join(dir,operation==='disable'?'disable.sql':'private-log-profile.inactive.sql'),'utf8')).replaceAll('\r\n','\n').replaceAll('_N88_BUNDLE_SHA256_',m.bundleSha256);
 if(!authorityPath)return {inactive:true,sql,sha256:sha(sql)};
 const absolute=path.resolve(authorityPath),intake=path.resolve('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence');
 if(!absolute.toLowerCase().startsWith(intake.toLowerCase()+path.sep))throw Error('n88_original_authority_path_required');
 const bytes=await readFile(absolute);if(sha(bytes)!==authoritySha256)throw Error('n88_runtime_writer_authority_changed');const a=JSON.parse(bytes);
 if(a.approved!==true||a.productId!=='N88'||a.action!==operation+'-n88-runtime-writer-1031'||a.projectRef!==m.projectRef||a.bundleSha256!==m.bundleSha256||!a.authorityRef||!a.runId||
  !(Date.parse(a.expiresAt)>Date.now()&&Date.parse(a.expiresAt)<=Date.now()+45*60000))throw Error('n88_exact_runtime_writer_authority_required');
 const bound=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(a).replaceAll("'","''")+"'::jsonb;");
 return Object.freeze({inactive:false,sql:bound,sha256:sha(bound),authoritySha256,bundleSha256:m.bundleSha256,execute:false});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv[2]!=='--refresh')throw Error('n88_local_package_refresh_only');const m=await refreshPackage();console.log(JSON.stringify({bundleSha256:m.bundleSha256,installerSha256:m.installerSha256,execute:false}));
}
