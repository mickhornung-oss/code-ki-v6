[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Output "== V4 Repo-Checks =="
Write-Output "Python: $pythonExe"

& $pythonExe -m unittest tests.test_v4_workflow tests.test_v4_scenarios tests.test_service -v
if ($LASTEXITCODE -ne 0) {
    throw "Python-V4-Tests fehlgeschlagen."
}

Push-Location (Join-Path $repoRoot "vscode-extension")
try {
    node --check extension.js
    if ($LASTEXITCODE -ne 0) {
        throw "extension.js Syntaxcheck fehlgeschlagen."
    }
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Extension-Tests fehlgeschlagen."
    }
} finally {
    Pop-Location
}

Write-Output "V4-Repo-Checks erfolgreich."
