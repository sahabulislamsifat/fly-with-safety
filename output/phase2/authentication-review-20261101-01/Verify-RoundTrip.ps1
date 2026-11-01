$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Native Windows PowerShell 5.1 required'}
$names=@('PHASE2_OFFLINE_ROUNDTRIP_SECRET','PHASE2_OFFLINE_ROUNDTRIP_URL')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'Offline test variables must be empty'}}
# Synthetic strings only. No Read-Host, environment-file loading or database connection.
$samples=@(
 'synthetic-simple-123',
 'A@b:c/d?e#f%g+h&i=j',
 '%40%25%2F%3A',
 ('A'+[char]39+[char]34+[char]96+[char]36+'Z'),
 ' leading and trailing ',
 'A%2f%ZZ%tail',
 ('A'+[char]0x00E9+[char]0x09AC+[char]0x09BE+'Z'),
 ('A'+[char]0x0065+[char]0x0301+'Z'),
 ('A'+[char]0x00A0+'Z'),
 ('@:%/+#?[]' * 24)
)
$passed=0
try {
 foreach($sample in $samples){
  $secure=ConvertTo-SecureString -String $sample -AsPlainText -Force
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
   $env:PHASE2_OFFLINE_ROUNDTRIP_SECRET=$sample
   $env:PHASE2_OFFLINE_ROUNDTRIP_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr))+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration'
   $safeOutput=& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'check-roundtrip.cjs')
   if($LASTEXITCODE -ne 0){throw 'Synthetic credential round-trip failed; no sample values emitted'}
   $row=$safeOutput | ConvertFrom-Json
   if(-not $row.passed -or $row.pathsChecked -ne 3){throw 'Offline result invalid'}
   $passed++
  } finally {
   [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
   $secure.Dispose()
  }
 }
 $result=@{passed=$true;powerShell=$PSVersionTable.PSVersion.ToString();syntheticCases=$passed;connectionPathsChecked=($passed*3);databaseConnections=0;actualCredentialsRead=$false;scope='offline-construction-only'}
 $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'roundtrip-result.json') -Encoding UTF8
 $result | ConvertTo-Json -Compress
} finally {
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
}
