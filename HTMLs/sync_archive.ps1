$ka = 'c:\Github Repos\projectimages\HTMLs\knowledge_archive.md'
$ix = 'c:\Github Repos\projectimages\HTMLs\index_LIVE.html'
$tm = 'c:\Github Repos\projectimages\HTMLs\teachermode_LIVE.html'
$brain = 'C:\Users\dwaug\.gemini\antigravity\brain\48e268bc-65b2-4585-9e81-43a9af3646b6\knowledge_archive.md'

$head = Get-Content $ka -TotalCount 113
# Bump version in Header from v65.22 to v65.23
$head[0] = $head[0] -replace 'v65.22', 'v65.23'

$idxContent = Get-Content $ix -Raw
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
Copy-Item $ka $brain -Force
Write-Host "Sync Complete (v65.23)"
