// AI-authored: exact previously admitted child/custodian binding, not a general path exception.
import path from 'node:path';
const child='continuous-n44-two-mobile-actual-trial-20261028', parent='continuous-n44-one-approved-closed-page-push-20261019', front='continuous-n44-disclosure-frontend-delivery-20261028';
const session='01a14fcd-032c-7ec0-8b0c-0e0395862c61', grant='60fc7d23-8c87-4d8b-b97f-d9c9e289af94';
const equalPath=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifiedN44MobileOwnedWorktree({task,owner,delivery,update,root,ownerSha256,deliverySha256,frontendVerified}) {
  const p=update?.n44OriginalWorktreeProof,c=update?.card;
  if(!p||p.version!==1||p.ownerTaskId!==parent||p.frontendTaskId!==front||p.ownerQueueSha256!==ownerSha256||p.frontendQueueSha256!==deliverySha256||!frontendVerified)return false;
  if(task?.id!==child||c?.id!==child||owner?.id!==parent||delivery?.id!==front||task.status!=='blocked'||owner.status!=='blocked'||!['awaiting_po','closed'].includes(delivery.status))return false;
  if([task,owner,delivery].some(t=>t.productId!=='N44'||t.activationId!=='po-20261012-continuous'||t.sessionId!==session))return false;
  if(!equalPath(task.worktreePath,path.win32.join(root,'.worktrees',parent))||!equalPath(owner.worktreePath,task.worktreePath))return false;
  if(task.executionProfile?.originalTaskId!==parent||task.executionProfile?.originalSession!==session||task.liveAuthorizationRef?.grantId!==grant||task.liveAuthorizationRef?.sha256!=='686833f6c45c59c0d528228c537a587d63a07d160778675878d10f08d0c5e959')return false;
  if(!c.dependsOn?.includes(front)||!['allowedPaths','requiredChecks','liveMutation','liveAuthorizationRef','executionMode','scopeKey','executionProfile','model','effort'].every(k=>same(c[k],task[k])))return false;
  const asset='612a79f6af151ff061ef9856a59caa1be27020024d3e331c14fd9c3244ea2778';
  if(!['immutable','production'].every(k=>delivery.deliveryReceipt?.evidence?.[k]?.assets?.some(a=>a.repoPath==='src/views/notification-settings.js'&&a.verified===true&&a.expectedSha256===asset&&a.observedSha256===asset)))return false;
  return true;
}
