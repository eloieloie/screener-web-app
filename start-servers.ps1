param(
    [int]$BackendHttpPort = 3001,
    [int]$BackendHttpsPort = 3443,
    [int]$FrontendPort = 5174
)

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $RootDir 'server'
$LogDir = Join-Path $RootDir 'logs'

$BackendOutLog = Join-Path $LogDir 'backend.out.log'
$BackendErrLog = Join-Path $LogDir 'backend.err.log'
$FrontendOutLog = Join-Path $LogDir 'frontend.out.log'
$FrontendErrLog = Join-Path $LogDir 'frontend.err.log'
$BackendPidFile = Join-Path $LogDir 'backend.pid'
$FrontendPidFile = Join-Path $LogDir 'frontend.pid'

function Write-Step {
    param([string]$Message)
    Write-Host "`n== $Message ==" -ForegroundColor Cyan
}

function Stop-PortProcess {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "Port $Port is free"
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "Stopped process $procId on port $Port"
        } catch {
            Write-Warning "Failed to stop process $procId on port ${Port}: $($_.Exception.Message)"
        }
    }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [string]$Name,
        [int]$MaxAttempts = 30,
        [int]$ProcessId = 0
    )

    Write-Host "Waiting for $Name..."
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if ($ProcessId -gt 0) {
            $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
            if (-not $proc) {
                throw "$Name process (PID: $ProcessId) exited before becoming ready. Check logs for details."
            }
        }

        try {
            Invoke-WebRequest -Uri $Url -Method Get -SkipCertificateCheck -TimeoutSec 3 | Out-Null
            Write-Host "$Name is ready" -ForegroundColor Green
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    throw "$Name did not become ready within $MaxAttempts seconds."
}

function Wait-ForAnyUrl {
    param(
        [string[]]$Urls,
        [string]$Name,
        [int]$MaxAttempts = 30,
        [int]$ProcessId = 0
    )

    Write-Host "Waiting for $Name..."
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if ($ProcessId -gt 0) {
            $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
            if (-not $proc) {
                throw "$Name process (PID: $ProcessId) exited before becoming ready. Check logs for details."
            }
        }

        foreach ($url in $Urls) {
            try {
                Invoke-WebRequest -Uri $url -Method Get -SkipCertificateCheck -TimeoutSec 3 | Out-Null
                Write-Host "$Name is ready at $url" -ForegroundColor Green
                return $url
            } catch {
                # Try next URL.
            }
        }

        Start-Sleep -Seconds 1
    }

    throw "$Name did not become ready within $MaxAttempts seconds."
}

if (-not (Test-Path $LogDir)) {
    New-Item -Path $LogDir -ItemType Directory | Out-Null
}

Write-Host "Starting Screener Web App (PowerShell)..." -ForegroundColor Green

Write-Step "Stopping existing servers"
$StopScript = Join-Path $RootDir 'stop-servers.ps1'
if (Test-Path $StopScript) {
    & $StopScript
} else {
    Stop-PortProcess -Port $BackendHttpPort
    Stop-PortProcess -Port $BackendHttpsPort
    Stop-PortProcess -Port $FrontendPort
}

Start-Sleep -Seconds 2

Write-Step "Starting backend"
$backendProcess = Start-Process -FilePath 'node' -ArgumentList 'https-server.js' -WorkingDirectory $ServerDir -RedirectStandardOutput $BackendOutLog -RedirectStandardError $BackendErrLog -PassThru
$backendProcess.Id | Set-Content -Path $BackendPidFile
Write-Host "Backend started (PID: $($backendProcess.Id))"

Write-Step "Waiting for backend health"
Wait-ForUrl -Url "http://localhost:$BackendHttpPort/health" -Name 'Backend HTTP' -ProcessId $backendProcess.Id
$backendHttpsReady = $false
try {
    Wait-ForUrl -Url "https://localhost:$BackendHttpsPort/health" -Name 'Backend HTTPS' -ProcessId $backendProcess.Id -MaxAttempts 8 | Out-Null
    $backendHttpsReady = $true
} catch {
    Write-Warning "Backend HTTPS not available (likely missing SSL certs). Continuing with HTTP backend."
}

Write-Step "Starting frontend"
$frontendProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $RootDir -RedirectStandardOutput $FrontendOutLog -RedirectStandardError $FrontendErrLog -PassThru
$frontendProcess.Id | Set-Content -Path $FrontendPidFile
Write-Host "Frontend started (PID: $($frontendProcess.Id))"

Write-Step "Waiting for frontend"
$frontendUrl = Wait-ForAnyUrl -Urls @("https://localhost:$FrontendPort/", "http://localhost:$FrontendPort/") -Name 'Frontend' -ProcessId $frontendProcess.Id

Write-Step "Service status"
Write-Host "Backend HTTP : http://localhost:$BackendHttpPort"
if ($backendHttpsReady) {
    Write-Host "Backend HTTPS: https://localhost:$BackendHttpsPort"
} else {
    Write-Host "Backend HTTPS: not available"
}
Write-Host "Frontend     : $frontendUrl"
Write-Host "Backend logs : $BackendOutLog, $BackendErrLog"
Write-Host "Frontend logs: $FrontendOutLog, $FrontendErrLog"
Write-Host "To stop all services run: .\stop-servers.ps1" -ForegroundColor Yellow
