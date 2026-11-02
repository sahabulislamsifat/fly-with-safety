$probe=New-Object Net.Sockets.TcpClient
try {
 $pending=$probe.BeginConnect('localhost',5000,$null,$null)
 if(-not $pending.AsyncWaitHandle.WaitOne(2000)){throw 'STOP: backend port state inconclusive'}
 try {$probe.EndConnect($pending); $busy=$true} catch [Net.Sockets.SocketException] {if($_.Exception.SocketErrorCode -ne [Net.Sockets.SocketError]::ConnectionRefused){throw 'STOP: backend port state inconclusive'}; $busy=$false}
 if($busy){throw 'STOP: port5000 occupied; approved normal-backend interruption must happen first'}
} finally {$probe.Dispose()}

Write-Output SAMEPORTS_PORT_GUARD_FREE_PASS
