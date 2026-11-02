function Assert-Phase2BackendPortFree {
 param([scriptblock]$ReadListeners = { [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() })
 try { $listeners=@(& $ReadListeners) } catch { throw 'STOP: backend listener enumeration failed' }
 foreach($endpoint in $listeners){
  if($endpoint -isnot [Net.IPEndPoint]){throw 'STOP: invalid backend listener metadata'}
  if($endpoint.Port -eq 5000){throw 'STOP: port5000 occupied; approved normal-backend interruption must happen first'}
 }
 # This snapshot is advisory. The real localhost5000 bind remains authoritative
 # and refuses a competing process admitted after this check. Never stop a process.
}
