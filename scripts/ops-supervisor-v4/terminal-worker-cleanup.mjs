// Close only a saved terminal CLI turn after a quiet grace period; never dispatch or edit queue/results.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import cp from 'node:child_process';import{pathToFileURL}from'node:url';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),samePath=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
export function terminalTurnProof(q,r,events,{now=Date.now(),logMtime,resultMtime}={}){
 if(q?.status!=='running'||!q.attempt?.runId||r?.taskId!==q.id||r?.runId!==q.attempt.runId||!['LOCAL_READY','BLOCKED','NO_CHANGE'].includes(r.state)||!samePath(r.worktreePath??'',q.worktreePath??''))return null;
 if(!events.length||events.at(-1).type!=='turn.completed'||now-Math.max(logMtime,resultMtime)<120000)return null;
 const pending=new Set();for(const e of events){if(e.type==='item.started')pending.add(e.item?.id);if(['item.completed','item.failed'].includes(e.type))pending.delete(e.item?.id);}if(pending.size)return null;
 if(r.state==='LOCAL_READY'&&(!/^[a-f0-9]{40}$/.test(r.candidateSha??'')||!q.requiredChecks?.every(n=>r.checks?.some(c=>c.name===n&&c.status==='PASS'))))return null;
 return{taskId:q.id,runId:r.runId,state:r.state,candidateSha:r.candidateSha??null,terminal:true,quietGraceSeconds:120,noPendingToolItem:true};
}
export async function cleanupTerminalWorker(taskFile,attemptFile,{operator=false}={}){
 const q=read(taskFile),s=read(attemptFile),root=path.resolve(path.dirname(taskFile),'../../..'),rt=path.join(root,'artifacts','ops-supervisor-v4');
 if(!samePath(taskFile,path.join(rt,'queue',q.id+'.json'))||!samePath(attemptFile,q.attempt?.specPath??'')||s.taskId!==q.id||s.runId!==q.attempt?.runId||s.activationId!==q.activationId||!samePath(s.taskFile,taskFile))throw Error('Current canonical task/attempt mismatch');
 const c=read(q.attempt.checkpointPath);if(c.finishedAt||c.taskId!==q.id||c.runId!==s.runId||c.sessionId!==q.sessionId)return{status:'NOT_ELIGIBLE'};
 if(!operator&&process.ppid!==c.runnerPid)throw Error('Only the exact owning wrapper may request terminal cleanup');
 const logStat=fs.statSync(s.jsonlPath),resultStat=fs.statSync(s.outputPath);if(logStat.size>67108864)throw Error('Terminal event log exceeds bounded read');
 if(Date.now()-Math.max(logStat.mtimeMs,resultStat.mtimeMs)<120000)return{status:'NOT_QUIET'};
 const log=fs.readFileSync(s.jsonlPath),tail=log.subarray(Math.max(0,log.length-4194304)).toString('utf8').split('\n').flatMap(l=>{try{return[JSON.parse(l)]}catch{return[]}}),r=read(s.outputPath);
 const proof=terminalTurnProof(q,r,tail,{logMtime:logStat.mtimeMs,resultMtime:resultStat.mtimeMs});if(!proof)return{status:'NOT_TERMINAL'};
 if(r.state==='LOCAL_READY'){
  const git=(...args)=>cp.execFileSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:q.worktreePath,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  if(git('rev-parse','HEAD')!==r.candidateSha||git('status','--porcelain','--untracked-files=no'))throw Error('Saved completed candidate is no longer clean/current');
 }
 const otherOwners=fs.readdirSync(path.join(rt,'queue')).filter(n=>n.endsWith('.json')).map(n=>read(path.join(rt,'queue',n))).filter(t=>t.id!==q.id&&t.status==='running').flatMap(t=>t.ownedProcesses??[]).map(p=>p.pid);
 const payload={taskFile,run:s.runId,log:s.jsonlPath,logHash:hash(log),resultPath:s.outputPath,resultHash:hash(fs.readFileSync(s.outputPath)),codexPid:c.codexPid,codexCreatedAt:c.codexCreatedAt,wrapper:c.runnerPid,broker:q.brokerPid,historical:(q.ownedProcesses??[]).filter(p=>![c.runnerPid,q.brokerPid].includes(p.pid)&&!(p.name==='conhost.exe'&&[c.runnerPid,q.brokerPid].includes(p.parentPid))),exclude:[...otherOwners,process.pid,process.ppid]},encoded=Buffer.from(JSON.stringify(payload)).toString('base64');
 let proofPath=path.join(path.dirname(attemptFile),'terminal-cleanup-proof.json');if(fs.existsSync(proofPath)){const prior=read(proofPath),outcomePath=path.join(path.dirname(attemptFile),'terminal-cleanup-outcome.json');if(!c.codexExitedAt||!fs.existsSync(outcomePath)||read(outcomePath).status!=='CLEANED_TERMINAL_CHILD'||prior.runId!==s.runId||prior.resultSha256!==payload.resultHash||prior.terminalLogSha256!==payload.logHash)return{status:'ALREADY_ATTEMPTED'};proofPath=path.join(path.dirname(attemptFile),'terminal-cleanup-orphan-proof.json');if(fs.existsSync(proofPath))return{status:'ALREADY_ATTEMPTED'};}
 fs.writeFileSync(proofPath,JSON.stringify({...proof,at:new Date().toISOString(),session:q.sessionId,resultSha256:payload.resultHash,terminalLogSha256:payload.logHash,rootProcess:{pid:c.codexPid,createdAt:c.codexCreatedAt},otherWorkerPidCount:otherOwners.length,wrapperAndBrokerProtected:true,queueWritten:false},null,2)+'\n',{flag:'wx'});
 const script=`
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
function NativeSha([string]$p){$h=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);try{return [BitConverter]::ToString($h.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$h.Dispose()}}
$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json
$q=Get-Content -LiteralPath $v.taskFile -Raw|ConvertFrom-Json
if($q.status -ne 'running' -or $q.attempt.runId -ne $v.run){throw 'Attempt changed'}
if((NativeSha $v.resultPath) -ne $v.resultHash -or (NativeSha $v.log) -ne $v.logHash){throw 'Terminal output changed'}
$rows=@(Get-CimInstance Win32_Process);$known=@{}
foreach($o in $v.historical){
 $registered=@($q.ownedProcesses|Where-Object{$_.pid -eq $o.pid -and $_.createdAt -eq $o.createdAt})
 if($registered.Count -ne 1){continue}
 $live=@($rows|Where-Object{$_.ProcessId -eq $o.pid})
 if($live.Count -eq 1 -and $live[0].CreationDate.ToUniversalTime().Ticks -eq ([DateTime]::Parse($o.createdAt)).ToUniversalTime().Ticks){$known[[int]$o.pid]=$live[0]}
}
$main=@($rows|Where-Object{$_.ProcessId -eq $v.codexPid})
if($main.Count -gt 0){if($main.Count -ne 1 -or $main[0].Name -ne 'codex.exe' -or $main[0].CreationDate.ToUniversalTime().Ticks -ne ([DateTime]::Parse($v.codexCreatedAt)).ToUniversalTime().Ticks){throw 'Codex birth/name changed'};$known[[int]$main[0].ProcessId]=$main[0]}
do{$added=$false;foreach($row in $rows){if(!$known.ContainsKey([int]$row.ProcessId) -and $known.ContainsKey([int]$row.ParentProcessId) -and $row.CreationDate -ge $known[[int]$row.ParentProcessId].CreationDate){$known[[int]$row.ProcessId]=$row;$added=$true}}}while($added)
foreach($row in $known.Values){if($row.ProcessId -eq $v.wrapper -or $row.ProcessId -eq $v.broker -or $v.exclude -contains $row.ProcessId){throw 'Protected/other worker ancestry intersection'}}
$owners=@($known.Values|ForEach-Object{@{pid=[int]$_.ProcessId;createdAt=$_.CreationDate.ToUniversalTime().ToString('o');name=$_.Name}});$stopped=@()
foreach($o in @($owners|Sort-Object @{Expression={if($_.name -eq 'codex.exe'){0}else{1}}})){$live=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$o.pid);if($live){if($live.CreationDate.ToUniversalTime().Ticks -ne ([DateTime]::Parse($o.createdAt)).ToUniversalTime().Ticks){throw 'Descendant birth changed'};Stop-Process -Id ([int]$o.pid);$stopped+=@{pid=$o.pid;name=$o.name}}}
ConvertTo-Json -Compress -InputObject @{status='CLEANED_TERMINAL_CHILD';owners=$owners;stopped=$stopped;wrapperAndBrokerUntouched=$true;queueWritten=$false}
`;
 let output;try{output=cp.execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:20000,stdio:['ignore','pipe','pipe']});}catch(e){fs.writeFileSync(path.join(path.dirname(attemptFile),'terminal-cleanup-error.txt'),e.stderr??'');throw Error('Native terminal cleanup failed before completion; safe diagnostic preserved');}
 fs.writeFileSync(path.join(path.dirname(attemptFile),'terminal-cleanup-outcome.json'),output);return JSON.parse(output);
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length<2||args.length>3||args[2]&&args[2]!=='--operator-reviewed')throw Error('Expected taskFile attemptFile optional --operator-reviewed');
 cleanupTerminalWorker(args[0],args[1],{operator:args[2]==='--operator-reviewed'}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
