function Assert-P5NewPassword {
  param([AllowNull()][object]$Value,[string]$Field)
  if(@('APP','MIGRATOR') -cnotcontains $Field){throw 'PASSWORD_FIELD_INVALID'}
  $prefix='NEW_'+$Field+'_PASSWORD_'
  if($Value -isnot [string]){throw ($prefix+'INPUT_REQUIRED')}
  if($Value.Length -lt 20 -or $Value.Length -gt 128){throw ($prefix+'SIZE_POLICY')}
  if([regex]::IsMatch($Value,'[^\x21-\x7e]')){throw ($prefix+'ASCII_POLICY')}
  if(-not [regex]::IsMatch($Value,'[a-z]')){throw ($prefix+'LOWERCASE_REQUIRED')}
  if(-not [regex]::IsMatch($Value,'[A-Z]')){throw ($prefix+'UPPERCASE_REQUIRED')}
  if(-not [regex]::IsMatch($Value,'[0-9]')){throw ($prefix+'DIGIT_REQUIRED')}
  if(-not [regex]::IsMatch($Value,'[^A-Za-z0-9]')){throw ($prefix+'SYMBOL_REQUIRED')}
}
function Read-PrivateValue([string]$label){
  $value=Read-Host $label -AsSecureString
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$value.Dispose()}
}
function Show-P5NewPasswordRequirements {
  param([string]$Field)
  if(@('APP','MIGRATOR') -cnotcontains $Field){throw 'PASSWORD_FIELD_INVALID'}
  Write-Host ('Requirements for NEW '+$Field+' PostgreSQL technical-role password:')
  Write-Host '  REQUIRED: 20-128 printable ASCII characters; NO spaces, Unicode or control characters.'
  Write-Host '  REQUIRED: at least one LOWERCASE letter (a-z).'
  Write-Host '  REQUIRED: at least one UPPERCASE letter (A-Z).'
  Write-Host '  REQUIRED: at least one DIGIT (0-9) and at least one SYMBOL.'
  Write-Host '  REQUIRED: different from the existing maintenance password and the other NEW role password.'
}
function Read-NewPrivateValue {
  param([string]$Field,[string]$Label,[scriptblock]$Reader)
  if(-not $Reader){$Reader={param($prompt) Read-PrivateValue $prompt}}
  $first=$null;$second=$null
  try{
    Show-P5NewPasswordRequirements -Field $Field
    $first=& $Reader $Label
    Assert-P5NewPassword -Value $first -Field $Field
    Show-P5NewPasswordRequirements -Field $Field
    $second=& $Reader ('Confirm '+$Label)
    if($first -cne $second){throw ('NEW_'+$Field+'_PASSWORD_CONFIRMATION_MISMATCH')}
    return $first
  }finally{$first=$null;$second=$null}
}
