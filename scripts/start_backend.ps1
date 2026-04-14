[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return @{}
    }
    $raw = Get-Content -Raw -Encoding UTF8 $Path
    if (-not $raw.Trim()) {
        return @{}
    }
    $parsed = ConvertFrom-Json $raw
    if (-not $parsed) {
        return @{}
    }
    return ConvertTo-HashtableCompat -InputObject $parsed
}

function ConvertTo-HashtableCompat {
    param([Parameter(Mandatory = $true)]$InputObject)

    if ($InputObject -is [System.Collections.IDictionary]) {
        $result = @{}
        foreach ($key in $InputObject.Keys) {
            $result[$key] = ConvertTo-HashtableCompat -InputObject $InputObject[$key]
        }
        return $result
    }

    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) {
        $list = New-Object System.Collections.ArrayList
        foreach ($item in $InputObject) {
            [void]$list.Add((ConvertTo-HashtableCompat -InputObject $item))
        }
        return ,$list.ToArray()
    }

    if ($InputObject -is [pscustomobject]) {
        $result = @{}
        foreach ($prop in $InputObject.PSObject.Properties) {
            $result[$prop.Name] = ConvertTo-HashtableCompat -InputObject $prop.Value
        }
        return $result
    }

    return $InputObject
}

$config = Read-JsonFile (Join-Path $repoRoot "config\app_config.json")
$localConfig = Read-JsonFile (Join-Path $repoRoot "config\app_config.local.json")
foreach ($key in $localConfig.Keys) {
    $config[$key] = $localConfig[$key]
}

$bindHost = if ($config.ContainsKey("host") -and $config.host) { [string]$config.host } else { "127.0.0.1" }
$bindPort = if ($config.ContainsKey("port") -and $config.port) { [int]$config.port } else { 8787 }

& .\.venv\Scripts\python.exe -m uvicorn backend.app:app --host $bindHost --port $bindPort
