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

Write-Output "== V6 Repo-Checks =="
Write-Output "Python: $pythonExe"

& $pythonExe -m unittest tests.test_project_agent_flow tests.test_v6_product_flow tests.test_service tests.test_test_runner -v
if ($LASTEXITCODE -ne 0) {
    throw "V6-Python-Checks fehlgeschlagen."
}

Push-Location (Join-Path $repoRoot "vscode-extension")
try {
    node --check extension.js
    if ($LASTEXITCODE -ne 0) {
        throw "extension.js Syntaxcheck fehlgeschlagen."
    }
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "V6-Extension-Checks fehlgeschlagen."
    }
} finally {
    Pop-Location
}

Write-Output "V6-Repo-Checks erfolgreich."
