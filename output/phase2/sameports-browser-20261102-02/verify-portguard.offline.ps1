$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Assert-Phase2BackendPortFree.ps1')
$results=@()
function Check([string]$name,[scriptblock]$read,[string]$expected){
 $actual='PASS'
 try{Assert-Phase2BackendPortFree -ReadListeners $read}catch{$actual=$_.Exception.Message}
 if($actual -ne $expected){throw ('OFFLINE_CASE_FAILED_'+$name)}
 $script:results+=@{name=$name;passed=$true}
}
$occupied='STOP: port5000 occupied; approved normal-backend interruption must happen first'
Check 'empty_snapshot' { @() } 'PASS'
Check 'unrelated_frontend' {New-Object Net.IPEndPoint ([Net.IPAddress]::Loopback),3000} 'PASS'
Check 'ipv4_loopback_busy' {New-Object Net.IPEndPoint ([Net.IPAddress]::Loopback),5000} $occupied
Check 'ipv6_loopback_busy' {New-Object Net.IPEndPoint ([Net.IPAddress]::IPv6Loopback),5000} $occupied
Check 'ipv4_wildcard_busy' {New-Object Net.IPEndPoint ([Net.IPAddress]::Any),5000} $occupied
Check 'ipv6_wildcard_busy' {New-Object Net.IPEndPoint ([Net.IPAddress]::IPv6Any),5000} $occupied
Check 'enumeration_failure' {throw 'synthetic-only'} 'STOP: backend listener enumeration failed'
Check 'invalid_metadata' {'synthetic-only'} 'STOP: invalid backend listener metadata'
Check 'null_metadata' {$null} 'STOP: invalid backend listener metadata'
@{passed=$results.Count;failed=0;skipped=0;databaseConnected=$false;testListenersCreated=$false;results=$results}|ConvertTo-Json -Depth 4|Set-Content (Join-Path $PSScriptRoot 'portguard-offline-result.json')
Write-Output ('PS51_PORTGUARD_OFFLINE_PASS_'+$results.Count)
