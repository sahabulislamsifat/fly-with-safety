# Same SecureString and one-time percent encoding path as the previously successful local helper.
function Set-PrivatePhase3Connection {
 param([Parameter(Mandatory=$true)][Security.SecureString]$Secret)
 foreach($name in @('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGPASSFILE','PGHOSTADDR')){
  if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'PHASE3_PRIVATE_CONNECTION_ENV_CONFLICT'}
 }
 if($Secret.Length -eq 0){throw 'PHASE3_PRIVATE_CONNECTION_EMPTY'}
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
 try {
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if($plain.IndexOf([char]0) -ge 0){throw 'PHASE3_PRIVATE_CONNECTION_INVALID_INPUT'}
  $env:PGPASSWORD=$plain
  $env:PGSSLMODE='disable'
  $env:DATABASE_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString($env:PGPASSWORD)+'@127.0.0.1:5432/flywithsafety_local_integration'
  $env:DIRECT_URL=$env:DATABASE_URL
 } finally {
  $plain=$null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
 }
}
