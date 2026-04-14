[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$healthUrl = "http://127.0.0.1:8787/health"

try {
    $response = Invoke-RestMethod -Uri $healthUrl -Method Get
    [PSCustomObject]@{
        status = $response.status
        service = $response.service
        host = $response.host
        port = $response.port
        model_available = $response.model_available
        model_loaded = $response.model_loaded
        model_path = $response.model_path
    } | ConvertTo-Json -Depth 4
} catch {
    Write-Error "Code KI Backend ist nicht erreichbar unter $healthUrl. Starte zuerst scripts/start_backend.ps1."
    throw
}
