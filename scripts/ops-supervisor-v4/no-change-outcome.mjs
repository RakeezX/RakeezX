// AI-authored: classify a saved local NO_CHANGE, never publish or accept Product.
import path from 'node:path';
const SHA=/^[a-f0-9]{40}$/;
const ensure=(ok,message)=>{if(!ok)throw Error(message)};
const norm=p=>path.resolve(p).replaceAll('\\','/').toLowerCase();
const evidencePath=p=>typeof p==='string' && !p.includes('..') && !p.includes('\\') && !/[\x00-\x1f]/.test(p)
  && /^(tests\/|docs\/automation-evidence\/\d{8}\/)/.test(p);
export async function inspectNoChange(task,result,{command,allows}) {
  ensure(result?.state==='NO_CHANGE' && result.taskId===task.id && result.runId===task.attempt?.runId,'No-change task/run mismatch');
  ensure(['local','synthetic'].includes(task.executionMode) && !task.liveMutation && !task.liveAuthorizationRef,'No-change cannot complete a live task');
  ensure(SHA.test(task.baseSha??'') && result.baseSha===task.baseSha && SHA.test(result.candidateSha??''),'No-change base/candidate mismatch');
  ensure(typeof result.worktreePath==='string' && typeof task.worktreePath==='string' && norm(result.worktreePath)===norm(task.worktreePath),'No-change worktree mismatch');
  ensure(result.blockerType==='none' && !result.blocker,'No-change contains an unresolved blocker');
  ensure(Array.isArray(result.changedPaths) && new Set(result.changedPaths).size===result.changedPaths.length,'No-change changedPaths missing/duplicated');
  ensure(result.changedPaths.every(p=>evidencePath(p)&&allows(p,task.allowedPaths??[])),'No-change may change scoped tests/evidence only');
  const git=async args=>{const r=await command('git',args,{cwd:task.worktreePath});ensure(r.code===0,'No-change source verification failed: '+args[0]);return r.stdout.trim()};
  ensure(await git(['rev-parse','HEAD'])===result.candidateSha,'No-change candidate is not actual HEAD');
  await git(['merge-base','--is-ancestor',result.baseSha,result.candidateSha]);
  ensure(!await git(['status','--porcelain=v1','--untracked-files=all']),'No-change worktree has unrecorded changes');
  const changed=(await git(['diff','--name-only','-z','--no-renames',result.baseSha,result.candidateSha,'--'])).split('\0').filter(Boolean);
  ensure(changed.every(p=>evidencePath(p)&&allows(p,task.allowedPaths??[])),'Actual no-change candidate modifies Product or unapproved files');
  ensure(JSON.stringify([...changed].sort())===JSON.stringify([...result.changedPaths].sort()),'No-change receipt differs from actual source diff');
  ensure(Array.isArray(task.requiredChecks)&&task.requiredChecks.length>0&&Array.isArray(result.checks)&&result.checks.length>0,'No-change affected checks are missing');
  ensure(result.checks.every(c=>c&&typeof c.name==='string'&&['PASS','FAIL','NOT_RUN'].includes(c.status)&&typeof c.evidence==='string'&&c.evidence.trim()),'No-change check schema is invalid');
  ensure(new Set(result.checks.map(c=>c.name)).size===result.checks.length,'No-change checks are duplicated');
  const missingChecks=task.requiredChecks.filter(n=>!result.checks.some(c=>c.name===n&&c.status==='PASS'));
  const residualChecks=result.checks.filter(c=>c.status!=='PASS');
  const accepted=missingChecks.length===0&&residualChecks.length===0;
  return {version:1,kind:'local-no-product-change',accepted,
    disposition:accepted?'VERIFIED_NO_CHANGE':'RECORDED_NO_CHANGE_WITH_CHECK_GAPS',taskId:task.id,runId:result.runId,
    candidateSha:result.candidateSha,baseSha:result.baseSha,changedPaths:changed,checks:result.checks,
    missingChecks,residualChecks,productDeployed:false,productTicketClosed:false,poPersonallyTested:false};
}
