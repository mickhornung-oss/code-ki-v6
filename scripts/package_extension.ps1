[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $repoRoot "vscode-extension"
$localNodeDir = Get-ChildItem (Join-Path $repoRoot "tools") -Directory -Filter "node-v*-win-x64" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCommand) {
    $npmExe = $npmCommand.Source
} elseif ($localNodeDir -and (Test-Path (Join-Path $localNodeDir.FullName "npm.cmd"))) {
    $npmExe = Join-Path $localNodeDir.FullName "npm.cmd"
    $env:Path = "$($localNodeDir.FullName);$env:Path"
} else {
    throw "npm wurde lokal nicht gefunden. Fuer VSIX-Paketierung zuerst Node.js + npm installieren."
}

Push-Location $extensionRoot
try {
    & $npmExe exec --yes @vscode/vsce -- package --allow-missing-repository
} finally {
    Pop-Location
}
