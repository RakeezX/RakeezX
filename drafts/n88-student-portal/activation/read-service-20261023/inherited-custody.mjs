/** AI: read-only security metadata, no ACL mutation or module/environment fallback. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const deny=c=>{throw Error('n88_inherited_custody_'+c);};
export function qualifyDescriptor(d,child=false){
 if(!d||Object.keys(d).sort().join(',')!=='aces,ownerSelf,protected,reparse'||d.ownerSelf!==true||d.reparse!==false||d.protected!==!child||!Array.isArray(d.aces)||d.aces.length!==1)deny('descriptor');
 const a=d.aces[0];
 if(!a||Object.keys(a).sort().join(',')!=='access,flags,inherited,principal,propagation,rights'||a.principal!=='SELF'||a.access!==0||a.rights!==2032127||a.flags!==3||a.propagation!==0||a.inherited!==child)deny('access');
 return true;
}
export function qualifyStable(before,after){
 if(!before||!after||typeof before.identity!=='string'||!before.identity||before.identity!==after.identity)deny('identity_changed');
 assert.deepEqual(after.descriptor,before.descriptor,'n88_inherited_custody_descriptor_changed');
 return true;
}
const script=`$ErrorActionPreference='Stop';try{
 $p=[Console]::In.ReadToEnd();$self=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
 $info=New-Object System.IO.DirectoryInfo($p);
 $a=[System.IO.Directory]::GetAccessControl($p,[System.Security.AccessControl.AccessControlSections]::Access -bor [System.Security.AccessControl.AccessControlSections]::Owner);
 $rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]));
 $rows=@(foreach($r in $rules){@{principal=$(if($r.IdentityReference -eq $self){'SELF'}else{'FOREIGN'});rights=[int]$r.FileSystemRights;flags=[int]$r.InheritanceFlags;propagation=[int]$r.PropagationFlags;access=[int]$r.AccessControlType;inherited=[bool]$r.IsInherited}});
 @{ownerSelf=($a.GetOwner([System.Security.Principal.SecurityIdentifier]) -eq $self);protected=[bool]$a.AreAccessRulesProtected;reparse=([bool]($info.Attributes -band [System.IO.FileAttributes]::ReparsePoint));aces=$rows}|ConvertTo-Json -Depth 5 -Compress
 }catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};$code=if($e -is [System.UnauthorizedAccessException]){'ACCESS_DENIED'}elseif($e -is [System.Security.SecurityException]){'SECURITY_DENIED'}elseif($e -is [System.IO.PathTooLongException]){'PATH_TOO_LONG'}else{'READ_API_FAILED'};[Console]::Write($code);exit 1}`;
export async function readSecuritySnapshot(directory,child=false){
 const first=await lstat(directory,{bigint:true});
 if(!first.isDirectory()||first.isSymbolicLink())deny('reparse');
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:directory,windowsHide:true,timeout:15000,maxBuffer:65536});
 try{
  if(r.status!==0){const c=r.stdout.toString().trim();deny(['ACCESS_DENIED','SECURITY_DENIED','PATH_TOO_LONG','READ_API_FAILED'].includes(c)?c.toLowerCase():'read_api_failed');}
  let descriptor;try{descriptor=JSON.parse(r.stdout.toString());}catch{deny('metadata_shape');}
  qualifyDescriptor(descriptor,child);
  const last=await lstat(directory,{bigint:true});
  const identity=s=>[s.dev,s.ino,s.birthtimeNs].join(':');
  if(last.isSymbolicLink()||!last.isDirectory()||identity(first)!==identity(last))deny('identity_changed');
  return {identity:identity(last),descriptor};
 }finally{r.stdout?.fill(0);r.stderr?.fill(0);}
}
export async function createInheritedVerifier({phase,originalRoot,owned}){
 if(!path.resolve(phase).startsWith(path.resolve(originalRoot)+path.sep))deny('parent_scope');
 // Inspect path identities/links only; never enumerate custody contents.
 const ancestors=[];let p=path.resolve(phase),end=path.resolve(originalRoot);
 for(;;){const s=await lstat(p,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink())deny('ancestor_reparse');ancestors.push({p,identity:[s.dev,s.ino,s.birthtimeNs].join(':')});if(p===end)break;p=path.dirname(p);if(p.length<end.length)deny('ancestor_scope');}
 const parent=await readSecuritySnapshot(phase);await owned();
 let child=null;
 return async directory=>{
  await owned();
  for(const a of ancestors){const s=await lstat(a.p,{bigint:true});if(s.isSymbolicLink()||!s.isDirectory()||[s.dev,s.ino,s.birthtimeNs].join(':')!==a.identity)deny('ancestor_changed');}
  qualifyStable(parent,await readSecuritySnapshot(phase));
  if(directory){if(path.dirname(path.resolve(directory))!==path.resolve(phase)||!path.basename(directory).startsWith('typed-read-authentic-history-'))deny('child_scope');const now=await readSecuritySnapshot(directory,true);if(child)qualifyStable(child,now);else child=now;}
  return {parentProtected:true,exactCurrentUserOnly:true,inheritanceVerified:true,childVerified:!!directory,reparseDenied:true,aclWrites:0};
 };
}
