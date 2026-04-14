[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$body = @{
    prompt = "Erklaere kurz, was diese Python-Funktion verbessert werden sollte."
    mode = "explain"
    current_file_path = "demo.py"
    current_file_text = "def add(a,b):`n    return a+b`n"
    selected_text = "def add(a,b):`n    return a+b`n"
    traceback_text = ""
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Uri "http://127.0.0.1:8787/health" -Method Get | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "http://127.0.0.1:8787/assist" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
