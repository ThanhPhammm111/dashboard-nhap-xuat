# Script to deploy reconciliation outputs to GitLab transport-daily-report repo
# This script copies the generated files, runs pnpm data:build, and pushes changes to GitLab.

$scriptDir = $PSScriptRoot
$baseDir = Split-Path -Parent $scriptDir # g:\Drive của tôi\Report\Đối chiếu xuất hàng
$parentDir = Split-Path -Parent $baseDir # g:\Drive của tôi\Report
$gitlabRepoDir = Join-Path $parentDir "transport-daily-report"

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  DEPLOY TO GITLAB (APP-SCM.KFM.VN)         " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Verify GitLab Repo Directory exists
if (-not (Test-Path $gitlabRepoDir)) {
    Write-Host "[ERROR] Khong tim thay thu muc cloned repo tai: $gitlabRepoDir" -ForegroundColor Red
    Write-Host "Vui long chac chan ban da clone repo ve cung thu muc workspace." -ForegroundColor Yellow
    exit 1
}

# 2. Get latest metadata from status.json
$statusPath = Join-Path $baseDir "Ouput\status.json"
if (-not (Test-Path $statusPath)) {
    Write-Host "[ERROR] Khong tim thay file metadata status.json tai: $statusPath" -ForegroundColor Red
    exit 1
}

try {
    $statusContent = Get-Content $statusPath -Raw
    $status = $statusContent | ConvertFrom-Json
} catch {
    Write-Host "[ERROR] Khong the doc hoac parse file status.json!" -ForegroundColor Red
    exit 1
}

# Extract date format DDMMYYYY from resultFile (e.g. Result_16072026.csv -> 16072026)
$resultFileName = $status.resultFile
if ($resultFileName -match "Result_(\d{8})\.csv") {
    $dateStr = $Matches[1]
} else {
    Write-Host "[ERROR] Ten file ket qua khong dung dinh dang: $resultFileName" -ForegroundColor Red
    exit 1
}

$statusFileName = "status_$($dateStr).json"

$localResultPath = Join-Path $baseDir "Ouput\$resultFileName"
$localStatusPath = Join-Path $baseDir "Ouput\$statusFileName"

$destResultDir = Join-Path $gitlabRepoDir "data-source\doi-soat\results"
$destStatusDir = Join-Path $gitlabRepoDir "data-source\doi-soat\status"

# 3. Copy files to data-source/
Write-Host "Dang copy du lieu sang data-source..." -ForegroundColor Cyan

if (Test-Path $localResultPath) {
    Copy-Item -LiteralPath $localResultPath -Destination (Join-Path $destResultDir $resultFileName) -Force
    Write-Host "-> Copied Result file: $resultFileName" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Khong tim thay file ket qua: $localResultPath" -ForegroundColor Red
    exit 1
}

if (Test-Path $localStatusPath) {
    Copy-Item -LiteralPath $localStatusPath -Destination (Join-Path $destStatusDir $statusFileName) -Force
    Write-Host "-> Copied Status file: $statusFileName" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Khong tim thay file trang thai: $localStatusPath" -ForegroundColor Red
    exit 1
}

# 4. Run data build and push
Push-Location $gitlabRepoDir

try {
    # Check if pnpm is available
    if (Get-Command "pnpm" -ErrorAction SilentlyContinue) {
        Write-Host "Dang chay pnpm data:build..." -ForegroundColor Cyan
        pnpm data:build
    } elseif (Get-Command "node" -ErrorAction SilentlyContinue) {
        Write-Host "Khong tim thay pnpm. Dang chay build bang Node.js..." -ForegroundColor Cyan
        node scripts/build-data.mjs
    } else {
        Write-Host "[WARNING] Khong tim thay Node.js hoac pnpm trong PATH." -ForegroundColor Yellow
        Write-Host "Ban can phai chay 'pnpm data:build' thu cong truoc khi commit/push." -ForegroundColor Yellow
        Pop-Location
        exit 1
    }

    # Verify build changes
    Write-Host "Dang kiem tra thay doi trong git..." -ForegroundColor Cyan
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Host "Dang commit va push du lieu moi len GitLab..." -ForegroundColor Cyan
        git add "data-source/doi-soat" "api/src/data"
        git commit -m "Auto-update reconciliation results for $dateStr"
        git push origin master
        Write-Host "SUCCESS! Da push code len GitLab. Tien trinh CI/CD se tu dong build va deploy." -ForegroundColor Green
    } else {
        Write-Host "Khong co thay doi nao can commit." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] Co loi xay ra trong qua trinh build hoac push git!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location
