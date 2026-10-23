/** AI: finite authentic-history qualification. No SQL execution or filesystem access. */
import {hash} from './prepare.mjs';
export const fixedMigration={version:'20261023070851',name:'n88_fixed_typed_read_transition',digest:'8e85df7c297b8c99bedd150a6fd28d3e9d8e1c9f0367ef465a7946edd970a96b'};
const fail=c=>{throw Error('n88_typed_history_'+c);};
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function qualifyAuthenticMirror(remote,local){
 if(!Array.isArray(remote)||!remote.length||remote.length>1000||!Array.isArray(local))fail('shape');
 for(let i=0;i<remote.length;i++){
  const r=remote[i];
  if(!r||typeof r.version!=='string'||!/^\d{1,18}$/.test(r.version)||typeof r.name!=='string'||/[\x00-\x1f/\\]/.test(r.name)||r.name.includes('..')||!sha(r.source_digest)||!Number.isInteger(r.statement_count)||r.statement_count<1)fail('authentic_source_unavailable');
  if(i&&remote[i-1].version>=r.version)fail('remote_order');
 }
 if(remote.some(r=>r.version===fixedMigration.version||r.name===fixedMigration.name))fail('already_applied');
 if(remote.at(-1).version>=fixedMigration.version)fail('target_out_of_order');
 if(local.length!==remote.length+1)fail('missing_or_extra');
 for(let i=0;i<remote.length;i++){
  const r=remote[i],l=local[i];if(l?.version!==r.version||l.name!==r.name||l.digest!==r.source_digest)fail('mirror_drift_or_order');
 }
 const target=local.at(-1);if(target?.version!==fixedMigration.version||target.name!==fixedMigration.name||target.digest!==fixedMigration.digest)fail('target_identity');
 return {status:'PASS',remoteCount:remote.length,localCount:local.length,skippedAppliedVersions:remote.map(r=>r.version),historicalSources:remote.map(r=>({version:r.version,sha256:r.source_digest,statementCount:r.statement_count})),orderedHistoryDigest:hash(JSON.stringify(remote)),onlyPending:[fixedMigration.version+'_'+fixedMigration.name+'.sql'],appliedHistoricalFiles:0};
}
export function classifyCliFailure({status,error,stdout='',stderr=''}){
 const text=String(stderr)+'\n'+String(stdout);let category='UNKNOWN_PRIVATE_FAILURE';
 if(error?.code==='ETIMEDOUT')category='TIMEOUT';
 else if(/blocked by policy|operation (?:is )?not allowed|denied by (?:security|tool|policy)|policy (?:reject|deni)/i.test(text))category='POLICY_DENIAL';
 else if(/permission denied|insufficient privilege|42501|\b403\b|forbidden/i.test(text))category='PERMISSION_DENIED';
 else if(/password authentication failed|authentication failed|not authenticated|access token not provided|invalid (?:access token|JWT)|unauthorized|Enter your database password/i.test(text))category='AUTHENTICATION';
 else if(/Remote migration versions not found in local migrations directory/i.test(text))category='MISSING_LOCAL_HISTORY';
 else if(/Found local migration files to be inserted before the last migration/i.test(text))category='OUT_OF_ORDER_HISTORY';
 else if(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ENETUNREACH|failed to connect|connect timeout|connection timed out|network is unreachable|no such host/i.test(text))category='NETWORK';
 else if(/Cannot find project ref|unknown (?:flag|option)|Unexpected argument|invalid configuration|failed to (?:read|parse).*config|config\.toml.*not found/i.test(text))category='CONFIGURATION';
 else if(/SQLSTATE|syntax error|migration.*failed|Error applying migration/i.test(text))category='SQL_FAILURE';
 return {status:'FAIL',exitCode:Number.isInteger(status)?status:null,category,rawDiagnosticsExported:false};
}
export function qualifyCliPlan(parsed,expectedFilename){
 // Output.success's structured envelope is unwrapped by the private CLI adapter.
 if(!parsed||parsed.dryRun!==true||parsed.upToDate!==false||JSON.stringify(parsed.migrations)!==JSON.stringify([expectedFilename])||!Array.isArray(parsed.seeds)||parsed.seeds.length||!Array.isArray(parsed.roles)||parsed.roles.length)fail('cli_plan');
 return {status:'PASS',dryRun:true,onlyPending:[expectedFilename],seeds:0,roles:0,vaultUpdates:0};
}
