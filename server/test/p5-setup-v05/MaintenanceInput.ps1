function Resolve-P5MaintenanceRole {
  param([AllowNull()][object]$Value)
  if($Value -is [string] -and $Value.Length -eq 0){$Value='postgres'}
  if($Value -isnot [string] -or -not [regex]::IsMatch($Value,'\A[a-zA-Z_][a-zA-Z0-9_]{0,62}\z') -or @('fws_p5_identity_app','fws_p5_identity_migrator') -ccontains $Value){
    throw 'MAINTENANCE_IDENTITY_REQUIRED'
  }
  return $Value
}
function Read-P5ValidatedSetupInput {
  param([scriptblock]$RoleReader,[scriptblock]$PasswordReader)
  # No password callback, child, or network can be reached before this succeeds.
  $role=Resolve-P5MaintenanceRole (& $RoleReader)
  $values=& $PasswordReader
  if($values -isnot [hashtable]){throw 'PRIVATE_INPUT_CONTRACT_FAILED'}
  $values['maintenanceUser']=$role
  return $values
}
