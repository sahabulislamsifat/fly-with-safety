function New-PrivateNgrokConfigText {
 param([string]$PrivateValue)
 if([string]::IsNullOrEmpty($PrivateValue) -or $PrivateValue -match '\s|[^\x21-\x7e]' -or $PrivateValue -match '^["'']|["'']$' -or $PrivateValue -match '^(?i:https?://|ngrok\b|YOUR_TOKEN$|YOUR_AUTHTOKEN$|TOKEN$|REPLACE_ME$|<.*>$)'){
  throw 'STOP: obvious input-format issue; nothing normalized or transmitted'
 }
 # Printable ASCII was enforced above. JSON quoting is also valid YAML quoting.
 # Value is never passed to a native command, returned to the console or logged.
 $quoted='"'+$PrivateValue.Replace('\','\\').Replace('"','\"')+'"'
 return "version: 3`nagent:`n  authtoken: $quoted`n"
}
