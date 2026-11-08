& {
 $ErrorActionPreference = 'Stop'
 $p = 'E:\Programming\Project\fly-with-safety\server\test\p5-browser-acceptance\Invoke-BrowserAcceptance.ps1'
 if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw 'STOP: reviewed browser caller missing' }
 if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -cne 'F41CA07C7A5A19C51C021678839B4320CFA68FF6CE37CA90EE7EA7F476D21A2C') { throw 'STOP: reviewed browser caller hash mismatch' }
 & $p -OwnerApprovedBrowserAcceptance
}
