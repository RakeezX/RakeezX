// AI: exact owned post-push/pre-install continuation; no filesystem or Git effects.
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const assert=(value,message)=>{if(!value)throw Error('Post-push recovery: '+message);};
export function verifyOwnedPostPushRecovery(current,receiptBytes,previousPayloadBytes) {
 const ref=current.postPushInstallationRecovery,r=JSON.parse(receiptBytes.toString('utf8')),p=JSON.parse(previousPayloadBytes.toString('utf8'));
 assert(ref&&hash(receiptBytes)===ref.receiptSha256&&hash(previousPayloadBytes)===ref.payloadSha256&&r.payloadSha256===ref.payloadSha256,'immutable hashes');
 assert(r.owner==='apply-reviewed-maintenance'&&r.status==='PARTIAL_FAILURE'&&r.taskId===p.taskId&&r.activationId===p.activationId&&p.activationId===current.activationId,'original authority');
 assert(r.committed===true&&r.pushed===true&&/^[a-f0-9]{40}$/.test(r.commit??'')&&r.catalogUpdated===false&&r.runtimeConfigUpdated===false&&r.controllerReloadAttempted===false,'exact post-push phase');
 assert(['installedPaths','activatedTasks','touchedWorkerProcesses','cleanupErrors'].every(k=>Array.isArray(r[k])&&r[k].length===0)&&r.ownedPauseRemoved===true&&r.ownedLockRemoved===true,'no partial installation or retained ownership');
 assert(r.error?.exitCode===128&&r.error.message.includes('ls-remote --heads origin refs/heads/main')&&r.error.stderr.includes("could not read Username for 'https://github.com'")&&!/blocked by policy|access denied/i.test(r.error.stderr),'specific Git readback failure');
 assert(current.requireNoActiveWorkers===true&&p.requireNoActiveWorkers===true&&same(current.allowActiveTaskIds,[])&&same(p.allowActiveTaskIds,[]),'idle guards');
 assert(['repoRoot','opsWorktree','runtimeRoot','sourceCardFile'].every(k=>current[k]===p[k]),'same destinations');
 assert(!current.runtimeConfigUpdate&&!current.controllerReload&&!p.runtimeConfigUpdate&&!p.controllerReload,'no extra operations');
 assert(same(current.files,p.files)&&same(current.cardUpdates,p.cardUpdates),'same reviewed files and exact inactive identities');
 assert(same([...r.opsWrittenPaths].sort(),p.files.map(f=>f.repoPath).sort())&&p.files.every(f=>hash(Buffer.from(f.content))===f.sha256),'exact committed scope');
 return {commit:r.commit,taskId:r.taskId,token:r.token};
}
