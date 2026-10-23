# AI: in-memory security descriptor regression only. No filesystem ACL calls.
$ErrorActionPreference='Stop'
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$oldFailed=$false
try {
 $old=New-Object Security.AccessControl.DirectorySecurity
 $old.SetOwner($sid)
 foreach($id in @($sid.Value,'S-1-5-18','S-1-5-32-544')){
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $old.AddAccessRule($rule)
 }
 $null=$old.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
} catch {
 $oldFailed=$_.Exception.InnerException -is [Security.Principal.IdentityNotMappedException]
}
if(!$oldFailed){throw 'Expected original identity translation failure'}
$fixed=New-Object Security.AccessControl.DirectorySecurity
$fixed.SetAccessRuleProtection($true,$false)
$fixed.SetOwner($sid)
foreach($id in @($sid.Value,'S-1-5-18','S-1-5-32-544')){
 $identity=New-Object Security.Principal.SecurityIdentifier($id)
 $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
 $fixed.AddAccessRule($rule)
}
$null=$fixed.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
Write-Output 'PASS: original in-memory SID translation fails; explicit SecurityIdentifier descriptor succeeds; no filesystem ACL calls.'
