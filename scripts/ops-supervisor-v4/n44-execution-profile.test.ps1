param([Parameter(Mandatory=$true)][string]$WrapperPath)
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($WrapperPath,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$node=$ast.Find({param($a) $a -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -eq 'Get-N44ExecutionProfile'},$true)
if(!$node){throw 'Missing scoped profile function'}
. ([scriptblock]::Create($node.Extent.Text))
$t=@{id='continuous-n44-one-approved-closed-page-push-20261019';productId='N44';executionProfile=@{version=1;authorityRef='PO-20261027-N44-ASTRA-SINGLE-WORKER';model='gpt-6-astra';effort='max';serviceTier='priority';fastMode=$true;singleAgent=$true}}
$s=@{taskId=$t.id;sessionId='01a14fcd-032c-7ec0-8b0c-0e0395862c61';model='gpt-6-astra';effort='max'}
$p=Get-N44ExecutionProfile $t $s
if(($p.config -join ',') -ne 'features.fast_mode=true,service_tier=priority,features.multi_agent=false,features.multi_agent_v2=false'){throw 'Wrong N44 process configuration'}
$t.productId='N88';if(((Get-N44ExecutionProfile $t $s).config -join ',') -ne 'features.fast_mode=false'){throw 'Other ticket changed'};$t.productId='N44'
$s.sessionId='another-session';if(((Get-N44ExecutionProfile $t $s).config -join ',') -ne 'features.fast_mode=false'){throw 'Other session changed'};$s.sessionId='01a14fcd-032c-7ec0-8b0c-0e0395862c61'
$s.model='gpt-6.1-sol';$caught=$false;try{Get-N44ExecutionProfile $t $s|Out-Null}catch{$caught=$true};if(!$caught){throw 'Silent model fallback'};$s.model='gpt-6-astra'
$s.effort='ultra';$caught=$false;try{Get-N44ExecutionProfile $t $s|Out-Null}catch{$caught=$true};if(!$caught){throw 'Automatic delegation admitted'};$s.effort='max'
$t.executionProfile=$null;if(((Get-N44ExecutionProfile $t $s).config -join ',') -ne 'features.fast_mode=false'){throw 'Missing PO scope changed default'}
Write-Output 'PASS: PowerShell AST; exact N44 profile; other product/session unchanged; model/Ultra mismatch refused; default unchanged. No Codex process or network trial launched.'
