param([ValidateSet('BeforeHandoff','AfterStop','BeforeRestore')][string]$Phase)
$ErrorActionPreference='Stop'
$expected=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'expected-ownership.json') -Raw|ConvertFrom-Json
$alive=@()
foreach($row in $expected){
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$row.pid)
 if($p){
  $matches=$p.Name -ceq $row.name -and [int]$p.ParentProcessId -eq [int]$row.parent -and $p.CreationDate.ToUniversalTime().ToString('o') -ceq $row.createdUTC -and $p.CommandLine.Replace('\','/').Contains($row.scriptFragment)
  if(-not $matches){throw 'STOP: ownership changed; no process action permitted'}
  $alive+=$row.role
 }
}
$connectors=@(Get-CimInstance Win32_Process -Filter "Name LIKE '%cloudflared%'")
if($connectors.Count -ne 0){throw 'STOP: connector exists; normal5000 restoration/public launch blocked'}
if($Phase -eq 'BeforeHandoff' -and $alive.Count -ne 3){throw 'STOP: all three original owned processes required'}
if($Phase -ne 'BeforeHandoff' -and $alive.Count -ne 0){throw 'STOP: original shutdown incomplete; no automatic termination'}
@{ok=$true;phase=$Phase;originalAlive=$alive.Count;connectors=0}|ConvertTo-Json -Compress
