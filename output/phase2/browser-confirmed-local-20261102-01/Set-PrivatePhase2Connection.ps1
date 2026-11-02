function Set-PrivatePhase2Connection {
 param([Parameter(Mandatory=$true)][Security.SecureString]$Secret)
 foreach($name in @('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGHOSTADDR','PHASE2_BOOKING_DATABASE_URL')){
  if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'PHASE2_PRIVATE_CONNECTION_ENV_CONFLICT'}
 }
 if($Secret.Length -eq 0){throw 'PHASE2_PRIVATE_CONNECTION_EMPTY'}
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
 try {
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if($plain.IndexOf([char]0) -ge 0){throw 'PHASE2_PRIVATE_CONNECTION_INVALID_INPUT'}
  # Same private reference and one percent-encoding operation as the successful recovery.
  $env:PGPASSWORD=$plain
  $env:PGSSLMODE='disable'
  $env:PHASE2_BOOKING_DATABASE_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString($env:PGPASSWORD)+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration'
 } finally {
  $plain=$null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
 }
}
