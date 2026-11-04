$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'config-text.ps1')
$pass=0
foreach($v in @('SYNTHETIC_A1_b2','synthetic\backslash','synthetic"internal','synthetic:colon','synthetic#hash','synthetic''apostrophe')){
 $text=New-PrivateNgrokConfigText -PrivateValue $v
 $scalar=($text -split "`n"|Where-Object {$_ -like '*authtoken:*'}).Substring(13)
 if((ConvertFrom-Json -InputObject $scalar) -cne $v){throw 'Synthetic serialization round-trip failure'}
 if(@($text -split "`n"|Where-Object {$_ -like '*authtoken:*'}).Count -ne 1){throw 'Scalar structure changed'}
 $pass++
}
foreach($v in @('',' synthetic','synthetic ',"synthetic`nendpoint",'"synthetic"',"'synthetic'",'YOUR_TOKEN','<TOKEN>','ngrok config add-authtoken x','https://example.invalid')){
 $rejected=$false;try{$null=New-PrivateNgrokConfigText -PrivateValue $v}catch{$rejected=$true}
 if(-not $rejected){throw 'Synthetic invalid input accepted'};$pass++
}
Write-Output ('Synthetic private-config tests PASS='+$pass+'; FAIL=0; no real credential used')
