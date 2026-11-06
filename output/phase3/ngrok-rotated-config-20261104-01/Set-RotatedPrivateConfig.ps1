param([switch]$OwnerRequestedPrivateConfigOnly)
$ErrorActionPreference='Stop'
if(-not $OwnerRequestedPrivateConfigOnly){throw 'STOP: private local configuration only switch required'}
$base=$PSScriptRoot
if((Get-FileHash -LiteralPath (Join-Path $base 'pins.json') -Algorithm SHA256).Hash -cne '70EAA171894172E533B148A83C562FBD781C3CB5CF204A6292F163FCBB1D2B98'){throw 'STOP: manifest mismatch'}
foreach($p in (Get-Content -LiteralPath (Join-Path $base 'pins.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $p.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $p.sha256){throw 'STOP: dependency mismatch'}
}
foreach($name in @('attempt.marker','result.json')){if(Test-Path -LiteralPath (Join-Path $base $name)){throw 'STOP: existing configuration attempt; no retry'}}
$pkg=Get-AppxPackage ngrok.ngrok
if(-not $pkg -or $pkg.Version -ne '3.39.11.0' -or $pkg.SignatureKind -ne 'Store' -or $pkg.Status -ne 'Ok'){throw 'STOP: reviewed agent package changed'}
$binary=Join-Path $pkg.InstallLocation 'ngrok.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '6CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16'){throw 'STOP: agent binary mismatch'}
$private=Join-Path $env:LOCALAPPDATA 'FlyWithSafe\ngrok-rotated-config-20261104-01'
if(Test-Path -LiteralPath $private){throw 'STOP: private destination exists; no overwrite'}
$m=[IO.File]::Open((Join-Path $base 'attempt.marker'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$m.Dispose()
. (Join-Path $base 'config-text.ps1')
$secure=$null;$bstr=[IntPtr]::Zero;$plain=$null;$yaml=$null;$quoted=$null;$bytes=$null;$native=$null;$saved=$false;$passed=$false;$exit=$null
try {
 $secure=Read-Host 'NEW ROTATED ngrok Agent Authtoken privately; value only, not command/API key/password' -AsSecureString
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 $yaml=New-PrivateNgrokConfigText -PrivateValue $plain
 New-Item -ItemType Directory -Path $private|Out-Null
 $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=New-Object System.Security.AccessControl.DirectorySecurity
 $acl.SetAccessRuleProtection($true,$false);$acl.SetOwner($sid)
 foreach($identity in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){
  $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $private -AclObject $acl
 $config=Join-Path $private 'ngrok-auth.yml'
 $bytes=(New-Object System.Text.UTF8Encoding($false)).GetBytes($yaml)
 $file=[IO.File]::Open($config,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$file.Write($bytes,0,$bytes.Length)}finally{$file.Dispose()}
 $saved=$true
 if([IO.File]::ReadAllText($config) -cne $yaml){throw 'STOP: private serialized configuration mismatch'}
 foreach($entry in (Get-Acl -LiteralPath $config).Access){if($entry.AccessControlType -ne 'Allow' -or $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'STOP: private ACL mismatch'}}
 $plain=$null;$yaml=$null
 [Array]::Clear($bytes,0,$bytes.Length);$bytes=$null
 # The only native command receives CONFIG FILE PATHS, NEVER the token value.
 $ErrorActionPreference='Continue'
 try{$native=& $binary config check --config $config 2>&1;$exit=$LASTEXITCODE}finally{$ErrorActionPreference='Stop';$native=$null}
 if($exit -ne 0){throw 'STOP: local configuration invalid; preserve private state, no retry'}
 $passed=$true
 Write-Host 'NGROK_ROTATED_PRIVATE_CONFIG_CHECK_PASS_NO_NETWORK'
 Write-Host 'Syntax/ACL only; new token authentication and domain/policy entitlement NOT verified. No session/tunnel/provider call.'
} finally {
 $plain=$null;$yaml=$null;$quoted=$null;$native=$null
 if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}
 if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}
 if($secure){$secure.Dispose()}
 @{passed=$passed;configCheckExit=$exit;privateConfigSaved=$saved;nativeTokenArgument=$false;networkSessionStarted=$false;historicalConfigChanged=$false;publicEndpointStarted=$false}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $base 'result.json') -Encoding UTF8
}
