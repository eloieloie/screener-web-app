param(
    [int]$BackendHttpPort = 3001,
    [int]$BackendHttpsPort = 3443,
    [int]$FrontendPort = 5174
)

$ErrorActionPreference = 'Continue'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $RootDir 'logs'

$BackendPidFile = Join-Path $LogDir 'backend.pid'
$FrontendPidFile = Join-Path $LogDir 'frontend.pid'

function Stop-ByPidFile {
    param([string]$PidFile)

    if (-not (Test-Path $PidFile)) {
        return
    }

    $pidValue = Get-Content -Path $PidFile -ErrorAction SilentlyContinue
    if (-not $pidValue) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
        return
    }

    try {
        $pid = [int]$pidValue
        Stop-Process -Id $pid -Force -ErrorAction Stop
        Write-Host "Stopped process $pid (from $PidFile)"
    } catch {
        Write-Host "No running process found for PID file $PidFile"
    }

    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-PortProcess {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "No listener on port $Port"
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "Stopped process $procId on port $Port"
        } catch {
            Write-Warning "Failed to stop process $procId on port $Port"
        }
    }
}

Write-Host "Stopping Screener Web App servers..." -ForegroundColor Yellow

Stop-ByPidFile -PidFile $BackendPidFile
Stop-ByPidFile -PidFile $FrontendPidFile

# Fallback cleanup by ports
Stop-PortProcess -Port $BackendHttpPort
Stop-PortProcess -Port $BackendHttpsPort
Stop-PortProcess -Port $FrontendPort

Write-Host "All stop operations completed." -ForegroundColor Green
