[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$connections = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if (-not $connections) {
    Write-Output "Kein Backend-Prozess auf Port 8787 gefunden."
    exit 0
}

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
$stoppedAny = $false

foreach ($processId in $processIds) {
    try {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
        $name = [string]$process.Name
        $commandLine = [string]$process.CommandLine

        $isPython = $name -match "^python(\.exe)?$"
        $isBackendProcess = $commandLine -match "uvicorn\s+backend\.app:app"

        if (-not ($isPython -and $isBackendProcess)) {
            Write-Warning "Prozess $processId wird nicht beendet (Name='$name'). Kein eindeutig erkanntes Code-KI-Backend."
            continue
        }

        Stop-Process -Id $processId -Force -ErrorAction Stop
        Write-Output "Backend-Prozess $processId beendet."
        $stoppedAny = $true
    } catch {
        Write-Warning "Konnte Prozess $processId nicht pruefen/beenden: $($_.Exception.Message)"
    }
}

if (-not $stoppedAny) {
    Write-Warning "Kein eindeutig zuordenbarer Code-KI-Backend-Prozess wurde beendet."
}
