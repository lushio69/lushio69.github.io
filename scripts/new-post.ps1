[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Title)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
} catch {}

$nodePath = $null
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($node) {
    $nodePath = $node.Source
}
if (-not $nodePath) {
    $candidates = @(
        (Join-Path $env:ProgramFiles "nodejs\node.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            $nodePath = $candidate
            break
        }
    }
}
if (-not $nodePath) {
    Write-Host "没有找到 Node.js，请先安装 Node.js 18 或更高版本。" -ForegroundColor Red
    exit 1
}

if ($Title -and $Title.Count -gt 0) {
    & $nodePath "scripts\new-post.mjs" ($Title -join " ")
} else {
    & $nodePath "scripts\new-post.mjs"
}
exit $LASTEXITCODE
