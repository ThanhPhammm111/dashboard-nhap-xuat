$folder = (Get-Item (Join-Path $PSScriptRoot "..\Data")).FullName
$filter = "*.xlsx"

# Initialize FileSystemWatcher for real-time monitoring
$fsw = New-Object IO.FileSystemWatcher $folder, $filter -Property @{
    IncludeSubdirectories = $true
    EnableRaisingEvents = $true
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  HE THONG THEO DOI TU DONG (REAL-TIME AUTO-MONITOR)" -ForegroundColor Green
Write-Host "  Dang theo doi file Excel trong thu muc: $folder" -ForegroundColor Cyan
Write-Host "  He thong se tu dong chay doi soat khi co file moi tai ve." -ForegroundColor Yellow
Write-Host "  Nhan Ctrl + C de dung theo doi." -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Green

# Define event action when a file is created or changed
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    
    # Avoid triggering on the temporary or target fixed files
    if ($name -like "*DATA ST.xlsx" -or $name -like "*KFM.xlsx" -or $name -like "*ABA.xlsx" -or $name -like "~$*") {
        return
    }
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Phat hien file moi/thay doi: $name" -ForegroundColor Green
    Write-Host "Cho 3 giay de file hoan tat dong bo tu Google Drive..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    # Run the reconciliation batch script
    $batPath = (Get-Item (Join-Path $PSScriptRoot "RunReconcile.bat.bat")).FullName
    Write-Host "Dang thuc hien doi soat, gui Telegram va cap nhat len Web..." -ForegroundColor Cyan
    
    # Run batch process synchronously
    Start-Process cmd.exe -ArgumentList "/c `"$batPath`"" -NoNewWindow -Wait
    Write-Host "Da hoan thanh xong phien doi soat tu dong!" -ForegroundColor Green
    Write-Host "----------------------------------------------------------" -ForegroundColor Gray
}

# Register events
$createdEvent = Register-ObjectEvent $fsw "Created" -Action $action
$changedEvent = Register-ObjectEvent $fsw "Changed" -Action $action

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # Clean up event registrations on exit
    Unregister-Event -SourceIdentifier $createdEvent.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $changedEvent.Name -ErrorAction SilentlyContinue
}
