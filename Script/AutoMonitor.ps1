$kfmPath = (Get-Item (Join-Path $PSScriptRoot "..\Data\KFM")).FullName
$abaPath = (Get-Item (Join-Path $PSScriptRoot "..\Data\ABA")).FullName
$batPath = (Get-Item (Join-Path $PSScriptRoot "RunReconcile.bat.bat")).FullName

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  HE THONG THEO DOI TU DONG POLLING (REAL-TIME AUTO-MONITOR)" -ForegroundColor Green
Write-Host "  Dang theo doi thu muc Data qua co che quet chu dong..." -ForegroundColor Cyan
Write-Host "  He thong se tu dong chay doi soat khi co file moi duoc up vao." -ForegroundColor Yellow
Write-Host "  Nhan Ctrl + C de dung theo doi." -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Green

# Lay danh sach file kem thoi gian ghi cuoi cung
function Get-FilesState {
    $files = @{}
    Get-ChildItem -Path $kfmPath, $abaPath -Filter "*.xlsx" -File -ErrorAction SilentlyContinue | ForEach-Object {
        $name = $_.Name.ToLower()
        if ($name -ne "kfm.xlsx" -and $name -ne "aba.xlsx" -and $name -notlike "*copy*") {
            $files[$_.FullName] = $_.LastWriteTime.Ticks
        }
    }
    return $files
}

# Khoi tao trang thai ban dau
$lastState = Get-FilesState

while ($true) {
    Start-Sleep -Seconds 3
    $currentState = Get-FilesState
    $hasNewOrChangedFile = $false
    $changedFileName = ""

    # Kiem tra xem co file moi hoac file bi ghi de khong
    foreach ($file in $currentState.Keys) {
        if (-not $lastState.ContainsKey($file)) {
            $hasNewOrChangedFile = $true
            $changedFileName = Split-Path $file -Leaf
            break
        } elseif ($currentState[$file] -gt $lastState[$file]) {
            $hasNewOrChangedFile = $true
            $changedFileName = Split-Path $file -Leaf
            break
        }
    }

    if ($hasNewOrChangedFile) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Phat hien file moi/thay doi: $changedFileName" -ForegroundColor Green
        Write-Host "Cho 3 giay de file hoan tat dong bo..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        
        Write-Host "Dang thuc hien doi soat, gui Telegram va cap nhat len Web..." -ForegroundColor Cyan
        Start-Process cmd.exe -ArgumentList "/c `"$batPath`"" -NoNewWindow -Wait
        Write-Host "Da hoan thanh xong phien doi soat tu dong!" -ForegroundColor Green
        Write-Host "----------------------------------------------------------" -ForegroundColor Gray
        
        # Cap nhat lai trang thai sau khi chay de tranh lap vo han
        $lastState = Get-FilesState
    } else {
        # Cap nhat lai trang thai ke ca khi co file bi xoa
        $lastState = $currentState
    }
}
