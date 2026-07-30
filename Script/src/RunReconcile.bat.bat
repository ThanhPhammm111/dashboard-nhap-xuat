@echo off
setlocal

set "GIT_ASK_YESNO=false"

if "%USER_RUN%"=="1" (
    set "TELEGRAM_TOKEN=8902427051:AAHpWe9UxoGplPd6XbkjCsc5A7a8Y2LMs7Y"
    REM Gui thong bao ve Telegram Ca nhan (5958913327) va cac Group Telegram (-5560060768, -4511126388)
    set "TELEGRAM_CHATID=5958913327,-5560060768,-4511126388"
) else (
    echo.
    echo [SILENT MODE] Script dang duoc chay boi Agent test - Tat thong bao Telegram.
    set "TELEGRAM_TOKEN="
    set "TELEGRAM_CHATID="
)

set "SCRIPT_DIR=%~dp0"
for %%I in ("%~dp0..\..") do set "BASE_DIR=%%~fI"
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
REM Tim ten file KFM moi nhat trong thu muc Data\KFM (dung dong lenh don de tranh loi parser CMD)
set "LATEST_FILE="
for /f "tokens=*" %%f in ('dir "%BASE_DIR%\Data\KFM\*.xlsx" /b /o:-d 2^>nul') do if not defined LATEST_FILE set "LATEST_FILE=%%f"

REM Trich xuat 8 chu so ngay tu ten file do (viet tren 1 dong don khong co ngoac batch)
set "KFM_DATE_STR="
if not "%LATEST_FILE%"=="" for /f "tokens=*" %%d in ('powershell -NoProfile -Command "if ('%LATEST_FILE%' -match '\d{8}') { $Matches[0] }"') do set "KFM_DATE_STR=%%d"


echo.
echo Dang bien dich script C#...
set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC% (
    set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

pushd "%SCRIPT_DIR%"
%CSC% /nologo /codepage:65001 /out:ReconcileData.exe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ReconcileData.cs
popd

if exist "%SCRIPT_DIR%ReconcileData.exe" (
    REM Xoa file CSV tam cu (neu co) de tranh truong hop dung nham file rac tu lan chay truoc
    if exist "C:\temp_restore\clean_kfm.csv" del "C:\temp_restore\clean_kfm.csv"
    if exist "C:\temp_restore\clean_import.csv" del "C:\temp_restore\clean_import.csv"

    echo.
    echo.
    echo Dang chay chuong trinh direct upload - Upload-Only...
    "%SCRIPT_DIR%ReconcileData.exe" --upload-only "%BASE_DIR%\Data\KFM\%LATEST_FILE%"
    if %ERRORLEVEL% neq 0 (
        echo.
        powershell -Command "Write-Host 'Co loi xay ra trong qua trinh chay upload-only.' -ForegroundColor Red"
        exit /b 1
    )
    
    REM Kiem tra xem co file CSV tam thoi de day Google Sheets khong - chi co khi doi soat khop 100%
    if exist "C:\temp_restore\clean_kfm.csv" (
        echo.
        echo Dang day du lieu thuc xuat len Google Sheets...
        call node "%SCRIPT_DIR%upload_to_sheets.js" "C:\temp_restore\clean_kfm.csv" "export"
        if %ERRORLEVEL% neq 0 (
            echo.
            powershell -Command "Write-Host 'Loi khi upload du lieu xuat len Google Sheets!' -ForegroundColor Red"
            del "C:\temp_restore\clean_kfm.csv"
        ) else (
            del "C:\temp_restore\clean_kfm.csv"
        )
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
