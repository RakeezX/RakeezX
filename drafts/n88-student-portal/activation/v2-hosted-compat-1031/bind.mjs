/** AI: bind exact inactive source only. Never executes SQL or opens a driver. */
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';
const dir=new URL('./',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),text=async u=>(await readFile(u,'utf8')).replaceAll('\r\n','\n');
export async function verifyCombined(){const manifest=JSON.parse(await text(new URL('manifest.json',dir)));for(const [f,h]of Object.entries(manifest.files))if(sha(await text(new URL(f,dir)))!==h)throw Error('n88_combined_source_changed');if(sha(JSON.stringify(manifest.files))!==manifest.bundleSha256)throw Error('n88_combined_bundle_changed');for(const [f,key]of [['install.inactive.sql','installerSha256'],['disable.inactive.sql','disableSha256'],['readback.sql','readbackSha256']])if(sha(await text(new URL(f,dir)))!==manifest[key])throw Error('n88_combined_sql_changed');return manifest;}
export async function bindCombined({operation='install',authorityPath,authoritySha256}={}){
 if(!['install','disable'].includes(operation))throw Error('n88_combined_operation_required');const m=await verifyCombined(),sql=await text(new URL(operation+'.inactive.sql',dir));
 if(!authorityPath)return Object.freeze({inactive:true,execute:false,sql,sha256:sha(sql),bundleSha256:m.bundleSha256});
 const absolute=path.resolve(authorityPath),intake=path.resolve('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence');if(!absolute.toLowerCase().startsWith(intake.toLowerCase()+path.sep))throw Error('n88_original_authority_path_required');
 const bytes=await readFile(absolute);if(sha(bytes)!==authoritySha256)throw Error('n88_authority_changed');const a=JSON.parse(bytes),expiry=Date.parse(a.expiresAt);
 if(a.approved!==true||a.productId!=='N88'||a.action!==operation+'-n88-hosted-compat-1031'||a.projectRef!=='xlrubcwjqktzzunrvuns'||a.bundleSha256!==m.bundleSha256||!a.runId||!a.authorityRef||!(expiry>Date.now()&&expiry<=Date.now()+45*60000))throw Error('n88_exact_combined_authority_required');
 const bound=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(a).replaceAll("'","''")+"'::jsonb;");return Object.freeze({inactive:false,execute:false,sql:bound,sha256:sha(bound),bundleSha256:m.bundleSha256,authoritySha256});
}
