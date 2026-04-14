[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionPath = Join-Path $repoRoot "vscode-extension"
$devHostUserDataDir = Join-Path $repoRoot "logs\vscode-dev-host-profile"
$devHostExtensionsDir = Join-Path $repoRoot "logs\vscode-dev-host-extensions"

$codeCandidates = @(
    "C:\Users\mickh\AppData\Local\Programs\Microsoft VS Code\bin\new_code.cmd",
    "C:\Users\mickh\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd",
    "C:\Users\mickh\AppData\Local\Programs\Microsoft VS Code\Code.exe",
    "C:\Program Files\Microsoft VS Code\bin\code.cmd",
    "C:\Program Files\Microsoft VS Code\Code.exe"
)

$codePath = $codeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $codePath) {
    throw "VS Code wurde lokal nicht gefunden. Gepruefte Pfade: $($codeCandidates -join ', ')"
}

New-Item -ItemType Directory -Force -Path $devHostUserDataDir | Out-Null
New-Item -ItemType Directory -Force -Path $devHostExtensionsDir | Out-Null

$arguments = @(
    "--new-window",
    "--user-data-dir", $devHostUserDataDir,
    "--extensions-dir", $devHostExtensionsDir,
    "--extensionDevelopmentPath=$extensionPath",
    $repoRoot
)

Write-Output "Starte VS Code Extension Development Host..."
Write-Output "Launcher: $codePath"
Write-Output "Extension-Pfad: $extensionPath"
Write-Output "Workspace-Pfad: $repoRoot"
Write-Output "Dev-Host-Profil: $devHostUserDataDir"
Write-Output "Dev-Host-Extensions: $devHostExtensionsDir"
Write-Output "Argumente:"
$arguments | ForEach-Object { Write-Output "  $_" }
Write-Output "Hinweis: Das richtige Fenster nutzt dieses isolierte Dev-Host-Profil und laedt Code KI V4 aus vscode-extension\\extension.js."

& $codePath @arguments
