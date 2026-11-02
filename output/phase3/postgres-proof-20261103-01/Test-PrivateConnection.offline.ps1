$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Set-PrivateConnection.ps1')
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGPASSFILE','PGHOSTADDR')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'OFFLINE_ENV_MUST_BE_EMPTY'}}
$cases=@('synthetic-ordinary','synthetic:@/?#%&=+','synthetic%40%2525','  synthetic spaces  ',('synthetic-'+[char]0x00E9+[char]0x03A9),"synthetic'`"\[]")
$passed=0
try {
 foreach($value in $cases){
  $secret=ConvertTo-SecureString -String $value -AsPlainText -Force
  try {
   Set-PrivatePhase3Connection -Secret $secret
   if($env:PGPASSWORD -cne $value){throw 'OFFLINE_REFERENCE_MISMATCH'}
   & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'verify-private-url.cjs')
   if($LASTEXITCODE -ne 0){throw 'OFFLINE_URL_EQUIVALENCE_FAILED'}
   $passed++
  } finally {$secret.Dispose();foreach($name in $names){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}}
 }
 foreach($name in @('DATABASE_URL','DIRECT_URL','PGPASSWORD')){
  [Environment]::SetEnvironmentVariable($name,'synthetic-invalid-override','Process')
  $secret=ConvertTo-SecureString -String 'synthetic-reference' -AsPlainText -Force
  $rejected=$false
  try{Set-PrivatePhase3Connection -Secret $secret}catch{$rejected=$true}finally{$secret.Dispose()}
  if(-not $rejected){throw 'OFFLINE_PRECEDENCE_NOT_FAIL_CLOSED'}
  Remove-Item -LiteralPath ('Env:'+$name);$passed++
 }
 $empty=New-Object Security.SecureString
 $rejected=$false;try{Set-PrivatePhase3Connection -Secret $empty}catch{$rejected=$true}finally{$empty.Dispose()}
 if(-not $rejected){throw 'OFFLINE_EMPTY_INPUT_NOT_REJECTED'};$passed++
 @{passed=$passed;failed=0;skipped=0;databaseExecuted=$false;powerShellVersion=$PSVersionTable.PSVersion.ToString()}|ConvertTo-Json -Compress
}finally{foreach($name in $names){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}}
