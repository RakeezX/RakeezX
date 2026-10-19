// Correct a literal publisher selector on the exact never-started N36 card.
export function verifyPristineN36Verification(task, update, actualSha256) {
  const {card, expected:e, pendingVerificationCorrection:p} = update;
  const insist=(ok,message)=>{if(!ok)throw Error(message);};
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  insist(p?.version===1 && task.id==='continuous-n36-one-start-complete-madrasati-20261019' && card.id===task.id && task.productId==='N36' && card.productId===task.productId && task.activationId===card.activationId,'Wrong N36 selector identity');
  insist(task.status==='pending' && !task.attempt && !task.worktreePath && !task.runnerPid && !task.brokerPid && !task.sessionId && !task.candidateSha,'N36 card has started');
  insist(e.status==='pending' && e.sessionId===null && e.lastRunId===null && e.candidateSha===null && e.queueSha256===actualSha256,'Pending preimage changed');
  insist(same(task.verificationPaths,['extensions/**']) && same(card.verificationPaths,['src/views/class-import-center.js','src/views/teachings.js']),'Only the exact invalid literal selector may change');
  insist(Object.entries(card).every(([key,value])=>key==='verificationPaths'||same(value,task[key])),'Other source field changed');
  return true;
}
