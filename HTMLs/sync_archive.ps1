$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ka = Join-Path $PSScriptRoot "knowledge_archive.md"
$ix = Join-Path $PSScriptRoot "simroom_LIVE.html"
$tm = Join-Path $PSScriptRoot "teachermode_LIVE.html"
$brain = "C:\Users\dave\.gemini\antigravity\brain\4d2197d0-c5d3-4fae-86dd-348058fad718\knowledge_archive.md"

# Read version from simroom_LIVE.html
$liveContent = Get-Content $ix -Raw
if ($liveContent -match 'v(\d+\.\d+)') {
    $newVersion = $matches[0]
} else {
    $newVersion = "v65.71"
}

$head = Get-Content $ka -TotalCount 113
# Update version in Header to match live
$head[0] = $head[0] -replace 'v\d+\.\d+', $newVersion

$idxContent = $liveContent
$idxContent = $idxContent -replace 'const API_URL = "https://script\.google\.com/[^"]+";', 'const API_URL = "[[INJECT_URL_NOW]]";'

$tmContent = Get-Content $tm -Raw
$tmContent = $tmContent -replace 'const URL = "https://script\.google\.com/[^"]+"; const PIN = "[^"]+";', 'const URL = "[[INJECT_URL_NOW]]"; const PIN = "[[INJECT_PIN_NOW]]";'

$final = @($head)
$final += '```html'
$final += $idxContent
$final += '```'
$final += ''
$final += '### **TEMPLATE C: Teacher Mode (teachermode.html)**'
$final += '```html'
$final += $tmContent
$final += '```'

$final | Set-Content $ka -Encoding UTF8
if (Test-Path $brain) {
    Copy-Item $ka $brain -Force
}
Write-Host "Sync Complete ($newVersion)"
