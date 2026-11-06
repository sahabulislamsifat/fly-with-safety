param([switch]$OwnerApprovedPrivateAuthOnly)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedPrivateAuthOnly){throw 'STOP: separate private correction and endpoint-free authentication approval required'}
$base=$PSScriptRoot;$manifest=Join-Path $base 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '2B5440907A4A67F8B15ABA800F855A2DFBB3C80022D0DB500ED598A80C55DB6A'){throw 'STOP: auth-only manifest mismatch'}
foreach($p in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $p.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $p.sha256){throw 'STOP: auth-only dependency mismatch'}
}
foreach($n in @('owner-attempt.json','auth-process.json','auth-result.json','owner-result.json')){if(Test-Path -LiteralPath (Join-Path $base $n)){throw 'STOP: existing auth-only attempt; no retry'}}
$pkg=Get-AppxPackage ngrok.ngrok
if(-not $pkg -or $pkg.Version -ne '3.39.11.0' -or $pkg.SignatureKind -ne 'Store' -or $pkg.Status -ne 'Ok'){throw 'STOP: reviewed agent package changed'}
$binary=Join-Path $pkg.InstallLocation 'ngrok.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '6CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16'){throw 'STOP: ngrok binary mismatch'}
if(@(Get-CimInstance Win32_Process -Filter "Name='ngrok.exe' OR Name LIKE '%cloudflared%'").Count){throw 'STOP: existing connector/session; no unrelated termination'}
$private=Join-Path $env:LOCALAPPDATA 'FlyWithSafe\ngrok-auth-recovery-20261104-01'
if(Test-Path -LiteralPath $private){throw 'STOP: private destination exists; no overwrite/retry'}
$attempt=[IO.File]::Open((Join-Path $base 'owner-attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
$attempt.Dispose()
$secure=$null;$bstr=[IntPtr]::Zero;$plain=$null;$native=$null;$code=$null;$privateSaved=$false
try {
 $secure=Read-Host 'Copy ONLY Agent Authtoken from ngrok dashboard privately; not API key, command, quotes or SSLCommerz password' -AsSecureString
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 if([string]::IsNullOrEmpty($plain) -or $plain -match '\s|[^\x21-\x7e]' -or $plain -match '^["'']|["'']$' -or $plain -match '^(?i:https?://|ngrok\b|YOUR_TOKEN$|YOUR_AUTHTOKEN$|TOKEN$|REPLACE_ME$|<.*>$)'){throw 'STOP: obvious input-format issue; input not normalized or transmitted; preserve attempt, no retry'}
 New-Item -ItemType Directory -Path $private|Out-Null
 $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=New-Object System.Security.AccessControl.DirectorySecurity
 $acl.SetAccessRuleProtection($true,$false);$acl.SetOwner($sid)
 foreach($identity in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){
  $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $private -AclObject $acl
 $config=Join-Path $private 'ngrok-auth.yml'
 $ErrorActionPreference='Continue'
 try{$native=& $binary config add-authtoken $plain --config $config --log false 2>&1;$code=$LASTEXITCODE}finally{$ErrorActionPreference='Stop';$native=$null;$plain=$null}
 if($code -ne 0){throw 'STOP: private token save failed; preserve state, no retry'}
 $privateSaved=$true
 foreach($entry in (Get-Acl -LiteralPath $config).Access){if($entry.AccessControlType -ne 'Allow' -or $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'STOP: private ACL mismatch'}}
 $ErrorActionPreference='Continue'
 try{$native=& $binary config check --config $config --config (Join-Path $base 'agent-safety.yml') 2>&1;$code=$LASTEXITCODE}finally{$ErrorActionPreference='Stop';$native=$null}
 if($code -ne 0){throw 'STOP: private/safety configuration invalid; no session started'}
 & (Get-Command node -CommandType Application).Source (Join-Path $base 'auth-only.cjs') --owner-approved-auth-only $binary $config
 $code=$LASTEXITCODE
 if($code -ne 0){throw 'STOP: endpoint-free authentication incomplete; preserve evidence, no retry'}
 $result=Get-Content -LiteralPath (Join-Path $base 'auth-result.json') -Raw|ConvertFrom-Json
 if(-not $result.passed -or -not $result.ownedProcessStopped -or $result.publicURLBound){throw 'STOP: auth-only result mismatch'}
 Write-Host 'NGROK_AUTH_ONLY_SESSION_PASS_NO_PUBLIC_ENDPOINT'
} finally {
 $plain=$null;$native=$null
 if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}
 if($secure){$secure.Dispose()}
 @{nativeExit=$code;privateConfigSaved=$privateSaved;publicEndpointRequested=$false;historicalConfigChanged=$false}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $base 'owner-result.json') -Encoding UTF8
}
