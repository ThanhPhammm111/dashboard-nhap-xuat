# PowerShell script to deploy reconciliation dashboard to transport_daily_report repo

$scriptDir = $PSScriptRoot
$baseDir = Split-Path -Parent $scriptDir

$repoUrl = "https://github.com/ThanhPhammm111/transport_daily_report.git"
$tempDir = "C:\temp_deploy\doi_soat_repo"

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  DEPLOY DOI SOAT TO TRANSPORT DAILY REPORT  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Clean up old temp dir
if (Test-Path $tempDir) {
    Write-Host "Cleaning up old temp directory..." -ForegroundColor Gray
    Remove-Item $tempDir -Recurse -Force
}

# 2. Clone repository
Write-Host "Cloning transport_daily_report repository..." -ForegroundColor Cyan
git clone $repoUrl $tempDir

# 3. Create target directory structures
$targetDir = Join-Path $tempDir "docs\external\doi_soat"
Write-Host "Creating target folder: $targetDir" -ForegroundColor Gray
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}
New-Item -ItemType Directory -Path (Join-Path $targetDir "css") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "js") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "Ouput") -Force | Out-Null

# 4. Copy reconciliation web assets
Write-Host "Copying HTML, CSS and JS files..." -ForegroundColor Cyan
Copy-Item -LiteralPath (Join-Path $baseDir "index.html") -Destination (Join-Path $targetDir "index.html") -Force
Copy-Item -LiteralPath (Join-Path $baseDir "css\style.css") -Destination (Join-Path $targetDir "css\style.css") -Force
Copy-Item -LiteralPath (Join-Path $baseDir "js\app.js") -Destination (Join-Path $targetDir "js\app.js") -Force

# 5. Copy reconciliation output results
Write-Host "Copying result CSVs and JSONs from Ouput..." -ForegroundColor Cyan
$sourceOutput = Join-Path $baseDir "Ouput"
if (Test-Path $sourceOutput) {
    # Copy all files from local Ouput to repo docs/external/doi_soat/Ouput/
    Copy-Item -Path "$sourceOutput\*" -Destination (Join-Path $targetDir "Ouput\") -Recurse -Force
}

# 6. Commit and Push
Write-Host "Committing and pushing to GitHub..." -ForegroundColor Cyan
git -C $tempDir add .
$commitMsg = "Auto-update reconciliation results $(Get-Date -Format 'dd-MMM HH:mm')"
git -C $tempDir commit -m $commitMsg
git -C $tempDir push origin main

# 7. Clean up
if (Test-Path $tempDir) {
    Write-Host "Cleaning up temp directory..." -ForegroundColor Gray
    Remove-Item $tempDir -Recurse -Force
}

Write-Host "SUCCESS! HOÀN THÀNH! Deployment completed." -ForegroundColor Green
