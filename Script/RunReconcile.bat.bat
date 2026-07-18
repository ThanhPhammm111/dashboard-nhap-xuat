@echo off
setlocal

set "TELEGRAM_TOKEN=8902427051:AAHpWe9UxoGplPd6XbkjCsc5A7a8Y2LMs7Y"
REM Danh sach Chat ID, cach nhau bang dau phay. Them Group ID moi vao day.
REM   - 5958913327 = Inbox ca nhan cua ban
REM   - Them Group ID (so am) phia sau, vi du: 5958913327,-100123456789
set "TELEGRAM_CHATID=5958913327,-4511126388"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%~dp0..") do set "BASE_DIR=%%~fI"
echo.
echo ==================================================
echo   Tu dong tai xuat file KFM.xlsx...
echo ==================================================
REM Lay ngay hom nay dinh dang ddMMyyyy de kiem tra file co san
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'ddMMyyyy'"') do set "TODAY_STR=%%i"

echo Kiem tra xem da co file KFM cua ngay hom nay (%TODAY_STR%) chua...
set "FOUND_FILE="
for %%f in ("%BASE_DIR%\Data\KFM\*_%TODAY_STR%*.xlsx") do (
    set "FOUND_FILE=%%~nxf"
)

if defined FOUND_FILE (
    echo.
    powershell -Command "Write-Host 'Da co file KFM cua ngay hom nay trong thu muc Data: %FOUND_FILE%. Bo qua buoc tai file.' -ForegroundColor Green"
    goto :reconcile_start
)

if not exist "C:\temp_restore\reconcile_script" mkdir "C:\temp_restore\reconcile_script"
copy /y "%SCRIPT_DIR%download_kfm.js" "C:\temp_restore\reconcile_script\download_kfm.js" >nul
copy /y "%SCRIPT_DIR%package.json" "C:\temp_restore\reconcile_script\package.json" >nul

pushd "C:\temp_restore\reconcile_script"
if not exist "node_modules" (
    echo Dang cai dat thu vien Playwright...
    call npm install --no-audit --no-fund >nul
)
call node download_kfm.js
if %ERRORLEVEL% neq 0 (
    echo.
    powershell -Command "Write-Host 'Loi khi tu dong tai file KFM.xlsx!' -ForegroundColor Red"
    popd
    pause
    exit /b 1
)
popd

:reconcile_start
echo.
echo Dang bien dich script C#...
set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC% (
    set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

pushd "%SCRIPT_DIR%"
%CSC% /nologo /out:ReconcileData.exe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ReconcileData.cs
popd

if exist "%SCRIPT_DIR%ReconcileData.exe" (
    echo.
    echo.
    echo Dang chay chuong trinh doi soat...
    "%SCRIPT_DIR%ReconcileData.exe" "%BASE_DIR%\Data\Data ST" "%BASE_DIR%\Data\KFM" "%BASE_DIR%\Data\ABA" "%BASE_DIR%\Ouput\Result.csv" "%TELEGRAM_TOKEN%" "%TELEGRAM_CHATID%"
    if %ERRORLEVEL% neq 0 (
        echo.
        powershell -Command "Write-Host 'Co loi xay ra trong qua trinh chay doi soat.' -ForegroundColor Red"
        exit /b 1
    )
    
    REM Kiem tra xem co file CSV tam thoi de day Google Sheets khong
    if exist "C:\temp_restore\clean_kfm.csv" (
        echo.
        echo Dang day du lieu thuc xuat len Google Sheets...
        pushd "C:\temp_restore\reconcile_script"
        
        REM Dam bao thu vien googleapis da duoc cai dat
        if not exist "node_modules\googleapis" (
            echo Dang cai dat thu vien Google API...
            call npm install googleapis --no-audit --no-fund >nul
        )
        
        call node "%SCRIPT_DIR%upload_to_sheets.js" "C:\temp_restore\clean_kfm.csv"
        popd
        del "C:\temp_restore\clean_kfm.csv"
    )
    
    echo.
    echo Dang day du lieu moi len GitHub...
    pushd "%BASE_DIR%"
    git add "Data/Data ST/DATA ST.xlsx" "Data/KFM/KFM.xlsx" "Data/ABA/ABA.xlsx" "Ouput"
    git commit -m "Auto-update data files from Google Drive"
    git push origin main
    popd

    echo.
    echo Dang deploy du lieu doi soat sang Dashboard tong [GitHub Pages]...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy_doi_soat.ps1"
    if %ERRORLEVEL% neq 0 (
        echo.
        powershell -Command "Write-Host 'Co loi xay ra khi deploy du lieu sang dashboard GitHub Pages.' -ForegroundColor Red"
        exit /b 1
    )

    echo.
    echo Dang deploy du lieu doi soat sang Dashboard GitLab [app-scm.kfm.vn]...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy_to_gitlab.ps1"
    if %ERRORLEVEL% neq 0 (
        echo.
        powershell -Command "Write-Host 'Co loi xay ra khi deploy du lieu sang GitLab [app-scm.kfm.vn].' -ForegroundColor Red"
        exit /b 1
    )

    echo.
    echo Dang mo Bao Cao Canh Bao...
    start "" "%BASE_DIR%\Ouput\BaoCao_CanhBao.html"
) else (
    echo.
    powershell -Command "Write-Host 'Co loi xay ra khi bien dich C#.' -ForegroundColor Red"
    exit /b 1
)
