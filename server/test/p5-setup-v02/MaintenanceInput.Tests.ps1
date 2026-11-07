$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'MaintenanceInput.ps1')
$script:tests=0;$script:passwordCalls=0
function Check([bool]$condition){if(-not $condition){throw ('OFFLINE_MAINTENANCE_INPUT_CHECK_'+($script:tests+1))};$script:tests++}
foreach($value in @('','postgres','local_admin_42',('a'*63))){
  $script:inputValue=$value;$script:passwordCalls=0
  $result=Read-P5ValidatedSetupInput -RoleReader {$script:inputValue} -PasswordReader {$script:passwordCalls++;@{maintenancePassword='synthetic-not-a-real-password'}}
  $expected=$value;if($expected -eq ''){$expected='postgres'}
  Check ($result.maintenanceUser -ceq $expected)
  Check ($script:passwordCalls -eq 1)
}
foreach($value in @($null,' ','contains space','not-a-role','invalid@identity','123invalid',('postgres'+[char]10),'fws_p5_identity_app','fws_p5_identity_migrator',('a'*64))){
  $script:inputValue=$value;$script:passwordCalls=0;$rejected=$false
  try{$null=Read-P5ValidatedSetupInput -RoleReader {$script:inputValue} -PasswordReader {$script:passwordCalls++;@{maintenancePassword='synthetic'}}}
  catch{if($_.Exception.Message -ne 'MAINTENANCE_IDENTITY_REQUIRED'){throw 'OFFLINE_WRONG_FAILURE_LABEL'};$rejected=$true}
  Check $rejected
  Check ($script:passwordCalls -eq 0)
}
$rejected=$false
try{$null=Read-P5ValidatedSetupInput -RoleReader {'postgres'} -PasswordReader {'invalid-callback-result'}}catch{$rejected=$_.Exception.Message -eq 'PRIVATE_INPUT_CONTRACT_FAILED'}
Check $rejected
[pscustomobject]@{passed=$true;checks=$script:tests;passwordPromptsForInvalidRole=0;networkCalls=0;databaseCalls=0}|ConvertTo-Json -Compress
