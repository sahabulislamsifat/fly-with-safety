$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'PasswordInput.ps1')
$checks=0
$vectors=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'password-vectors.json') -Raw -Encoding UTF8|ConvertFrom-Json
foreach($field in @('APP','MIGRATOR')){
  foreach($item in $vectors){
    $actual=$null
    try{Assert-P5NewPassword -Value $item.value -Field $field}catch{$actual=$_.Exception.Message}
    $expected=$null;if($item.reason){$expected='NEW_'+$field+'_PASSWORD_'+$item.reason}
    if($actual -cne $expected){throw 'OFFLINE_PASSWORD_RULE_MISMATCH'}
    $checks++
  }
}
$script:readerCalls=0
$strong='Synthetic-Owner-Only-Password-73!'
$reader={param($prompt) $script:readerCalls++;'Synthetic-Owner-Only-Password-73!'}
$returned=Read-NewPrivateValue -Field MIGRATOR -Label 'SYNTHETIC TEST ONLY' -Reader $reader
if($returned -cne $strong -or $script:readerCalls -ne 2){throw 'PRIVATE_STRING_RETURN_CONTRACT_FAILED'}
$checks++
$script:readerCalls=0;$caught=$false
try{$null=Read-NewPrivateValue -Field APP -Label 'SYNTHETIC TEST ONLY' -Reader {param($prompt) $script:readerCalls++;'short'}}catch{$caught=$_.Exception.Message -eq 'NEW_APP_PASSWORD_SIZE_POLICY'}
if(-not $caught -or $script:readerCalls -ne 1){throw 'EARLY_NEW_PASSWORD_VALIDATION_FAILED'}
$checks++
# Actual PowerShell prompt-return -> JSON/UTF8/private wire -> Node credential policy.
# Fixed synthetic strings only; never opens a prompt or uses live credentials.
$payload=@{maintenanceUser='postgres';maintenancePassword='x';ownerPassword=$returned;appPassword='Synthetic-App-Only-Password-42!'}
$wire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($payload|ConvertTo-Json -Compress)))
$answer=$wire | & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'validate-test-wire.cjs')
if($LASTEXITCODE -ne 0 -or $answer -cne 'SYNTHETIC_WIRE_PASS'){throw 'PRIVATE_WIRE_CONTRACT_FAILED'}
$checks++
[pscustomobject]@{passed=$true;checks=$checks;maintenanceShortSyntheticAccepted=$true;privateStringRoundtrip=$true;networkCalls=0;databaseCalls=0}|ConvertTo-Json -Compress
