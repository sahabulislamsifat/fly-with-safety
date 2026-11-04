param([switch]$ConfigurePrivateAgentAuthOnly)
$ErrorActionPreference='Stop'
if(-not $ConfigurePrivateAgentAuthOnly){throw 'STOP: private agent-auth configuration only switch required'}
$pkg=Get-AppxPackage -Name ngrok.ngrok
if(-not $pkg -or $pkg.Version -ne '3.39.11.0' -or $pkg.SignatureKind -ne 'Store' -or $pkg.Status -ne 'Ok'){throw 'STOP: reviewed Store package changed'}
$binary=Join-Path $pkg.InstallLocation 'ngrok.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '6CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16'){throw 'STOP: reviewed agent hash changed'}
$alias=(Get-Command ngrok.exe -CommandType Application).Source
$private=Join-Path $env:LOCALAPPDATA 'FlyWithSafe\ngrok-sandbox-20261103-01'
if(Test-Path -LiteralPath $private){throw 'STOP: private authentication directory already exists; inspect privately, no overwrite/retry'}
if([Environment]::GetEnvironmentVariable('NGROK_AUTHTOKEN','Process')){throw 'STOP: process token already set; do not replace credentials'}
$config=Join-Path $private 'ngrok-auth.yml'
$secure=$null;$bstr=[IntPtr]::Zero;$plain=$null;$nativeOutput=$null
try {
 $secure=Read-Host 'ngrok AGENT AUTHTOKEN privately; not SSLCommerz or database password' -AsSecureString
 if($secure.Length -lt 1){throw 'STOP: empty token; no configuration written'}
 New-Item -ItemType Directory -Path $private -ErrorAction Stop|Out-Null
 $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=New-Object System.Security.AccessControl.DirectorySecurity
 $acl.SetAccessRuleProtection($true,$false)
 $acl.SetOwner($sid)
 foreach($identity in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){
  $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $private -AclObject $acl
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 # Value is never typed into command history, logged, returned or placed in repo.
 # CLI necessarily receives the token transiently as a native process argument.
 $ErrorActionPreference='Continue'
 try { $nativeOutput=& $alias config add-authtoken $plain --config $config --log false 2>&1; $code=$LASTEXITCODE }
 finally { $ErrorActionPreference='Stop' }
 $plain=$null;$nativeOutput=$null
 if($code -ne 0){throw 'STOP: private token save failed; preserve private state, no retry'}
 $ErrorActionPreference='Continue'
 try { $nativeOutput=& $alias config check --config $config 2>&1; $code=$LASTEXITCODE }
 finally { $ErrorActionPreference='Stop' }
 $nativeOutput=$null
 if($code -ne 0){throw 'STOP: private config validation failed; no retry'}
 $savedAcl=Get-Acl -LiteralPath $config
 foreach($entry in $savedAcl.Access){
  if($entry.AccessControlType -ne 'Allow' -or $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'STOP: private config ACL mismatch; preserve state'}
 }
 Write-Host 'NGROK_PRIVATE_CONFIG_SAVED_CHECK_PASS_NOT_ACCOUNT_OR_TUNNEL_ACCEPTANCE'
 Write-Host 'No tunnel, endpoint, SSLCommerz call or database operation executed. Return only this marker.'
} finally {
 $plain=$null;$nativeOutput=$null
 if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}
 if($secure){$secure.Dispose()}
}
