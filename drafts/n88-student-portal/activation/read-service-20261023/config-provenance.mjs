/** AI: diagnostic only. No certificate issuance, baseline adoption or provider writes. */
import path from 'node:path';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {hash} from './prepare.mjs';
import {guardCustodyContext} from './custody-preflight.mjs';
const project='xlrubcwjqktzzunrvuns';
const shape=rows=>Array.isArray(rows)&&rows.length>0&&rows.every(r=>typeof r?.name==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(r.name)&&/^[a-f0-9]{64}$/.test(r.digest))&&new Set(rows.map(r=>r.name)).size===rows.length;
export function canonicalMetadata(rows){
 if(!shape(rows))throw Error('n88_typed_provenance_metadata_shape');
 return rows.map(r=>({name:r.name,digest:r.digest})).sort((a,b)=>a.name.localeCompare(b.name));
}
export const nonPinDigest=rows=>hash(JSON.stringify(canonicalMetadata(rows).filter(r=>r.name!=='N88_SERVICE_SOURCE_SHA')));
// A current map never substitutes for a historical map. Missing/extra/changed keys
// stay unresolved; even a complete match is not a deployment certificate.
export function compareHistorical({current,historical,expectedDigest,criticalExpected}){
 const now=canonicalMetadata(current),critical=canonicalMetadata(criticalExpected);
 const criticalFailures=critical.filter(r=>now.find(n=>n.name===r.name)?.digest!==r.digest).map(r=>r.name);
 const baselineValid=shape(historical)&&nonPinDigest(historical)===expectedDigest;
 const old=baselineValid?canonicalMetadata(historical):[];
 const unresolved=now.filter(r=>r.name!=='N88_SERVICE_SOURCE_SHA'&&old.find(n=>n.name===r.name)?.digest!==r.digest).map(r=>r.name);
 const missing=old.filter(r=>r.name!=='N88_SERVICE_SOURCE_SHA'&&!now.some(n=>n.name===r.name)).map(r=>r.name);
 return {baselineValid,criticalFailures,unresolved,missing,certificateIssued:false,eligibleForCertificate:baselineValid&&!criticalFailures.length&&!unresolved.length&&!missing.length};
}
function findHistoricalMaps(value,expectedDigest,out=[],depth=0){
 if(depth>24||value===null||typeof value!=='object')return out;
 if(shape(value)&&nonPinDigest(value)===expectedDigest)out.push(canonicalMetadata(value));
 if(!Array.isArray(value)){
  const entries=Object.entries(value);
  if(entries.length&&entries.every(([k,v])=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)&&typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))){
   const map=entries.map(([name,digest])=>({name,digest}));if(nonPinDigest(map)===expectedDigest)out.push(map);
  }
 }
 for(const v of Object.values(value))findHistoricalMaps(v,expectedDigest,out,depth+1);
 return out;
}
export async function runConfigProvenance({candidate,load,official}){
 const {root,evidence,run,manifest,stamp,card}=await guardCustodyContext(candidate);
 const a=card.preparationAuthority.configurationReconciliation;
 if(a?.readOnlyOriginalCustodian!==true||a.secretValuesExported!==false||a.unknownDriftAccepted!==false||a.configWrites!==0||a.preserveOriginalFailure!==true||a.onlyDocumentedPerKeyProvenance!==true)throw Error('n88_typed_provenance_authority');
 const state=await load();
 if(state.directVerified!==true||state.loginDisarmed||state.directAuthRefused||state.directSource!==manifest.priorNative)throw Error('n88_typed_provenance_custody_preimage');
 if(!Array.isArray(state.sourceCorrections)||state.sourceCorrections.some(r=>r.taskId===stamp.taskId))throw Error('n88_typed_provenance_consumed_history');
 const old=JSON.parse(await readFile(path.join(root,'tests/n88-student-read-phase-latency-20261021/native-pin.json'),'utf8'));
 const expectedDigest=old.provider.otherConfigDigest;
 const raw=await official(['secrets','list','--project-ref',project,'--output','json']);
 const rows=Array.isArray(raw)?raw:raw?.rows;
 const current=canonicalMetadata(rows?.map(r=>({name:r.name,digest:(r.value??r.digest)?.toLowerCase()})));
 const expected={};const origins={};
 const add=(name,value,origin)=>{if(typeof value==='string'){expected[name]=value;origins[name]=origin;}};
 for(const [name,key]of Object.entries({N88_HMAC_KEY:'hmac',N88_NUMERIC_KEY:'numeric',N88_RESERVATION_KEY:'reservation',N88_INGRESS_KEY:'ingress'}))add(name,state[key],'original protected custody.'+key);
 if(typeof state.password==='string')add('N88_DATABASE_URL',`postgresql://n88_backend:${state.password}@db.${project}.supabase.co:5432/postgres`,'original protected password + original install-direct URL');
 add('N88_DATABASE_CA_CERT',await readFile(path.join(process.cwd(),'drafts/n88-student-portal/activation/ca/supabase-prod-ca-2021.crt'),'utf8'),'original installed CA file');
 add('N88_AUTH_URL','https://'+project+'.supabase.co','original fixed project');
 add('N88_PUBLIC_ORIGIN','https://rakeezx.com','original fixed install source');
 add('N88_SERVICE_REVISION','n88-integrated-class-v1','original fixed install source');
 add('N88_SERVICE_SOURCE_SHA',state.directSource,'original protected current source history');
 if(typeof state.recoveryVersion==='string'){
  add('N88_RECOVERY_ACTIVE_VERSION',state.recoveryVersion,'original protected recovery version');
  add('N88_RECOVERY_VERSIONS',state.recoveryVersion,'original protected single-version install');
  add('N88_RECOVERY_KEY_'+state.recoveryVersion,state.recovery,'original protected recovery key');
 }
 if(state.finalRelease?.publicEnabled===true){
  for(const [k,v]of Object.entries({N88_ENABLED:'true',N88_READINESS_ENABLED:'true',N88_ROLLOUT_MODE:'public',N88_PILOT_BINDING:'',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:state.finalRelease.hostedHash,N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'}))add(k,v,'original protected acknowledged final public release');
 }
 try{const config=JSON.parse(await readFile(path.join(process.cwd(),'drafts/n88-student-portal/activation/public-provider-config.json'),'utf8'));if(config.project===project)add('N88_AUTH_API_KEY',config.authPublicKey,'original installed provider public configuration');}catch(e){if(e.code!=='ENOENT')throw Error('n88_typed_provenance_public_config_shape');}
 const maps=findHistoricalMaps(state,expectedDigest);
 // Search only owned configuration/history JSON sidecars, never arbitrary files,
 // credential env files, another worker custody or service account payloads.
 const phase=path.join(process.cwd(),'drafts/n88-student-portal/activation/owned-custody-4ddd5df2-933f-4754-8d04-0d27be47bcff.tmp');
 let sidecars=0;
 for(const f of await readdir(phase,{withFileTypes:true}))if(f.isFile()&&/^(?:config|configuration|baseline|history)[a-z0-9-]*\.json$/.test(f.name)){
  const bytes=await readFile(path.join(phase,f.name));if(bytes.length>1048576)throw Error('n88_typed_provenance_sidecar_bound');findHistoricalMaps(JSON.parse(bytes.toString()),expectedDigest,maps);sidecars++;
 }
 const critical=Object.entries(expected).map(([name,value])=>({name,digest:hash(value)}));
 const comparison=compareHistorical({current,historical:maps[0]??null,expectedDigest,criticalExpected:critical});
 const reconstructed=Object.keys(expected).sort().map(name=>({name,provenance:origins[name],matches:current.find(r=>r.name===name)?.digest===hash(expected[name])}));
 const unreconstructed=current.filter(r=>!(r.name in expected)).map(r=>r.name);
 const result={...stamp,status:'BLOCKED',code:maps.length?'n88_typed_config_provenance_unresolved':'n88_typed_historical_per_key_map_missing',currentWholeConfigDigest:hash(JSON.stringify(current)),currentNonPinConfigDigest:nonPinDigest(current),expectedHistoricalNonPinDigest:expectedDigest,metadataEntries:current.length,baselineSearch:{protectedRecoveryStateAndHistory:true,ownedConfigurationHistorySidecars:sidecars,exactHistoricalMaps:maps.length},reconstructed,unreconstructed,comparison,certificateIssued:false,baselineAdopted:false,configWrites:0,uploads:0,pinUpdates:0,migrations:0,secretValuesExported:false,otherWorkerPrivateMaterialRead:false,remaining:'Exact historical per-key metadata with platform security-sensitive provenance and individually documented authorized differences; current state or N44 hypothesis alone cannot replace it.'};
 await writeFile(path.join(evidence,'config-provenance-'+run+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 // Values and per-key digests never cross this original-custodian process boundary.
 return result;
}
