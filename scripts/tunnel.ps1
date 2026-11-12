# Opens Gagesite running on your server, through SSH: http://localhost:3000 on this computer
# then reaches Gagesite on the server, and so do the website previews (3100-3119) and their APIs
# (4100-4119). Nothing is opened on the server; keep this window open while you use Gagesite.
#
#   powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1
#
# Stop Gagesite on this computer first (it uses the same ports), or pick other local ports.
#   powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1 -Server 1.2.3.4 -SshPort 22 -User you
# Or set GAGESITE_SERVER, GAGESITE_SSH_PORT and GAGESITE_SSH_USER once instead of passing them.
param(
    [string]$Server = $env:GAGESITE_SERVER,
    [int]$SshPort = $(if ($env:GAGESITE_SSH_PORT) { [int]$env:GAGESITE_SSH_PORT } else { 22 }),
    [string]$User = $env:GAGESITE_SSH_USER
)
if (-not $Server -or -not $User) {
    Write-Host "Give your server: -Server <address> -User <ssh user> [-SshPort <port>], or set GAGESITE_SERVER and GAGESITE_SSH_USER." -ForegroundColor Yellow
    exit 1
}

$ports = @(3000, 8001) + (3100..3119) + (4100..4119)
$busy = $ports | Where-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue }
if ($busy) {
    Write-Host "These ports are already used on this computer: $($busy -join ', ')." -ForegroundColor Yellow
    Write-Host "Stop Gagesite here (or what uses them) first, then run this again."
    exit 1
}

$forwards = foreach ($port in $ports) { "-L"; "$($port):127.0.0.1:$($port)" }
Write-Host "Connecting to $User@$Server ... then open http://localhost:3000 (Ctrl+C here to close)."
ssh -N -p $SshPort -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 @forwards "$User@$Server"
