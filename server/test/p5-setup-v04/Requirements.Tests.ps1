$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'PasswordInput.ps1')
$script:messages=@();$script:events=@();$checks=0
function Write-Host {param([string]$Object) $script:messages+=,$Object;$script:events+=,'display'}
foreach($field in @('APP','MIGRATOR')){
  $script:messages=@();$script:events=@()
  $value=Read-NewPrivateValue -Field $field -Label 'SYNTHETIC TEST ONLY' -Reader {param($prompt) $script:events+=,'read';'Synthetic-Role-Password-83!'}
  if($value -isnot [string] -or $value -cne 'Synthetic-Role-Password-83!'){throw 'REQUIREMENTS_LEAKED_INTO_PRIVATE_RETURN'};$checks++
  $expected=@('display','display','display','display','display','display','read','display','display','display','display','display','display','read')
  if(($script:events -join ',') -cne ($expected -join ',')){throw 'REQUIREMENTS_NOT_BEFORE_EACH_PROMPT'};$checks++
  foreach($required in @('20-128','NO spaces','LOWERCASE','a-z','UPPERCASE','A-Z','DIGIT','0-9','SYMBOL','different from')){
    if(-not (($script:messages -join "`n").Contains($required))){throw 'MISSING_REQUIREMENT_MESSAGE'};$checks++
  }
  if(($script:messages -join "`n").Contains($value)){throw 'PRIVATE_VALUE_WAS_DISPLAYED'};$checks++
}
$script:messages=@();$script:events=@();$rejected=$false
try{$null=Read-NewPrivateValue -Field MIGRATOR -Label 'SYNTHETIC TEST ONLY' -Reader {param($prompt) $script:events+=,'read';'UPPERCASE-ONLY-PASSWORD-83!'}}catch{$rejected=$_.Exception.Message -eq 'NEW_MIGRATOR_PASSWORD_LOWERCASE_REQUIRED'}
if(-not $rejected){throw 'LOWERCASE_POLICY_CHANGED'};$checks++
if(@($script:events|Where-Object {$_ -eq 'read'}).Count -ne 1){throw 'INVALID_VALUE_REACHED_CONFIRMATION'};$checks++
# Preserve actual PowerShell string -> UTF8/private wire -> Node validator behavior.
$payload=@{maintenanceUser='postgres';maintenancePassword='x';ownerPassword='Synthetic-Owner-Only-Password-73!';appPassword=$value}
$wire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($payload|ConvertTo-Json -Compress)))
$answer=$wire | & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'validate-test-wire.cjs')
if($LASTEXITCODE -ne 0 -or $answer -cne 'SYNTHETIC_WIRE_PASS'){throw 'PRIVATE_WIRE_CONTRACT_FAILED'};$checks++
[pscustomobject]@{passed=$true;checks=$checks;requirementsBeforeEveryNewPrompt=$true;policyUnchanged=$true;networkCalls=0;databaseCalls=0}|ConvertTo-Json -Compress
