import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { buildAccountFoundationDefaults } from '../../src/lib/account-provisioning.js';
import { canonical, sha256, fixtureEmail, fixtureMarker, validateManifest, PROJECT_ID, PURPOSE, WINDOW_MS }
  from '../../supabase/functions/ops-n77-fixture/handler-core.mjs';

export const RUN_ID = 'c01776d4-5e12-48bc-96c3-f8e1369bfd59';
export const TASK_ID = 'continuous-n77-real-delete-20261012';
export const PRIVATE = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/capabilities/n77/${RUN_ID}/private`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const URL = `https://${PROJECT_ID}.supabase.co`;
const proof = () => randomBytes(32).toString('base64url');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, windowsHide: true, encoding: 'utf8' }).trim();
const fail = code => Object.assign(new Error(code), { safeCode: code });
export async function readState() { return JSON.parse(await fs.readFile(path.join(PRIVATE, 'state.tmp'), 'utf8')); }
export async function saveState(s) {
  const file = path.join(PRIVATE, 'state.tmp'), temp = file + '.write.tmp';
  await fs.writeFile(temp, JSON.stringify(s, null, 2), { mode: 0o600 }); await fs.rename(temp, file);
}
export async function safeReceipt(s) {
  const receipt = { runId: RUN_ID, taskId: TASK_ID, candidate: s.binding,
    identities: s.accounts.map(({ id, slot }) => ({ id, slot })), fixtureIds: s.fixtureIds,
    retainedClosure:{profileId:'profile',foundation:Object.fromEntries(Object.entries(s.foundation??{}).map(([k,v])=>[k,v.map(r=>r.id)])),
      expectedEffects:s.expectedEffects},
    issuedAt: s.issuedAt, expiresAt: s.expiresAt, functions: s.functions,
    liveDeadline:new Date(Date.parse(s.issuedAt)+45*60*1000).toISOString(),
    events: s.events, liveObservations: s.liveObservations, retirementChecks: s.retirementChecks,
    gate: s.gate, disposition: s.disposition, disarmed: s.disarmed,
    recovery: path.join(PRIVATE, 'state.tmp'), noProductionPublish: true };
  await fs.writeFile(path.join(PRIVATE, 'receipt.tmp'), JSON.stringify(receipt, null, 2));
  return receipt;
}
export async function prepare(previewUrl) {
  if (!/^https:\/\/[a-f0-9]{8}\.rakeezx\.pages\.dev\/?$/.test(previewUrl)) throw fail('EXACT_PREVIEW_REQUIRED');
  if (git('status','--porcelain','--untracked-files=no')) throw fail('COMMITTED_CANDIDATE_REQUIRED');
  const candidateSha = git('rev-parse','HEAD'), baseSha = git('rev-parse','origin/main');
  if (git('merge-base',candidateSha,baseSha) !== baseSha) throw fail('FRESH_MAIN_REQUIRED');
  try { await fs.access(path.join(PRIVATE, 'state.tmp')); throw fail('SAME_RUN_ALREADY_PREPARED'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const relative = path.relative('C:/Users/Abody/Projects/RakeezX', path.join(PRIVATE,'state.tmp'));
  execFileSync('git',['-C','C:/Users/Abody/Projects/RakeezX','check-ignore','--quiet','--',relative],{windowsHide:true});
  await fs.mkdir(PRIVATE,{recursive:true,mode:0o700});
  // Protect only this fresh, task-created secret directory. No existing ACL/policy modification.
  if (process.platform === 'win32') {
    const quoted = "'" + PRIVATE.replaceAll("'","''") + "'";
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      "$ErrorActionPreference='Stop'; $n77Sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; " +
      '& icacls '+quoted+' /inheritance:r /grant:r "${n77Sid}:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null; if ($LASTEXITCODE -ne 0) { throw "PRIVATE_PROTECTION_FAILED" }'],{windowsHide:true});
  }
  const now=Date.now(), source=await fs.readFile(path.join(ROOT,'src/lib/cloud.js'),'utf8');
  const publishableKey=source.match(/const PUBLISHABLE_KEY = '([^']+)';/)[1];
  const token = RUN_ID.replaceAll('-','').slice(0,20);
  const ids = Object.fromEntries(['section','outsideSection','student','secondSubject','note','assignment','submission']
    .map(name=>[name,`n77:${RUN_ID}:${name}:${randomUUID()}`]));
  const termId='tm:y:1448-1449:1', subjectId='sub:digital-skills';
  ids.teachings=[ids.section+'|'+subjectId+'|'+termId,ids.section+'|'+ids.secondSubject+'|'+termId,
    ids.outsideSection+'|'+subjectId+'|'+termId].map(id=>'tch:'+id);
  ids.itemIds=ids.teachings.map(()=>Array.from({length:5},()=>randomUUID()));
  ids.enrollments=[ids.section,ids.outsideSection].map(section=>'en:'+ids.student+':'+section);
  ids.scoreIds=ids.itemIds.map(items=>'sc:'+ids.student+':'+items[1]);
  ids.termId=termId;ids.subjectId=subjectId;ids.yearId='y:1448-1449';
  ids.mutations=Object.fromEntries(['t1','t2','outside','enroll','outsideEnroll','stale','ownerDenied'].map(n=>[n,'n77:'+randomUUID()]));
  const accounts=['A','B'].map(slot=>({slot,id:randomUUID(),email:fixtureEmail(RUN_ID,slot),password:'N77!aA1'+proof()}));
  const files=git('ls-files','src','sw.js').split('\n').map(p=>({path:p,blob:git('rev-parse',`HEAD:${p}`)}));
  const binding={candidateSha,baseSha,treeSha:git('rev-parse','HEAD^{tree}'),previewUrl,
    harnessBlob:git('rev-parse','HEAD:tests/n77-live/gate.mjs'),changedPaths:git('diff','--name-only',baseSha,candidateSha).split('\n'),files};
  const s={runId:RUN_ID,projectId:PROJECT_ID,purpose:PURPOSE,binding,
    issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+WINDOW_MS).toISOString(),
    capabilities:{provision:proof(),'cleanup-only':proof()},accounts,fixtureIds:ids,publishableKey,
    implementationSha256:await sha256(await fs.readFile(path.join(ROOT,'supabase/functions/ops-n77-fixture/handler-core.mjs'),'utf8')),
    fixtureContractSha256:await sha256(canonical(ids)),functions:{provision:'ops-n77-fixture-'+token,'cleanup-only':'ops-n77-retire-'+token},
    foundation:buildAccountFoundationDefaults(),
    tokens:{},events:[],operations:{},gate:'NOT_RUN',disposition:'NOT_RUN',disarmed:false,
    expectedEffects:{selected:'only t1 descendants deleted; Section, t2 and outside survive',final:'Section/t2/enrollment removed; outside/shared student survive',
      retained:'exact synthetic foundations, tombstones, receipts and immutable reports retained; no Auth or Product hard-delete'}};
  await saveState(s);await safeReceipt(s);return {prepared:true,privateState:path.join(PRIVATE,'state.tmp'),binding};
}
export async function manifest(s,mode) {
  return validateManifest({version:1,purpose:PURPOSE,projectId:PROJECT_ID,runId:RUN_ID,mode,
    issuedAt:s.issuedAt,expiresAt:s.expiresAt,capabilitySha256:await sha256(s.capabilities[mode]),
    implementationSha256:s.implementationSha256,fixtureContractSha256:s.fixtureContractSha256,
    accounts:await Promise.all(s.accounts.map(async a=>({slot:a.slot,id:a.id,email:a.email,passwordSha256:await sha256(a.password)})))});
}
export async function bundle(mode,closed=false) {
  const s=await readState();
  const files=closed?[{name:'index.ts',content:await fs.readFile(path.join(ROOT,'supabase/functions/ops-n77-retire/closed-entry.ts'),'utf8')}]:[
    {name:'index.ts',content:await fs.readFile(path.join(ROOT,'supabase/functions/ops-n77-fixture/index.ts'),'utf8')},
    {name:'handler-core.mjs',content:await fs.readFile(path.join(ROOT,'supabase/functions/ops-n77-fixture/handler-core.mjs'),'utf8')},
    {name:'run-manifest.mjs',content:'export default '+JSON.stringify(await manifest(s,mode))+';\n'}];
  return {project_id:PROJECT_ID,name:s.functions[mode],entrypoint_path:'index.ts',verify_jwt:false,files};
}
export async function call(s,mode,operation,slot,extra={}) {
  if(Date.now()>=Date.parse(s.expiresAt))throw fail('CAPABILITY_EXPIRED');
  const key=[mode,operation,slot].join(':');
  if ((s.operations[key]?.attempts??0)>=2) throw fail('SECOND_UNCHANGED_BLOCKER');
  s.operations[key]={attempts:(s.operations[key]?.attempts??0)+1,state:'intent'};await saveState(s);
  const response=await fetch(`${URL}/functions/v1/${s.functions[mode]}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'content-type':'application/json','x-n77-capability':s.capabilities[mode]},
    body:JSON.stringify({version:1,runId:RUN_ID,operation,...(slot?{slot}:{}),...extra})});
  const data=await response.json();
  if(!response.ok||data.ok!==true)throw fail('HANDLER_'+response.status+'_'+data.errorCode);
  if(data.manifestSha256!==await sha256(canonical(await manifest(s,mode))) || data.runId!==RUN_ID || data.projectId!==PROJECT_ID ||
    (slot&&data.fixtureAuthId!==s.accounts.find(a=>a.slot===slot).id))throw fail('HANDLER_BINDING_MISMATCH');
  s.operations[key].state='acknowledged';s.events.push(data);await saveState(s);return data;
}
async function authPost(s,grant,body) {
  const r=await fetch(`${URL}/auth/v1/token?grant_type=${grant}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{apikey:s.publishableKey,'content-type':'application/json','x-supabase-api-version':'2024-01-01'},body:JSON.stringify(body)});
  const data=await r.json();
  data.code??=data.error_code;
  if(data.access_token) {
    // GoTrue may omit expires_at. JWT exp records the residual access window
    // only; the authenticated user and server marker establish identity.
    try {
      const expires=JSON.parse(Buffer.from(data.access_token.split('.')[1],'base64url').toString('utf8')).exp;
      if(Number.isInteger(expires))data.expires_at=expires;
    }catch{ /* Received tokens are still persisted before validation/recovery. */ }
  }
  return {status:r.status,data};
}
export async function operation(op,mode='provision') {
  const s=await readState();
  if(op==='confirm-disarmed') {
    for(const name of Object.values(s.functions)) {
      const r=await fetch(`${URL}/functions/v1/${name}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(r.status!==410||(await r.json()).errorCode!=='N77_CLOSED')throw fail('DISARM_PENDING');
    }
    s.disarmed=true;await saveState(s);await safeReceipt(s);return true;
  }
  if(op==='probe') {
    const data=await call(s,mode,'probe');if(!data.configured)throw fail('ADMIN_CONFIGURATION_UNAVAILABLE');
    s[mode+'ProbedAt']=new Date().toISOString();
  } else if(op==='inspect-absent') {
    for(const a of s.accounts)if((await call(s,'provision','inspect',a.slot)).state!=='absent')throw fail('EXACT_PAIR_NOT_NEW');
  } else if(op==='provision') {
    if(!s['cleanup-onlyProbedAt']||!s.provisionProbedAt)throw fail('BOTH_PROBES_REQUIRED');
    s.createStartedAt=new Date().toISOString();await saveState(s);
    for(const a of s.accounts)await call(s,'provision','ensure',a.slot,{password:a.password});
  } else if(op==='sign-in') {
    for(const context of ['A1','A2','B1']) {
      if(s.tokens[context])continue;
      const a=s.accounts.find(a=>a.slot===context[0]);
      const {status,data}=await authPost(s,'password',{email:a.email,password:a.password});
      // Preserve received tokens before validation, so finally can retire an uncertain response.
      if(data.access_token)s.tokens[context]={...data,ownerVerified:false};await saveState(s);
      if(status!==200||data.user?.id!==a.id||canonical(data.user.app_metadata?.n77)!==canonical(fixtureMarker({runId:RUN_ID},a.slot)))throw fail('AUTH_SESSION_OWNER_NOT_VERIFIED');
      if(!Number.isInteger(data.expires_at)||data.expires_at<=Date.now()/1000)throw fail('TOKEN_EXPIRY_UNAVAILABLE');
      s.tokens[context].ownerVerified=true;
      s.events.push({context,ownerId:a.id,sessionIssued:true,accessJwtExpiry:new Date(data.expires_at*1000).toISOString()});await saveState(s);
    }
  } else if(op==='retire') {
    s.cleanupStartedAt=new Date().toISOString();await saveState(s);const checks=[];
    for(const a of s.accounts) {
      try {
        const inspection=await call(s,'cleanup-only','inspect',a.slot);
        if(inspection.state==='absent'){checks.push({slot:a.slot,absent:true});continue;}
        const token=Object.entries(s.tokens).find(([context,t])=>context[0]===a.slot&&t.access_token)?.[1];
        if(!token) {
          // Recovery after an uncertain create still obtains one exact-owner session before ban.
          const login=await authPost(s,'password',{email:a.email,password:a.password});
          if(login.status!==200||login.data.user?.id!==a.id)throw fail('RETIRE_SESSION_UNAVAILABLE');
          s.tokens[a.slot+'Recovery']={...login.data,ownerVerified:true};await saveState(s);
        }
        const live=token??s.tokens[a.slot+'Recovery'];
        await call(s,'cleanup-only','revoke',a.slot,{accessToken:live.access_token});
        const retained=await call(s,'cleanup-only','retire',a.slot);
        if(retained.state!=='retained_banned')throw fail('BAN_NOT_CONFIRMED');
        const password=await authPost(s,'password',{email:a.email,password:a.password});
        if(password.data.access_token) {s.tokens[a.slot+'UnexpectedPassword']={...password.data,ownerVerified:false};await saveState(s);}
        if(password.status!==400||password.data.code!=='user_banned')throw fail('PASSWORD_DENIAL_NOT_CONFIRMED');
        for(const [context,t] of Object.entries(s.tokens).filter(([c])=>c[0]===a.slot)) {
          const refresh=await authPost(s,'refresh_token',{refresh_token:t.refresh_token});
          if(refresh.data.access_token) {s.tokens[context+'UnexpectedRefresh']={...refresh.data,ownerVerified:false};await saveState(s);}
          if(refresh.status!==400||!['refresh_token_not_found','refresh_token_already_used'].includes(refresh.data.code))throw fail('GLOBAL_REFRESH_REVOCATION_NOT_CONFIRMED');
          checks.push({slot:a.slot,context,refreshDenied:true,authCode:refresh.data.code,status:refresh.status,
            residualAccessUntil:new Date(t.expires_at*1000).toISOString()});
        }
        checks.push({slot:a.slot,passwordDenied:true,bannedUntil:retained.bannedUntil,globalSignOut:true});
      }catch(e){checks.push({slot:a.slot,error:e.safeCode??'RETIRE_UNCERTAIN'});}
    }
    s.retirementChecks=checks;
    s.disposition=checks.some(c=>c.error)?'DISPOSITION_PENDING':'RETAINED_BANNED';
    await saveState(s);await safeReceipt(s);return s.disposition;
  } else throw fail('UNSUPPORTED_OPERATION');
  await saveState(s);await safeReceipt(s);return {ok:true,operation:op};
}
export async function recordGate(result) {const s=await readState();s.gate=result;await saveState(s);await safeReceipt(s);}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,arg]=process.argv.slice(2);
  try {
    const r=command==='prepare'?await prepare(arg):command==='bundle'?await bundle(arg):command==='closed-bundle'?await bundle(arg,true):
      command==='receipt'?await safeReceipt(await readState()):await operation(command,arg);
    process.stdout.write(JSON.stringify(r)+'\n');
  }catch(e){process.stdout.write(JSON.stringify({ok:false,errorCode:e.safeCode??'N77_OPERATION_FAILED'})+'\n');process.exitCode=1;}
}
