/** AI-authored. In-memory/read-only diagnostic; never applies an ACL. */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const code=`try {
 $n88Acl=New-Object System.Security.AccessControl.DirectorySecurity
 $n88Acl.SetAccessRuleProtection($true,$false)
 $n88Identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
 $n88Rule=New-Object System.Security.AccessControl.FileSystemAccessRule($n88Identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
 $n88Acl.AddAccessRule($n88Rule)
 Write-Output 'IN_MEMORY_DESCRIPTOR_PASS'
} catch { Write-Output ($_.Exception.GetType().FullName); Write-Output ($_.Exception.Message); exit 1 }`;
const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,encoding:'utf8',timeout:10000});
console.log(JSON.stringify({exit:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?.code,aclWrites:0}));
const phase=path.resolve('drafts/n88-student-portal/activation/owned-custody-1b9971f9-e3ae-4e07-9d05-52923064dd91.tmp');
const readOnly=`try { $n88Dir=[Console]::In.ReadToEnd(); $n88Present=Test-Path -LiteralPath $n88Dir -PathType Container; if($n88Present){$n88Acl=Get-Acl -LiteralPath $n88Dir; @{inputLength=$n88Dir.Length;present=$n88Present;protected=$n88Acl.AreAccessRulesProtected;ruleCount=@($n88Acl.Access).Count}|ConvertTo-Json -Compress}else{@{inputLength=$n88Dir.Length;present=$false}|ConvertTo-Json -Compress} }catch{Write-Output ($_.Exception.GetType().FullName); Write-Output ($_.Exception.Message);exit 1}`;
const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',readOnly],{input:phase,windowsHide:true,encoding:'utf8',timeout:10000});
console.log(JSON.stringify({exit:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.code,aclWrites:0}));
