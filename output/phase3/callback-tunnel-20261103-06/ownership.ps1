param([switch]$BeforeHandoff)
$ErrorActionPreference='Stop'
$expected=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'expected-ownership.json') -Raw|ConvertFrom-Json
$backAlive=0;$frontAlive=0;$backChanged=$false;$frontChanged=$false
foreach($row in $expected){
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$row.pid)
 if(-not $p){continue}
 $matches=$p.Name -ceq $row.name -and [int]$p.ParentProcessId -eq [int]$row.parent -and $p.CreationDate.ToUniversalTime().ToString('o') -ceq $row.createdUTC -and $p.CommandLine.Replace('\','/').Contains($row.scriptFragment)
 if($row.role -like 'backend*'){if($matches){$backAlive++}else{$backChanged=$true}}else{if($matches){$frontAlive++}else{$frontChanged=$true}}
}
$cf=@(Get-CimInstance Win32_Process -Filter "Name LIKE '%cloudflared%'")
if($BeforeHandoff -and ($backAlive -ne 2 -or $frontAlive -ne 2 -or $backChanged -or $frontChanged -or $cf.Count -ne 0)){throw 'STOP: exact normal ownership/connector preflight mismatch'}
if($BeforeHandoff){
 $tcp=@(Get-NetTCPConnection -LocalPort 3000,5000 -ErrorAction Stop)
 foreach($item in @(@{port=5000;role='backend'},@{port=3000;role='frontend'})){
  $owner=($expected|Where-Object role -eq $item.role).pid
  if(@($tcp|Where-Object {$_.LocalPort -eq $item.port -and $_.OwningProcess -eq $owner}).Count -eq 0){throw 'STOP: live port/process mapping inconclusive; no handoff'}
  if(@($tcp|Where-Object {$_.LocalPort -eq $item.port -and [int]$_.State -eq 2 -and $_.OwningProcess -ne $owner}).Count){throw 'STOP: unrelated listener; no handoff'}
 }
}
@{backendAbsent=($backAlive -eq 0 -and -not $backChanged);backendAlive=$backAlive;backendChanged=$backChanged;frontendPreserved=($frontAlive -eq 2 -and -not $frontChanged);frontendAlive=$frontAlive;connectorsAbsent=($cf.Count -eq 0);connectors=$cf.Count;portMappingVerified=[bool]$BeforeHandoff}|ConvertTo-Json -Compress
